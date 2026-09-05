(function(root){
  'use strict';
  const valid = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const day = x => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
  function select(snapshot,registry,from,through){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(through)||from>through||from<registry.period.start||through>registry.period.end)throw Error('Choose completed dates within the loaded Aug 12–15 window.');
    const rows=[];
    for(let d=from;d<=through;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10)){
      const found=snapshot.daily.filter(r=>day(r.start)===d);
      rows.push({date:d,values:found.length===1?found[0].values:{}});
    }
    const full=from===registry.period.start&&through===registry.period.end;
    const values={};
    for(const m of registry.metrics){
      if(!m.field)continue;
      if(full||m.scope==='campaign')values[m.id]=valid(snapshot.totals[m.id]?.value)?snapshot.totals[m.id].value:null;
      else if(rows.length===1)values[m.id]=valid(rows[0].values[m.id])?rows[0].values[m.id]:null;
      else if(m.field.startsWith('AVG_')||m.unit==='percent')values[m.id]=null;
      else values[m.id]=rows.every(r=>valid(r.values[m.id]))?rows.reduce((s,r)=>s+r.values[m.id],0):null;
    }
    values.remainder=valid(values.created)&&valid(values.handled)&&values.created>=values.handled?values.created-values.handled:null;
    return {rows,values,full,from,through};
  }
  function partition(values){
    const ids=['customer_disconnect','agent_disconnect','third_party_disconnect','other_disconnect'];
    return ids.every(id=>valid(values[id]))&&valid(values.handled)&&ids.reduce((n,id)=>n+values[id],0)===values.handled;
  }
  const api={valid,day,select,partition};
  if(typeof module==='object'&&module.exports)module.exports=api; else root.OutboundChartData=api;
})(typeof window==='undefined'?globalThis:window);
