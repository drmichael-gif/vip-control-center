const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n),'utf8'));
const reg=read('outbound-operations-registry.json'),s=read('outbound-operations-snapshot.json'),a=read('outbound-assistant-verification.json');
const D=require('../outbound-chart-data.js');
const native=reg.metrics.filter(m=>m.field);
assert.equal(native.length,17);
const canonicalSpec=m=>JSON.stringify({name:m.Name,filters:(m.MetricFilters||[]).map(f=>[f.MetricFilterKey,[...f.MetricFilterValues].sort(),Boolean(f.Negate)]).sort()});
for(const m of native){
  const total=s.totals[m.id],e=total.evidence;
  assert.equal(total.status,'available',m.id);
  assert.equal(e.error,null,m.id);
  assert.equal(e.request.Metrics[0].Name,m.field);
  assert.equal(e.request.Interval.IntervalPeriod,'TOTAL');
  assert.equal(e.request.EndTime,m.scope==='campaign'?'2026-08-29T04:00:00Z':'2026-08-16T04:00:00Z');
  const values=e.pages.flatMap(p=>p.MetricResults||[]).flatMap(r=>r.Collections||[]).filter(c=>canonicalSpec(c.Metric)===canonicalSpec(e.request.Metrics[0])&&!c.MetricResultError&&D.valid(c.Value));
  assert.equal(values.length,1,m.id);assert.equal(values[0].Value,total.value,m.id);
  if(m.scope!=='campaign')assert.deepEqual(e.request.Metrics[0].MetricFilters.find(f=>f.MetricFilterKey==='INITIATION_METHOD').MetricFilterValues,['OUTBOUND']);
  if(m.unit==='count'&&m.scope!=='campaign')assert.equal(s.daily.reduce((n,d)=>n+d.values[m.id],0),total.value,'DAY '+m.id);
}
for(const id of ['created','handled']){
  assert.equal(s.hourly.reduce((n,r)=>n+r.values[id],0),s.totals[id].value,'HOUR '+id);
  assert.equal(s.queues.reduce((n,r)=>n+r.values[id],0),s.totals[id].value,'QUEUE '+id);
}
const full=D.select(s,reg,'2026-08-12','2026-08-15');assert.equal(full.values.remainder,175);assert.ok(D.partition(full.values));
const part=D.select(s,reg,'2026-08-12','2026-08-13');assert.equal(part.values.handled,1757);assert.equal(part.values.interaction,null);assert.equal(part.values.campaign_sends,44);assert.ok(!part.full);
const one=D.select(s,reg,'2026-08-15','2026-08-15');assert.equal(one.values.handled,39);assert.equal(one.values.interaction,s.daily[3].values.interaction);
assert.throws(()=>D.select(s,reg,'2026-08-01','2026-08-15'));assert.throws(()=>D.select(s,reg,'2026-08-14','2026-08-13'));
const duplicate=structuredClone(s);duplicate.daily.push(duplicate.daily[0]);assert.equal(D.select(duplicate,reg,'2026-08-12','2026-08-12').values.handled,null);
const missing=structuredClone(s);delete missing.daily[0].values.handled;assert.equal(D.select(missing,reg,'2026-08-12','2026-08-13').values.handled,null);
assert.ok(!D.partition({...full.values,other_disconnect:null}));assert.ok(!D.partition({...full.values,other_disconnect:6}));
const matched=Object.entries(a.metrics).filter(([,m])=>m.status==='value_matched');assert.equal(matched.length,5);
for(const [id,m] of matched)assert.equal(s.totals[id].value,m.value,id);
assert.equal(Object.keys(a.daily_matches.handled).length,4);
for(const r of s.daily)assert.equal(a.daily_matches.handled[D.day(r.start)],r.values.handled,'Assistant DAY '+D.day(r.start));
const labels=reg.metrics.map(m=>m.semantic);assert.equal(new Set(labels).size,labels.length);assert.ok(labels.every(x=>/^[A-Za-z][A-Za-z0-9_]*$/.test(x)));
for(const ids of Object.values(reg.charts))for(const id of ids)assert.ok(reg.metrics.some(m=>m.id===id),'Chart mapping '+id);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ui=fs.readFileSync(path.join(root,'outbound-operations.js'),'utf8');
const outboundPanel=html.slice(html.indexOf('<div class="audit-tab-panel" id="northstar-outbound-calls-panel"'),html.indexOf('<div class="audit-tab-panel" data-audit-panel="agent-data"'));
assert.ok(!/<table|outbound-legacy-reference|outbound-live-reference/.test(outboundPanel),'Retired outbound tables removed from source');
assert.ok(!ui.includes('ob-history'),'No superseded dictionary disclosure');
for(const hook of ['io-dictionary-layout','io-dictionary-nav','io-search','io-definition','io-technical','data-ob-dashboard','data-ob-group','data-ob-search'])assert.ok(ui.includes(hook),'Inbound-compatible dictionary '+hook);
for(const m of reg.metrics)assert.ok(m.meaning&&m.semantic&&m.group,'Complete definition '+m.id);
const vm=require('node:vm');for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(match[1].trim())new vm.Script(match[1]);}
console.log('PASS: 17 native request/response checks; DAY/HOUR/QUEUE counts reconcile; five Assistant total matches; eight mapped chart families; missing/duplicate/invalid filters and native-average guards.');
