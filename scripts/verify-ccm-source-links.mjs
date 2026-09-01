#!/usr/bin/env node
// Focused check for the rebuilt Call Center Metrics dashboard. audit-call-center-ui.mjs proves the
// shell (render, overflow, clipping, focus rings) across all eight views and the per-tile source
// links on the three DOMAIN dashboards; its tile assertion deliberately excludes the centerwide
// view, so this script covers what the rebuild added:
//
//   1. every KPI card, the director-priority strip, both shape visuals, and every action row
//      exposes exactly one governed jump button — no legacy `data-cc-dictionary-link` anchors;
//   2. each button switches to the Call Center Metrics Dictionary, resolves its row id, and
//      leaves that row on screen, focused, and flashed (switch + scroll + focus + highlight);
//   3. each landed row is a real dictionary row that states its historical request grain and a
//      concrete Snowflake target;
//   4. the 12-month trend labels all twelve months and calls out current, peak, and low;
//   5. the heat map renders 24 hours x Mon-Sun, its three window toggles change the cells, and
//      the 168 cells sum exactly to the window total shown in the summary;
//   6. both visuals expose provenance: trend archive boundary and API-verified heat map.
//
// Same CDP approach as audit-call-center-ui.mjs: device-metrics override to reach below Chrome's
// ~485px headless CSS floor, emulated reduced motion so scroll landings are synchronous.
//
// Usage: node scripts/verify-ccm-source-links.mjs [path/to/index.html]
//   CC_VIEWPORTS=1440x900,390x760   viewports to check (default: both)
// Requires Google Chrome.

import {mkdtempSync, rmSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const PAGE = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../index.html', import.meta.url));
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = (process.env.CC_VIEWPORTS || '1440x900,390x760').split(',').map(v => {
  const [w, h] = v.trim().toLowerCase().split('x').map(Number);
  return {w, h, label: `${w}x${h}`};
});

const DASH = 'call-center-metrics';
const DICT = 'call-center-metrics-dictionary';
// Every centerwide row the rebuilt dashboard must be able to reach.
const EXPECTED_ROWS = [
  'ccm-def-contacts-abandoned', 'ccm-def-contacts-incoming', 'ccm-def-contacts-handled',
  'ccm-def-abandonment-rate', 'ccm-def-service-level', 'ccm-def-outbound-answered',
  'ccm-def-agent-available', 'ccm-def-campaign-reach',
  'ccm-def-abandoned-trend', 'ccm-def-abandoned-heatmap',
];
const MONTHS = ['Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26',
  'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26'];

// ---------------------------------------------------------------- minimal CDP client

function launchChrome(userDataDir) {
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=0', '--user-data-dir=' + userDataDir, 'about:blank'],
    {stdio: ['ignore', 'ignore', 'pipe']});
  return new Promise((res, rej) => {
    let buf = '';
    const timer = setTimeout(() => rej(new Error('Chrome did not expose a DevTools endpoint')), 20000);
    child.stderr.on('data', d => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); res({child, wsUrl: m[1]}); }
    });
    child.on('exit', c => { clearTimeout(timer); rej(new Error('Chrome exited early: ' + c)); });
  });
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const waiters = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const {res, rej} = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && waiters.has(msg.method)) {
      const list = waiters.get(msg.method);
      waiters.delete(msg.method);
      list.forEach(fn => fn(msg.params));
    }
  });
  return {
    ready: new Promise((res, rej) => {
      ws.addEventListener('open', res, {once: true});
      ws.addEventListener('error', () => rej(new Error('CDP socket failed')), {once: true});
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, {res, rej});
        ws.send(JSON.stringify({id, method, params, sessionId}));
      });
    },
    once(method) {
      return new Promise(res => {
        if (!waiters.has(method)) waiters.set(method, []);
        waiters.get(method).push(res);
      });
    },
    close() { ws.close(); }
  };
}

// ------------------------------------------------------------------- in-page probe

const PROBE = `(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await sleep(500);
  const gate=document.getElementById('share-gate');if(gate)gate.hidden=true;
  const out={links:[],legacyAnchors:0,trend:null,heat:null,pending:null,rows:{}};

  const subnav=document.querySelector('.call-center-data-tabs');
  document.querySelector('[data-audit-tab="call-center-operations"]').click();
  await sleep(240);
  const show=async name=>{subnav.querySelector('[data-call-center-tab="'+name+'"]').click();await sleep(240)};

  await show('${DASH}');
  const panel=document.querySelector('[data-audit-panel="${DASH}"]');
  out.legacyAnchors=panel.querySelectorAll('[data-cc-dictionary-link]').length;

  // ---- (4) trend: all twelve month labels plus current/peak/low callouts
  const svg=panel.querySelector('[data-ccm-trend] svg');
  if(svg){
    const texts=[...svg.querySelectorAll('text')].map(t=>t.textContent.trim());
    out.trend={
      months:${JSON.stringify(MONTHS)}.filter(m=>texts.includes(m)),
      hasCurrent:texts.some(t=>/^Current /.test(t)),
      hasPeak:texts.some(t=>/^Peak /.test(t)),
      hasLow:texts.some(t=>/^Low /.test(t)),
      dots:svg.querySelectorAll('circle').length,
      legend:(panel.querySelector('[data-ccm-trend-legend]')||{}).textContent||'',
      // Labels must not collide: compare rendered boxes of same-baseline neighbours.
      overlap:(()=>{
        const lbl=[...svg.querySelectorAll('text')].filter(t=>${JSON.stringify(MONTHS)}.includes(t.textContent.trim()))
          .map(t=>{const r=t.getBoundingClientRect();return {l:r.left,r:r.right,y:Math.round(r.top)}});
        let bad=0;
        for(let i=0;i<lbl.length;i++)for(let j=i+1;j<lbl.length;j++)
          if(Math.abs(lbl[i].y-lbl[j].y)<2&&lbl[i].l<lbl[j].r-0.5&&lbl[j].l<lbl[i].r-0.5)bad++;
        return bad;
      })()
    };
  }

  // ---- (5) heat map: 24x7 grid, working toggles, cells that sum to the window total
  const heat=panel.querySelector('[data-ccm-heatmap]');
  const sumEl=panel.querySelector('[data-ccm-heat-summary]');
  const readHeat=()=>{
    const cells=[...heat.querySelectorAll('.nc-heatmap__cell')];
    const vals=cells.map(c=>Number((c.getAttribute('aria-label').match(/·\\s*([\\d,]+)/)||[0,'0'])[1].replace(/,/g,'')));
    const stated=Number((sumEl.textContent.match(/·\\s*([\\d,]+) abandoned/)||[0,'0'])[1].replace(/,/g,''));
    return {cells:cells.length,sum:vals.reduce((a,b)=>a+b,0),stated,
      hours:heat.querySelectorAll('.nc-heatmap__hour').length,
      days:[...heat.querySelectorAll('.nc-heatmap__day')].map(d=>d.textContent.trim()),
      focusable:cells.filter(c=>c.tabIndex===0).length,
      summary:sumEl.textContent.trim()};
  };
  const wins=[];
  for(const w of ['1w','2w','1m']){
    panel.querySelector('[data-ccm-window="'+w+'"]').click();
    await sleep(160);
    const r=readHeat();r.win=w;
    r.selected=panel.querySelector('[data-ccm-window="'+w+'"]').getAttribute('aria-selected');
    wins.push(r);
  }
  out.heat={wins,scrollable:getComputedStyle(heat.closest('.nc-heatmap-wrap')).overflowX};

  // ---- (6) provenance marking must be visible on the band and on both cards
  const vis=el=>{const r=el.getBoundingClientRect();return r.width>1&&r.height>1};
  out.pending={
    band:!!panel.querySelector('.ccm-shape-note')&&vis(panel.querySelector('.ccm-shape-note')),
    badges:[...panel.querySelectorAll('.ccm-viz .ccm-pending')].filter(vis).length,
    summaryMarked:/API verified/i.test(panel.querySelector('[data-ccm-heat-summary]').textContent),
    trendBoundary:/API verified.*provisional/i.test(panel.querySelector('[data-ccm-trend-legend]').textContent)
  };

  // ---- (1)+(2)+(3) every governed jump button lands on its dictionary row
  const SEL='[data-audit-panel="${DASH}"] button[data-cc-jump-target]';
  const total=document.querySelectorAll(SEL).length;
  out.buttonCount=total;
  for(let i=0;i<total;i++){
    await show('${DASH}');
    const btn=document.querySelectorAll(SEL)[i];
    const id=btn.dataset.ccJumpTarget,view=btn.dataset.ccJumpView;
    const host=btn.closest('.cc-metric-card,.cc-metrics__priority,.nc-viz,.ccm-action');
    const rec={id,view,label:btn.textContent.trim().slice(0,54),
      origin:host?(host.className.split(/\\s+/)[0]):'?',
      aria:btn.getAttribute('aria-label')||'',
      keyboardOperable:btn.tagName==='BUTTON'&&btn.type==='button'&&btn.tabIndex>=0};
    window.scrollTo({top:0,behavior:'auto'});
    btn.click();
    await sleep(1100);                    // ccJump re-places until the row holds
    const dict=document.querySelector('[data-audit-panel="'+view+'"]');
    rec.switchedView=!!dict&&!dict.hidden;
    const row=document.getElementById(id);
    rec.rowExists=!!row;
    if(row){
      rec.rowInDictionary=!!dict&&dict.contains(row);
      rec.isDictionaryRow=row.tagName==='TR'&&!!row.closest('.cc-dictionary__table');
      const r=row.getBoundingClientRect(),vh=window.innerHeight;
      rec.inView=r.height>0&&r.top>=0&&(r.bottom<=vh||r.height>=vh-48);
      rec.top=Math.round(r.top);rec.bottom=Math.round(r.bottom);rec.vh=vh;
      rec.focused=document.activeElement===row;
      rec.flashed=row.classList.contains('inbound-source-flash');
      const text=row.textContent;
      rec.hasGrain=!!row.querySelector('.cc-grain')&&/historical request grain/i.test(text);
      rec.hasSnowflake=/ANALYTICS_CONNECT\\.[A-Z_]+/.test(text);
      rec.hasMeaning=(row.querySelector('td>span')?.textContent.trim().length||0)>30;
      out.rows[id]=true;
    }
    out.links.push(rec);
  }
  const de=document.documentElement;
  out.docOverflow=de.scrollWidth-de.clientWidth;
  return JSON.stringify(out);
})()`;

// ------------------------------------------------------------------------ test run

async function runViewport(cdp, targetId, vp) {
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  await cdp.send('Emulation.setDeviceMetricsOverride',
    {width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700}, sessionId);
  await cdp.send('Emulation.setEmulatedMedia',
    {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', {url: pathToFileURL(PAGE).href}, sessionId);
  await loaded;
  const {result, exceptionDetails} = await cdp.send('Runtime.evaluate',
    {expression: PROBE, awaitPromise: true, returnByValue: true}, sessionId);
  if (exceptionDetails) throw new Error('probe threw: ' + exceptionDetails.text);
  await cdp.send('Target.detachFromTarget', {sessionId});
  return JSON.parse(result.value);
}

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

const userDataDir = mkdtempSync(join(tmpdir(), 'ccm-cdp-'));
let chrome, cdp;
try {
  const launched = await launchChrome(userDataDir);
  chrome = launched.child;
  cdp = connect(launched.wsUrl);
  await cdp.ready;
  for (const vp of VIEWPORTS) {
    const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
    console.log(`\n=== Call Center Metrics · viewport ${vp.label} · reduced motion ===`);
    const d = await runViewport(cdp, targetId, vp);

    // (1) governed links only
    check(d.legacyAnchors === 0, 'no legacy data-cc-dictionary-link anchors remain',
      `${d.legacyAnchors} found`);
    check(d.links.length >= 15, 'every KPI, visual, and action row exposes a jump button',
      `${d.buttonCount} buttons`);
    const missing = EXPECTED_ROWS.filter(r => !d.rows[r]);
    check(missing.length === 0, 'all ten centerwide dictionary rows are reachable',
      missing.length ? 'unreached: ' + missing.join(', ') : `${EXPECTED_ROWS.length} rows`);

    // (2)+(3) each link switches, scrolls, focuses, highlights, and lands on a governed row
    d.links.forEach(l => {
      const ok = l.switchedView && l.rowExists && l.rowInDictionary && l.isDictionaryRow &&
        l.inView && l.focused && l.flashed && l.keyboardOperable &&
        /Call Center Metrics Dictionary/i.test(l.aria);
      check(ok, `${l.origin} "${l.label}" → ${l.view}#${l.id}`,
        `switched=${l.switchedView}, row=${l.rowExists}, inDictionary=${l.rowInDictionary}, ` +
        `isRow=${l.isDictionaryRow}, inView=${l.inView} (${l.top}–${l.bottom} of ${l.vh}px), ` +
        `focus=${l.focused}, flashed=${l.flashed}, button=${l.keyboardOperable}`);
    });
    const uniq = [...new Set(d.links.map(l => l.id))];
    uniq.forEach(id => {
      const l = d.links.find(x => x.id === id);
      check(l.hasGrain && l.hasSnowflake && l.hasMeaning,
        `${id} states grain, Snowflake target, and meaning`,
        `grain=${l.hasGrain}, snowflake=${l.hasSnowflake}, meaning=${l.hasMeaning}`);
    });

    // (4) trend
    check(d.trend, 'contacts abandoned trend renders');
    if (d.trend) {
      check(d.trend.months.length === 12, 'trend labels all twelve months',
        `${d.trend.months.length}/12 · ${d.trend.months.join(' ')}`);
      check(d.trend.overlap === 0, 'trend month labels do not collide',
        `${d.trend.overlap} overlapping pair(s)`);
      check(d.trend.dots === 12, 'trend plots twelve monthly points', `${d.trend.dots} dots`);
      check(d.trend.hasCurrent && d.trend.hasPeak && d.trend.hasLow,
        'trend calls out current, peak, and low',
        `current=${d.trend.hasCurrent}, peak=${d.trend.hasPeak}, low=${d.trend.hasLow}`);
      check(/Current/.test(d.trend.legend) && /Peak/.test(d.trend.legend) &&
        /Low/.test(d.trend.legend) && /verified/i.test(d.trend.legend),
        'trend legend repeats current/peak/low and marks what is verified',
        d.trend.legend.replace(/\s+/g, ' ').slice(0, 120));
    }

    // (5) heat map
    check(d.heat, 'contacts abandoned heat map renders');
    if (d.heat) {
      d.heat.wins.forEach(w => {
        check(w.cells === 168 && w.hours === 24 && String(w.days) === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
          `heat map ${w.win} is a full 24-hour Mon–Sun grid`,
          `${w.cells} cells, ${w.hours} hour headers, days=${w.days}`);
        check(w.sum === w.stated, `heat map ${w.win} cells sum to the stated window total`,
          `cells=${w.sum} vs summary=${w.stated}`);
        check(w.selected === 'true', `heat map ${w.win} toggle reports itself selected`);
        check(w.focusable === 168, `heat map ${w.win} cells are keyboard reachable`,
          `${w.focusable}/168 focusable`);
      });
      const totals = d.heat.wins.map(w => w.stated);
      check(new Set(totals).size === 3 && totals[0] < totals[1] && totals[1] < totals[2],
        'the three window toggles produce three increasing totals', totals.join(' < '));
      check(d.heat.wins[2].stated === 6904,
        '1 month window equals the API-verified 6,904 abandoned total',
        String(d.heat.wins[2].stated));
      check(/auto|scroll/.test(d.heat.scrollable),
        'heat map scrolls inside its own wrapper rather than widening the page',
        `overflow-x: ${d.heat.scrollable}`);
    }

    // (6) provenance marking
    check(d.pending.band, 'shape provenance band is visible');
    check(d.pending.badges === 2, 'both shape visuals carry a provenance badge',
      `${d.pending.badges}/2`);
    check(d.pending.summaryMarked, 'heat map summary states API verification');
    check(d.pending.trendBoundary, 'trend legend distinguishes API and provisional months');

    check(d.docOverflow <= 2, 'document has no horizontal scroll', `${d.docOverflow}px`);
  }
} finally {
  if (cdp) cdp.close();
  if (chrome) {
    const exited = new Promise(res => chrome.once('exit', res));
    chrome.kill();
    await Promise.race([exited, new Promise(res => setTimeout(res, 5000))]);
  }
  rmSync(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
