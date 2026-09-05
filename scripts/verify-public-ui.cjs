const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>{if(e.type!=='css-parsing')errors.push(e.message)});
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.fetch=async p=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))});
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:true});
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
w.eval(scripts.find(s=>s.includes('Card-only entry point:')));
for(const f of ['public-dictionaries.js','inbound-chart-data.js','outbound-chart-data.js','agent-chart-data.js','inbound-operations.js','outbound-operations.js','agent-operations.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
setTimeout(()=>{try{
  const d=w.document;
  for(const [domain,dash,dict,count] of [['inbound','inbound-call-dashboard','northstar-call-center',29],['outbound','outbound-call-dashboard','northstar-outbound-calls',18],['agent','agent-performance-dashboard','agent-data',15]]){
    const p=d.querySelector(`[data-audit-panel="${dash}"]`),r=d.querySelector(`[data-audit-panel="${dict}"]`);
    assert.ok(p.textContent.includes('live data withheld'));assert.equal(r.querySelectorAll('.io-definition').length,count);
    p.querySelector('[data-public-dictionary]').click();assert.equal(r.hidden,false);
    const search=r.querySelector('[data-public-search]');search.value='not a matching metric';search.dispatchEvent(new w.Event('input'));assert.equal(r.querySelectorAll('.io-definition').length,0);
    search.value='';search.dispatchEvent(new w.Event('input'));assert.equal(r.querySelectorAll('.io-definition').length,count);
    r.querySelector('[data-public-dashboard]').click();assert.equal(p.hidden,false);
    assert.equal(p.querySelectorAll('svg').length,0,'No private or invented chart series');
  }
  assert.deepEqual(errors,[]);console.log('PASS: all three public dashboards withhold data; all 62 definitions, searches and dictionary links work.');
}catch(e){console.error(e);process.exitCode=1;}finally{w.close();}},150);
