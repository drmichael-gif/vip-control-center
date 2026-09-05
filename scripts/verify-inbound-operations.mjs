import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const registry=read('inbound-operations-registry.json');
const data=read('inbound-operations-snapshot.json');
const assistant=read('inbound-assistant-verification.json');
assert.equal(new Set(registry.metrics.map(m=>m.id)).size,registry.metrics.length);
assert.equal(registry.metrics.filter(m=>m.field).length,27);
const normalized=spec=>JSON.stringify({name:spec.Name,methods:spec.MetricFilters?.flatMap(f=>f.MetricFilterValues).sort()||[],threshold:spec.Threshold?.[0]?.ThresholdValue||null});
for(const m of registry.metrics){
  assert.match(m.id,/^[a-z][a-z0-9_]*$/);
  assert.ok(m.meaning&&m.unit&&m.action&&m.group);
  const t=data.totals[m.id];
  assert.equal(t.status,'available',`${m.id}: ${t.error}`);
  if(m.derive){assert.equal(t.value,data.totals[m.inputs[0]].value-data.totals[m.inputs[1]].value);continue;}
  const evidence=data.evidence.find(e=>e.request_hash===t.request_hash);
  assert.ok(evidence&&!evidence.error,`${m.id}: missing evidence`);
  const request=evidence.request;
  assert.equal(request.Interval.IntervalPeriod,'TOTAL');
  assert.equal(request.StartTime,data.envelope.start_utc);
  assert.equal(request.EndTime,data.envelope.end_utc_exclusive);
  assert.deepEqual(request.Filters.find(f=>f.FilterKey==='QUEUE').FilterValues,data.envelope.queue_ids);
  assert.deepEqual(request.Filters.find(f=>f.FilterKey==='CHANNEL').FilterValues,['VOICE']);
  const spec=request.Metrics[0];
  assert.equal(spec.Name,m.field);
  assert.deepEqual(spec.MetricFilters?.[0]?.MetricFilterValues,m.methods);
  assert.equal(spec.Threshold?.[0]?.ThresholdValue,m.threshold);
  const returned=evidence.pages.flatMap(p=>p.MetricResults||[]).flatMap(r=>r.Collections||[]);
  assert.equal(returned.length,1);
  assert.equal(returned[0].Value,t.value);
  assert.equal(normalized(returned[0].Metric),normalized(spec));
}
for(const id of ['primary_incoming','primary_answered','primary_abandoned','abandoned_total','queued']){
  for(const grain of ['hourly','daily']){
    const points=data[grain].filter(p=>p.id===id);
    assert.equal(new Set(points.map(p=>p.time)).size,points.length,`${id}: duplicate ${grain} buckets`);
    assert.equal(points.reduce((s,p)=>s+p.value,0),data.totals[id].value,`${id}: ${grain} mismatch`);
  }
}
for(const id of ['primary_incoming','primary_abandoned','queued','abandoned_total']){
  assert.equal(Object.values(data.by_queue).reduce((s,q)=>s+(q[id]??0),0),data.totals[id].value,`${id}: queue partition mismatch`);
}
assert.ok(data.hourly.length>0);
assert.ok(data.daily.some(p=>p.id==='service_level_20'));
assert.ok(data.checks.every(c=>['pass','pass_sparse'].includes(c.status)));
let matched=0;
for(const [id,result] of Object.entries(assistant.metrics)){
  if(result.status!=='Value matched')continue;
  const m=registry.metrics.find(m=>m.id===id);
  const tolerance=m.unit==='count'?0:m.unit==='percent'?.005:.1;
  assert.ok(Math.abs(data.totals[id].value-result.value)<=tolerance,`${id}: assistant mismatch`);matched++;
}
assert.equal(matched,16);
assert.equal(assistant.metrics.primary_not_answered.status,'Interpretation under review');
console.log(`PASS: ${registry.metrics.length} governed metrics, 27 native request/response checks, daily/hourly and queue count reconciliations, ${matched} assistant value comparisons.`);
