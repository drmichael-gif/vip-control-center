/* Shared, testable chart projections. No additional metrics or fabricated buckets. */
(function(root){
  'use strict';
  function dailyRows(snapshot, ids, metrics){
    const dates=[];
    for(let d=new Date(snapshot.start+'T12:00:00Z'), end=new Date(snapshot.end+'T12:00:00Z');d<=end;d.setUTCDate(d.getUTCDate()+1)) dates.push(d.toISOString().slice(0,10));
    const format=new Intl.DateTimeFormat('en-CA',{timeZone:snapshot.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
    const values=new Map();
    for(const p of snapshot.daily||[]){
      const parts=Object.fromEntries(format.formatToParts(new Date(p.time)).map(x=>[x.type,x.value]));
      const key=`${parts.year}-${parts.month}-${parts.day}|${p.id}`;
      // Duplicate native daily records are ambiguous, never summed (especially rates).
      values.set(key,values.has(key)?null:Number.isFinite(p.value)?p.value:null);
    }
    const read=(date,id)=>{
      const m=metrics.find(x=>x.id===id);
      if(!m?.derive)return values.get(`${date}|${id}`)??null;
      const [a,b]=m.inputs.map(input=>values.get(`${date}|${input}`));
      return Number.isFinite(a)&&Number.isFinite(b)&&a>=b?a-b:null;
    };
    return dates.map(date=>({date,values:Object.fromEntries(ids.map(id=>[id,read(date,id)]))}));
  }
  function rankedQueues(snapshot,limit=6){
    return Object.entries(snapshot.by_queue||{}).filter(([,v])=>Number.isFinite(v.abandoned_total)&&v.abandoned_total>=0)
      .map(([id,v])=>({id,name:snapshot.queues.find(q=>q.id===id)?.name||id,value:v.abandoned_total}))
      .sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)).slice(0,limit);
  }
  const api={dailyRows,rankedQueues};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.InboundChartData=api;
})(typeof window==='object'?window:globalThis);
