const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const reg=read('data/agent-operations-registry.json'),s=read('data/agent-operations-snapshot.json'),ai=read('data/agent-assistant-verification.json'),D=require('../agent-chart-data.js');
const dates=['2026-08-12','2026-08-13','2026-08-14','2026-08-15'];
assert.equal(reg.metrics.length,15);assert.equal(new Set(reg.metrics.map(m=>m.semantic.toLowerCase())).size,15);
const sum=rows=>rows.filter(r=>D.valid(r.value)).reduce((a,r)=>a+r.value,0);
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label+': '+a+' vs '+b);
for(const m of reg.metrics){
  assert.match(m.semantic,/^[A-Za-z][A-Za-z0-9_]*$/);
  assert.ok(m.meaning&&m.grain&&m.scope&&m.group);
  const result=s.metrics[m.id];
  for(const key of ['total_evidence','daily_evidence','agent_evidence','agent_daily_evidence']){
    const e=result[key];assert.equal(e.operation,'get-metric-data-v2');assert.equal(e.error,null,m.id+' '+key);assert.equal(e.request.Metrics[0].Name,m.field);
    assert.equal(e.request.StartTime,'2026-08-12T04:00:00Z');assert.equal(e.request.EndTime,'2026-08-16T04:00:00Z');assert.equal(e.request.Interval.TimeZone,'America/New_York');
    assert.equal(e.request.Interval.IntervalPeriod,key.includes('daily')?'DAY':'TOTAL');
    if(key.startsWith('agent'))assert.deepEqual(e.request.Groupings,['AGENT']);else assert.equal(e.request.Groupings,undefined);
    const filters=Object.fromEntries(e.request.Filters.map(f=>[f.FilterKey,f.FilterValues]));
    if(m.scope==='voice'){assert.deepEqual(filters.CHANNEL,['VOICE']);assert.deepEqual(filters.QUEUE,s.queues);assert.equal(filters.ROUTING_PROFILE,undefined);}
    else{assert.deepEqual(filters.ROUTING_PROFILE,s.routing_profiles);assert.equal(filters.CHANNEL,undefined);assert.equal(filters.QUEUE,undefined);}
    const native=e.pages.flatMap(p=>p.MetricResults||[]).flatMap(r=>(r.Collections||[]).filter(c=>c.Metric.Name===m.field).map(c=>({start:r.MetricInterval?.StartTime,end:r.MetricInterval?.EndTime,agent:r.Dimensions?.AGENT??null,value:c.MetricResultError?null:c.Value??null,error:c.MetricResultError??null})));
    const rows=key==='total_evidence'?null:result[key==='daily_evidence'?'daily':key==='agent_evidence'?'agents':'agent_daily'];
    if(rows)assert.deepEqual(JSON.parse(JSON.stringify(rows)),native,m.id+' raw rows');
    else assert.equal(result.value,native.length===1?native[0].value:null);
  }
  if(m.unit==='count'||['online','contact_time','idle','non_productive'].includes(m.id)){
    close(sum(result.daily),result.value,m.id+' day sum');close(sum(result.agents),result.value,m.id+' agent sum');
    for(const date of dates)close(sum(result.agent_daily.filter(r=>D.day(r.start)===date)),D.value(s,m.id,'',date),m.id+' agent day');
  }
}
assert.equal(D.value(s,'adherence'),null);assert.equal(D.value(s,'adherence','missing'),null);
assert.equal(D.value(s,'handled'),5262);assert.equal(D.matched(ai,'handled',5262,'','all'),false);
for(const id of ['non_response','non_response_excluding_abandons','answer_rate','handle_time','wrap'])assert.ok(D.matched(ai,id,D.value(s,id),'','all'));
assert.equal(D.matched(ai,'non_response',435,'any-agent','all'),false);assert.equal(D.matched(ai,'non_response',435,'','2026-08-12'),false);
for(const agent of ['',...D.agents(s)])for(const date of ['all',...dates]){
  const o=D.value(s,'occupancy',agent,date),c=D.value(s,'contact_time',agent,date),i=D.value(s,'idle',agent,date);
  if(D.valid(o)){assert.ok(o>=0&&o<=1);if(D.valid(c)&&D.valid(i)&&c+i>0)close(o,c/(c+i),'occupancy native ratio');}
}
assert.equal(D.display(15.7,{id:'occupancy'}),null,'Reject unexpected percent scale');assert.equal(D.display(null,{id:'occupancy'}),null);assert.equal(D.display(0,{id:'occupancy'}),0);
assert.equal(D.display(.2,{id:'occupancy'}),20);assert.equal(D.display(.2,{id:'answer_rate'}),.2,'Do not guess percentage scale');
const dup=structuredClone(s);dup.metrics.handled.daily.push(dup.metrics.handled.daily[0]);assert.equal(D.value(dup,'handled','',dates[0]),null,'Reject duplicate native rows');
assert.equal(s.current.error,null);assert.ok(s.current.users.length>0);for(const u of s.current.users)assert.equal(u.Contacts,undefined);
for(const uid of D.agents(s).filter(x=>x!=='__unassigned__'))assert.ok(D.identity(s,uid).name);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ui=fs.readFileSync(path.join(root,'agent-operations.js'),'utf8');
assert.ok(!/data-(?:audit-panel|call-center-tab)="call-center-metrics(?:-dictionary)?"/.test(html));
assert.ok(!html.includes("'A-104':"));assert.ok(!html.includes("key:'agent-available-now'"));
for(const hook of ['io-dictionary-layout','io-dictionary-nav','io-search','io-definition','io-technical','data-ag-agent','data-ag-date','data-ag-roster-search'])assert.ok(ui.includes(hook));
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1]);
new vm.Script(ui);new vm.Script(fs.readFileSync(path.join(root,'agent-chart-data.js'),'utf8'));
assert.equal(read('data/amazon-connect-metric-contract.json').current_agent_contract.registry,'data/agent-operations-registry.json');
console.log('PASS: 15 native metrics × TOTAL/DAY/AGENT/AGENT-DAY requests; count/time reconciliations; occupancy unit gates; 5 Assistant comparisons and 2 retained discrepancies; names/current-state separation; retired centerwide views; script syntax.');
