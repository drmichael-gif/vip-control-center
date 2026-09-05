/* Native agent values only. No average-of-averages or invented missing intervals. */
(function(root){
  const valid=x=>typeof x==='number'&&Number.isFinite(x);
  const uid=x=>x?String(x).split('/').pop():'__unassigned__';
  const day=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
  function value(snap,id,agent='',date='all'){
    const m=snap.metrics[id];if(!m)return null;
    if(!agent&&date==='all')return valid(m.value)?m.value:null;
    const rows=(agent?(date==='all'?m.agents:m.agent_daily):m.daily)||[];
    const found=rows.filter(r=>(!agent||uid(r.agent)===agent)&&(date==='all'||day(r.start)===date));
    return found.length===1&&valid(found[0].value)&&!found[0].error?found[0].value:null;
  }
  function display(value,m){
    if(!valid(value))return null;
    return m.id==='occupancy'?(value>=0&&value<=1?value*100:null):value;
  }
  function agents(snap){return [...new Set(Object.values(snap.metrics).flatMap(m=>(m.agents||[]).map(r=>uid(r.agent))))];}
  function identity(snap,id){return id==='__unassigned__'?{name:'Unassigned agent dimension',username:'No agent ID returned',id}:snap.identities[id]||{name:id,username:id,id};}
  function matched(ai,id,v,agent,date){const e=ai.metrics?.[id];return !agent&&date==='all'&&e?.status==='value_matched'&&valid(v)&&Math.abs(v-e.value)<=e.tolerance;}
  const api={valid,uid,day,value,display,agents,identity,matched};
  if(typeof module!=='undefined')module.exports=api;else root.AgentChartData=api;
})(typeof window==='undefined'?globalThis:window);
