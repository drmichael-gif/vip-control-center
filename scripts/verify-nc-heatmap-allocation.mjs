#!/usr/bin/env node
// Verifies the Northstar "Not-connected call analytics" heat-map allocation for the Table 3
// children of "Contacts abandoned in queue" (six queue-abandon duration bands and the two
// missed-offer relationship categories).
//
// Asserts, for every 1w / 2w / 1m window:
//   1. cell margin  — for each of the 168 weekday/hour cells, the group's child cells sum
//                     exactly to the shared abandoned-in-queue parent cell;
//   2. row margin   — each child's window total equals its largest-remainder share of the
//                     parent window total, and the 1-month window reproduces the visible
//                     source total from Table 3 exactly;
//   3. group total  — the group's cells sum to the parent window total;
//   4. Table 1/2    — the parent cell of the top view still equals the sum of the seven
//                     terminal-path cells, i.e. this check did not regress the existing cubes;
//   5. trend margin — the child 12-month series add back to the abandoned-in-queue series.
//
// Usage: node scripts/verify-nc-heatmap-allocation.mjs [path/to/index.html]
// Requires Google Chrome (headless) to execute the page's inline script.

import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const PAGE = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../index.html', import.meta.url));
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Largest-remainder allocation, mirroring the page's `allocate` so expected row margins are
// derived here independently of the values the page reports.
function allocate(weights, total) {
  const out = weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return out;
  const exact = weights.map(w => (w * total) / sum);
  let placed = 0;
  exact.forEach((v, i) => { out[i] = Math.floor(v); placed += out[i]; });
  const order = exact.map((v, i) => ({rem: v - Math.floor(v), i}))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; placed < total; k++, placed++) out[order[k % order.length].i]++;
  return out;
}

const PROBE = `<script>
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const a=window.__ncAllocationAudit,out={};
    if(!a){document.title='NCVERIFY:'+JSON.stringify({error:'__ncAllocationAudit missing'});return;}
    out.parentKey=a.parentKey;out.parentCurrent=a.parentCurrent;out.parentTrend=a.parentTrend;
    out.windows=a.windows;
    out.groups=a.groups.map(g=>({name:g.name,children:g.children}));
    out.cubes={};
    a.windows.forEach(w=>{
      out.cubes[w]={};
      out.cubes[w][a.parentKey]=a.grid(a.parentKey,w);
      out.cubes[w].__terminals=['abandoned','pre-queue','callback','queue-transfer','flow','system','unmapped']
        .map(k=>a.grid(k,w));
      out.cubes[w].__total=a.grid('total',w);
      a.groups.forEach(g=>g.children.forEach(c=>{out.cubes[w][c.key]=a.grid(c.key,w);}));
    });
    document.title='NCVERIFY:'+JSON.stringify(out);
  },120);
});
</script>
</html>`;

const dir = mkdtempSync(join(tmpdir(), 'nc-verify-'));
let dom;
try {
  const html = readFileSync(PAGE, 'utf8');
  if (!html.includes('__ncAllocationAudit')) {
    console.error(`FAIL: ${PAGE} has no __ncAllocationAudit hook.`);
    process.exit(1);
  }
  const probed = join(dir, 'probe.html');
  writeFileSync(probed, html.replace('</html>', PROBE));
  dom = execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=6000', '--dump-dom', probed,
  ], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']});
} finally {
  rmSync(dir, {recursive: true, force: true});
}

const m = dom.match(/<title>NCVERIFY:([\s\S]*?)<\/title>/);
if (!m) {
  console.error('FAIL: page did not publish a NCVERIFY payload (inline script error?).');
  process.exit(1);
}
const data = JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
if (data.error) { console.error('FAIL: ' + data.error); process.exit(1); }

const flat = g => g.flat();
const sum = xs => xs.reduce((a, b) => a + b, 0);
const failures = [];
const lines = [];
const check = (ok, label, detail) => {
  lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(label);
};

for (const win of data.windows) {
  const cubes = data.cubes[win];
  const parent = cubes[data.parentKey];
  const parentTotal = sum(flat(parent));
  lines.push(`\n[${win}] parent "Contacts abandoned in queue" window total ${parentTotal}`);

  // 4. Table 1/2 cubes must be untouched: top parent cell = sum of the seven terminal cells.
  let t12 = 0;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    if (cubes.__total[d][h] !== sum(cubes.__terminals.map(g => g[d][h]))) t12++;
  }
  check(t12 === 0, 'Table 1/2 unchanged: top cell = sum of 7 terminal cells',
    `${168 - t12}/168 cells`);

  for (const group of data.groups) {
    const grids = group.children.map(c => cubes[c.key]);

    // 1. cell margin
    let bad = 0, worst = null;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const got = sum(grids.map(g => g[d][h]));
      if (got !== parent[d][h]) { bad++; worst = worst || `d${d}h${h}: ${got} vs ${parent[d][h]}`; }
    }
    check(bad === 0, `${group.name}: child cells sum to parent cell`,
      bad === 0 ? '168/168 cells' : `${bad} mismatched cells (${worst})`);

    // 3. group total
    const gTotal = sum(grids.map(g => sum(flat(g))));
    check(gTotal === parentTotal, `${group.name}: group total = parent window total`,
      `${gTotal} vs ${parentTotal}`);

    // 2. row margin
    const expected = allocate(group.children.map(c => c.current), parentTotal);
    const actual = grids.map(g => sum(flat(g)));
    check(expected.every((v, i) => v === actual[i]),
      `${group.name}: per-child window totals = largest-remainder share`,
      `[${actual}] vs [${expected}]`);
    if (win === '1m') {
      check(group.children.every((c, i) => actual[i] === c.current),
        `${group.name}: 1-month totals reproduce visible Table 3 source values`,
        `[${actual}] vs [${group.children.map(c => c.current)}]`);
    }
  }
}

lines.push('\n[trend] 12-month child series vs abandoned-in-queue series');
for (const group of data.groups) {
  const months = data.parentTrend.map((v, i) => sum(group.children.map(c => c.trend[i])));
  check(months.every((v, i) => v === data.parentTrend[i]),
    `${group.name}: monthly series add back to parent series`,
    `[${months}] vs [${data.parentTrend}]`);
  check(group.children.every(c => c.trend[c.trend.length - 1] === c.current),
    `${group.name}: current month equals the reported row value`);
}

console.log('Northstar Table 3 heat-map allocation check — ' + PAGE);
console.log(lines.join('\n'));
console.log(`\n${failures.length ? 'FAILED: ' + failures.length + ' check(s)' : 'ALL CHECKS PASSED'}`);
process.exit(failures.length ? 1 : 0);
