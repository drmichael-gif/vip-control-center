#!/usr/bin/env node
// Presentation audit for the eight Call Center Operations views (the centerwide metrics
// dashboard/dictionary plus the three domain dashboard/dictionary pairs). Complements
// verify-nc-source-links.mjs, which proves the
// dictionary's own graph→table jumps; this script proves the shell around them:
//
//   1. the parent tab plus each sub-tab actually reveals its panel (non-zero height);
//   2. every dashboard "View mapped source" button switches to the Inbound Data Dictionary,
//      resolves its target id, and leaves that target on screen and flashed;
//   3. nothing overflows horizontally — neither the document nor any block inside a view;
//   4. no visible element is clipped by an `overflow:hidden` ancestor;
//   5. every interactive control in these views has a visible focus indicator that differs
//      from its resting state (outline, box-shadow, or border), measured by focusing it.
//
// Same CDP approach as verify-nc-source-links.mjs: device-metrics override to get below
// Chrome's ~485px headless CSS floor, emulated reduced motion so scroll landings are
// synchronous rather than racing a smooth animation.
//
// Usage: node scripts/audit-call-center-ui.mjs [path/to/index.html]
//   CC_VIEWPORTS=1440x900,390x760   viewports to check (default: both, plus 1024x800)
//   CC_SHOT_DIR=/tmp/cc             save one screenshot per view per viewport
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
const VIEWPORTS = (process.env.CC_VIEWPORTS || '1440x900,1024x800,390x760').split(',').map(v => {
  const [w, h] = v.trim().toLowerCase().split('x').map(Number);
  return {w, h, label: `${w}x${h}`};
});
const SHOT_DIR = process.env.CC_SHOT_DIR || '';

// The centerwide pair followed by the three domain action/verify pairs, in nav order.
const VIEWS = (process.env.CC_VIEWS ? process.env.CC_VIEWS.split(',').map(v => v.trim()).filter(Boolean) : [
  'call-center-metrics', 'call-center-metrics-dictionary',
  'inbound-call-dashboard', 'northstar-call-center',
  'outbound-call-dashboard', 'northstar-outbound-calls',
  'agent-performance-dashboard', 'agent-data'
]);
const DASHBOARDS = VIEWS.filter(v => /dashboard$/.test(v));

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

const AUDIT = (views, dashboards) => `(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await sleep(500);
  const gate=document.getElementById('share-gate');if(gate)gate.hidden=true;
  const VIEWS=${JSON.stringify(views)};
  const out={viewport:{cw:document.documentElement.clientWidth,ih:window.innerHeight},
    parentTab:null,subnav:null,views:[],sourceLinks:[],sourceButtonCount:0,docOverflow:null};

  const parent=document.querySelector('[data-audit-tab="call-center-operations"]');
  const subnav=document.querySelector('.call-center-data-tabs');
  out.parentTab=!!parent;out.subnav=!!subnav;
  if(!parent||!subnav)return JSON.stringify(out);

  const show=async name=>{
    const btn=subnav.querySelector('[data-call-center-tab="'+name+'"]');
    if(!btn)return false;
    btn.click();await sleep(220);return true;
  };
  const desc=el=>{
    const cls=(el.className&&typeof el.className==='string')?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):'';
    let self=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+cls;
    // Bare td/th/span tell you nothing; name the nearest identifiable container too.
    if(!el.id){
      const host=el.closest('table[id],section[id],[data-audit-panel]');
      if(host&&host!==el)self+=' in '+(host.id||host.dataset.auditPanel);
    }
    if(/^(td|th|span)([.#]|$)/.test(self)){
      const sample=(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,52);
      if(sample)self+=' ["'+sample+'"]';
    }
    return self;
  };
  const visible=el=>{
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1)return false;
    const s=getComputedStyle(el);
    return s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0;
  };

  parent.click();await sleep(260);
  out.subnavVisibleAfterParent=!subnav.hidden&&subnav.getBoundingClientRect().height>0;
  out.subnavTabs=[...subnav.querySelectorAll('[data-call-center-tab]')].map(b=>b.dataset.callCenterTab);

  for(const name of VIEWS){
    const ok=await show(name);
    const panel=document.querySelector('[data-audit-panel="'+name+'"]');
    const rec={name,tabExists:ok,panelExists:!!panel,
      panelVisible:!!panel&&!panel.hidden&&panel.getBoundingClientRect().height>0,
      overflowers:[],clipped:[],focusless:[]};

    if(rec.panelVisible){
      // (3) horizontal overflow inside the panel
      panel.querySelectorAll('*').forEach(el=>{
        if(!visible(el))return;
        const s=getComputedStyle(el);
        if(s.overflowX==='auto'||s.overflowX==='scroll')return;      // intentionally scrollable
        const over=el.scrollWidth-el.clientWidth;
        if(over>2&&el.clientWidth>0)rec.overflowers.push(desc(el)+' +'+over+'px');
      });

      // (4) elements clipped by an overflow:hidden ancestor
      const clippers=[...panel.querySelectorAll('*')].filter(el=>{
        const s=getComputedStyle(el);
        return (s.overflowX==='hidden'||s.overflowY==='hidden')&&visible(el);
      });
      clippers.forEach(clip=>{
        const cr=clip.getBoundingClientRect();
        const s=getComputedStyle(clip);
        [...clip.children].forEach(kid=>{
          if(!visible(kid))return;
          const kr=kid.getBoundingClientRect();
          const dx=s.overflowX==='hidden'?Math.max(cr.left-kr.left,kr.right-cr.right):0;
          const dy=s.overflowY==='hidden'?Math.max(cr.top-kr.top,kr.bottom-cr.bottom):0;
          const worst=Math.max(dx,dy);
          if(worst>2)rec.clipped.push(desc(kid)+' cut '+Math.round(worst)+'px by '+desc(clip));
        });
      });

      // (5) visible focus indicator on every interactive control
      const controls=[...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')]
        .filter(visible);
      const subnavControls=[...subnav.querySelectorAll('button')].filter(visible);
      for(const el of [...subnavControls,...controls].slice(0,220)){
        const before=getComputedStyle(el);
        const rest={outline:before.outlineStyle+' '+before.outlineWidth+' '+before.outlineColor,
          shadow:before.boxShadow,border:before.borderColor+' '+before.borderWidth,
          bg:before.backgroundColor};
        el.focus({preventScroll:true});
        if(document.activeElement!==el){el.blur();continue}
        const after=getComputedStyle(el);
        const now={outline:after.outlineStyle+' '+after.outlineWidth+' '+after.outlineColor,
          shadow:after.boxShadow,border:after.borderColor+' '+after.borderWidth,
          bg:after.backgroundColor};
        const ringy=now.outline!==rest.outline&&after.outlineStyle!=='none'&&
          parseFloat(after.outlineWidth)>0;
        const changed=ringy||now.shadow!==rest.shadow||now.border!==rest.border||now.bg!==rest.bg;
        if(!changed)rec.focusless.push(desc(el));
        el.blur();
      }
      rec.focusless=[...new Set(rec.focusless)];
    }
    out.views.push(rec);
  }

  // (2) every dashboard tile jumps to a verified dictionary definition carrying all five facets
  const SEL='.inbound-metric__source[data-cc-jump-target]';
  for(const dash of ${JSON.stringify(dashboards)}){
    await show(dash);
    const count=document.querySelectorAll('[data-audit-panel="'+dash+'"] '+SEL).length;
    out.sourceButtonCount+=count;
    for(let i=0;i<count;i++){
      await show(dash);
      const btn=document.querySelectorAll('[data-audit-panel="'+dash+'"] '+SEL)[i];
      const id=btn.dataset.ccJumpTarget,view=btn.dataset.ccJumpView;
      const rec={dash,id,view,label:btn.textContent.trim().slice(0,60),
        keyboardOperable:btn.tagName==='BUTTON'&&btn.type==='button'&&btn.tabIndex>=0,
        aria:btn.getAttribute('aria-label')||''};
      window.scrollTo({top:0,behavior:'auto'});
      btn.click();
      await sleep(1100);            // ccJump re-places until the target holds; let it finish
      const dict=document.querySelector('[data-audit-panel="'+view+'"]');
      rec.switchedView=!!dict&&!dict.hidden;
      const target=document.getElementById(id);
      rec.targetExists=!!target;
      if(target){
        rec.targetInDictionary=!!dict&&dict.contains(target);
        rec.isDefinitionCard=target.classList.contains('cc-def');
        const text=target.textContent;
        // The five facets the definition must make obvious. Formula is required only for Derived.
        const cls=target.querySelector('.cc-def__class')?.textContent.trim()||'';
        const terms=[...target.querySelectorAll('dt')].map(t=>t.textContent.trim());
        rec.classification=cls;
        rec.hasSourceField=terms.includes('Exact source field');
        rec.hasMeaning=(target.querySelector('.cc-def__meaning')?.textContent.trim().length||0)>40;
        rec.hasFormula=cls!=='Derived'||terms.includes('Formula');
        rec.hasAssistant=terms.includes('Connect Assistant verification');
        rec.hasApi=terms.includes('Reproducible API call');
        rec.hasRecon=!!target.querySelector('.cc-def__recon .cc-jump');
        rec.plainClassification=!!cls&&getComputedStyle(target.querySelector('.cc-def__class')).textTransform==='none';
        const r=target.getBoundingClientRect(),vh=window.innerHeight;
        rec.inView=r.height>0&&r.top>=0&&(r.bottom<=vh||r.height>=vh-48);
        rec.top=Math.round(r.top);rec.bottom=Math.round(r.bottom);rec.vh=vh;
        rec.focused=document.activeElement===target;
        rec.flashed=target.classList.contains('inbound-source-flash');
      }
      out.sourceLinks.push(rec);
    }
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
    {expression: AUDIT(VIEWS, DASHBOARDS), awaitPromise: true, returnByValue: true}, sessionId);
  if (exceptionDetails) throw new Error('page audit threw: ' + exceptionDetails.text);
  if (SHOT_DIR) {
    // Source-link checks intentionally finish inside a dictionary. Restore the requested
    // final view so saved screenshots represent the surface being visually reviewed.
    await cdp.send('Runtime.evaluate', {expression: `(async()=>{const b=document.querySelector('[data-call-center-tab="${VIEWS.at(-1)}"]');if(b)b.click();await new Promise(r=>setTimeout(r,250))})()`, awaitPromise: true}, sessionId);
    mkdirSync(SHOT_DIR, {recursive: true});
    const shot = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(join(SHOT_DIR, `cc-${vp.label}.png`), Buffer.from(shot.data, 'base64'));
  }
  await cdp.send('Target.detachFromTarget', {sessionId});
  return JSON.parse(result.value);
}

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

const userDataDir = mkdtempSync(join(tmpdir(), 'cc-cdp-'));
let chrome, cdp;
try {
  const launched = await launchChrome(userDataDir);
  chrome = launched.child;
  cdp = connect(launched.wsUrl);
  await cdp.ready;
  for (const vp of VIEWPORTS) {
    const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
    console.log(`\n=== viewport ${vp.label} · reduced motion ===`);
    const data = await runViewport(cdp, targetId, vp);

    check(data.viewport.cw <= vp.w && data.viewport.cw >= vp.w - 20,
      'CSS viewport width applied', `${data.viewport.cw}px of ${vp.w}px requested`);
    check(data.parentTab && data.subnav, 'Call Center Operations tab and sub-nav exist');
    check(data.subnavVisibleAfterParent, 'sub-nav becomes visible from the parent tab');
    check(String(data.subnavTabs) === String(VIEWS),
      'sub-nav offers all eight views in order', String(data.subnavTabs));

    data.views.forEach(v => {
      check(v.tabExists && v.panelVisible, `view "${v.name}" renders`,
        `tab=${v.tabExists}, panel=${v.panelExists}, visible=${v.panelVisible}`);
      check(v.overflowers.length === 0, `view "${v.name}" has no horizontal overflow`,
        v.overflowers.slice(0, 6).join(' | ') || 'clean');
      check(v.clipped.length === 0, `view "${v.name}" clips nothing`,
        v.clipped.slice(0, 6).join(' | ') || 'clean');
      check(v.focusless.length === 0, `view "${v.name}" focus indicators on every control`,
        v.focusless.slice(0, 8).join(' | ') || 'clean');
    });

    check(data.docOverflow <= 2, 'document has no horizontal scroll', `${data.docOverflow}px`);
    check(data.sourceLinks.length === 16, 'all three dashboards expose a link per tile',
      `${data.sourceButtonCount} buttons across ${DASHBOARDS.length} dashboards`);
    data.sourceLinks.forEach(l => {
      const ok = l.switchedView && l.targetExists && l.targetInDictionary && l.isDefinitionCard &&
        l.inView && l.flashed && l.focused && l.keyboardOperable && /definition/i.test(l.aria);
      check(ok, `${l.dash} → ${l.view}#${l.id}`,
        `switched=${l.switchedView}, exists=${l.targetExists}, inDictionary=${l.targetInDictionary}, ` +
        `definitionCard=${l.isDefinitionCard}, inView=${l.inView} (${l.top}–${l.bottom} of ${l.vh}px), ` +
        `focus=${l.focused}, flashed=${l.flashed}, button=${l.keyboardOperable}`);
      const facets = l.hasSourceField && l.hasMeaning && l.hasFormula && l.hasAssistant &&
        l.hasApi && l.hasRecon && !!l.classification && l.plainClassification;
      check(facets, `${l.id} definition states all required facets`,
        `classification="${l.classification}" (plainText=${l.plainClassification}), ` +
        `sourceField=${l.hasSourceField}, meaning=${l.hasMeaning}, formula=${l.hasFormula}, ` +
        `assistant=${l.hasAssistant}, api=${l.hasApi}, reconLink=${l.hasRecon}`);
    });
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
