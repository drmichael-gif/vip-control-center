#!/usr/bin/env node
// Verifies the retained queue-abandonment lineage fixtures and their source-table jumps.
// The fixtures are intentionally hidden from the current director dashboard, but remain the
// low-level regression harness for row-level dictionary navigation.
//
// Asserts, at every requested viewport:
//   1. every graph card shows a title, one plain-language description directly under that title,
//      and one discreet source-table link — and none of the metadata the simplified layout drops
//      ("Source table:" prefix, a "row ..." area, or the "12-month trend · weekday × hour density"
//      mechanics line);
//   2. every link resolves to a unique existing <table> anchor — the exact table, not just the
//      section — and, where a row is named, that row id exists inside that table;
//   3. activating a link lands the exact originating row: after the click that row is fully inside
//      the viewport, holds focus, and carries the transient highlight, while its table is still on
//      screen for context. A whole-table reference brings the table head into view instead;
//   4. the links are keyboard-operable (native <button> in the tab order) and carry an aria-label
//      naming the table and row they lead to;
//   5. the jump changes neither the URL nor the history length (no href, no reload);
//   6. no duplicate element ids were introduced.
//
// Chrome's headless window has a ~485px CSS floor, so viewports are applied with a CDP device
// metrics override rather than --window-size, which makes a true 390px run possible. Emulated
// prefers-reduced-motion also puts the page on its synchronous scroll path, so the landing
// assertions in check 3 are deterministic instead of racing a smooth scroll.
//
// Usage: node scripts/verify-nc-source-links.mjs [path/to/index.html]
//   NC_VIEWPORTS=1440x900,390x760   viewports to check (default: both of these)
//   NC_SHOT_DIR=/tmp/nc             also save a post-click screenshot per viewport
//   NC_MOTION=smooth                exercise the default smooth-scroll path instead, waiting for
//                                   the animation to settle before measuring
// Requires Google Chrome.

import {mkdtempSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const PAGE = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../index.html', import.meta.url));
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = (process.env.NC_VIEWPORTS || '1440x900,390x760').split(',').map(v => {
  const [w, h] = v.trim().toLowerCase().split('x').map(Number);
  return {w, h, label: `${w}x${h}`};
});
const SHOT_DIR = process.env.NC_SHOT_DIR || '';
const SMOOTH = process.env.NC_MOTION === 'smooth';
const SETTLE = SMOOTH ? 900 : 60;   // smooth scrolling needs the animation to finish first
// The deep row used for the screenshot: last band of Table 3, the case the review flagged.
const SHOT_ROW = 'nc-row-abandon-120plus';

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

// ------------------------------------------------------------------- in-page audit

// Runs inside the page. Every jump starts from the top of the document so each measurement is
// independent, and the deep `shotRow` link is clicked last so a screenshot taken afterwards shows
// that row's landing position.
const AUDIT = (shotRow, settle) => `(async()=>{
  const SETTLE=${settle};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await sleep(500);
  const gate=document.getElementById('share-gate');if(gate)gate.hidden=true;
  const out={dupIds:[],cards:[],links:[],viewport:{cw:document.documentElement.clientWidth,ih:window.innerHeight}};
  const seen={};
  document.querySelectorAll('[id]').forEach(el=>{seen[el.id]=(seen[el.id]||0)+1});
  Object.keys(seen).forEach(id=>{if(seen[id]>1)out.dupIds.push(id+' x'+seen[id])});
  const parent=document.querySelector('[data-audit-tab="call-center-operations"]');
  if(parent)parent.click();
  await sleep(180);
  const tab=document.querySelector('[data-call-center-tab="northstar-call-center"]');
  if(tab)tab.click();
  await sleep(250);
  const root=document.querySelector('[data-nc-analytics]');
  if(!root)return JSON.stringify({error:'[data-nc-analytics] missing'});
  const panel=root.closest('[data-audit-panel]');
  out.sourceFixtureReady=!!panel&&!panel.hidden&&root.querySelectorAll('.nc-viz').length===2;
  root.querySelectorAll('.nc-viz').forEach(card=>{
    const head=card.querySelector('header'),title=card.querySelector('h3');
    const desc=card.querySelector('.nc-viz__desc'),value=card.querySelector('header>b');
    out.cards.push({
      title:title?title.textContent.trim():null,
      desc:desc?desc.textContent.trim():null,
      descFollowsTitle:!!(title&&desc&&title.nextElementSibling===desc),
      linkCount:card.querySelectorAll('.nc-source .nc-jump').length,
      value:value?value.textContent.trim():null,
      droppedMetadata:/Source table:|row \\u201C|weekday . hour density/.test(head?head.textContent:'')
    });
  });
  const href0=location.href,len0=history.length;
  const btns=[...root.querySelectorAll('button[data-nc-jump]')];
  const deep=btns.filter(b=>b.dataset.ncJumpRow===${JSON.stringify(shotRow)});
  for(const btn of [...btns.filter(b=>!deep.includes(b)),...deep]){
    const table=document.getElementById(btn.dataset.ncJump);
    const row=btn.dataset.ncJumpRow?document.getElementById(btn.dataset.ncJumpRow):null;
    const rec={label:btn.textContent.trim(),target:btn.dataset.ncJump,rowId:btn.dataset.ncJumpRow||null,
      targetIsTable:!!(table&&table.tagName==='TABLE'),
      rowInTarget:!btn.dataset.ncJumpRow||!!(table&&row&&table.contains(row)),
      keyboardOperable:btn.tagName==='BUTTON'&&btn.type==='button'&&!btn.disabled&&btn.tabIndex>=0,
      hasHref:btn.hasAttribute('href'),
      aria:btn.getAttribute('aria-label')||''};
    window.scrollTo({top:0,behavior:'auto'});
    btn.click();
    await sleep(SETTLE);
    const land=row||table,vh=window.innerHeight;
    const lr=land.getBoundingClientRect(),tr=table.getBoundingClientRect();
    rec.landsInView=row?(lr.top>=0&&lr.bottom<=vh):(lr.top>=0&&lr.top<vh*.5);
    rec.rowTop=Math.round(lr.top);rec.rowBottom=Math.round(lr.bottom);rec.vh=vh;
    rec.tableInView=tr.bottom>0&&tr.top<vh;
    rec.focusOnRow=document.activeElement===land;
    rec.highlighted=!!(table.classList.contains('nc-jump-flash')&&(!row||row.classList.contains('nc-jump-flash')));
    rec.urlUnchanged=location.href===href0&&history.length===len0;
    out.links.push(rec);
  }
  return JSON.stringify(out);
})()`;

// ------------------------------------------------------------------------ test run

async function runViewport(cdp, targetId, vp) {
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  await cdp.send('Emulation.setDeviceMetricsOverride',
    {width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700}, sessionId);
  if (!SMOOTH) {
    await cdp.send('Emulation.setEmulatedMedia',
      {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]}, sessionId);
  }
  await cdp.send('Page.enable', {}, sessionId);
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', {url: pathToFileURL(PAGE).href}, sessionId);
  await loaded;
  const {result, exceptionDetails} = await cdp.send('Runtime.evaluate',
    {expression: AUDIT(SHOT_ROW, SETTLE), awaitPromise: true, returnByValue: true}, sessionId);
  if (exceptionDetails) throw new Error('page audit threw: ' + exceptionDetails.text);
  if (SHOT_DIR) {
    mkdirSync(SHOT_DIR, {recursive: true});
    const shot = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    const file = join(SHOT_DIR, `nc-jump-${vp.label}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(`  saved ${file} — viewport after clicking ${SHOT_ROW}`);
  }
  await cdp.send('Target.detachFromTarget', {sessionId});
  return JSON.parse(result.value);
}

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

const userDataDir = mkdtempSync(join(tmpdir(), 'nc-cdp-'));
let chrome, cdp;
try {
  const launched = await launchChrome(userDataDir);
  chrome = launched.child;
  cdp = connect(launched.wsUrl);
  await cdp.ready;
  for (const vp of VIEWPORTS) {
    const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
    console.log(`\n=== viewport ${vp.label} · ${SMOOTH ? 'smooth scroll' : 'reduced motion'} ===`);
    const data = await runViewport(cdp, targetId, vp);
    if (data.error) { check(false, 'page audit', data.error); continue; }

    // A classic (layout-consuming) scrollbar is subtracted from clientWidth on the desktop run.
    check(data.viewport.cw <= vp.w && data.viewport.cw >= vp.w - 20,
      'CSS viewport width applied', `${data.viewport.cw}px of ${vp.w}px requested`);
    check(data.sourceFixtureReady, 'Inbound lineage source-link fixtures are complete');
    check(data.cards.length === 2, 'focused director graphs found', `${data.cards.length} cards`);
    const badCards = data.cards.filter(c =>
      !c.desc || !c.descFollowsTitle || c.linkCount !== 1 || c.droppedMetadata);
    check(badCards.length === 0,
      'every card: description directly under title, one source link, simplified metadata',
      badCards.length ? JSON.stringify(badCards) : `${data.cards.length} cards clean`);
    check(data.dupIds.length === 0, 'no duplicate element ids', data.dupIds.join(', ') || 'none');
    check(data.links.length === 3, 'every source reference is a link', `${data.links.length} links`);

    data.links.forEach(l => {
      const ok = l.targetIsTable && l.rowInTarget && l.keyboardOperable && !l.hasHref &&
        l.landsInView && l.tableInView && l.focusOnRow && l.highlighted && l.urlUnchanged &&
        /table /i.test(l.aria);
      check(ok, `${l.target}${l.rowId ? ' / ' + l.rowId : ' (whole table)'}`,
        `landsInView=${l.landsInView} (target ${l.rowTop}–${l.rowBottom} of ${l.vh}px), ` +
        `tableInView=${l.tableInView}, focus=${l.focusOnRow}, highlight=${l.highlighted}, ` +
        `urlUnchanged=${l.urlUnchanged}, button=${l.keyboardOperable}, href=${l.hasHref}`);
    });
    const rowLinks = data.links.filter(l => l.rowId);
    check(rowLinks.length === 3 && rowLinks.every(l => l.landsInView),
      `all ${rowLinks.length} named-row targets land fully in view`);
  }
} finally {
  if (cdp) cdp.close();
  if (chrome) {
    // Chrome keeps writing to the profile as it shuts down, so wait for the exit before removing it.
    const exited = new Promise(res => chrome.once('exit', res));
    chrome.kill();
    await Promise.race([exited, new Promise(res => setTimeout(res, 5000))]);
  }
  rmSync(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
