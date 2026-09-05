/* One registry, one snapshot, two views. All displayed numbers originate in saved API evidence. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let registry, snapshot, verification, dashboard, dictionary;
  let chartMetric='primary_incoming', chartGrain='day', heatMetric='abandoned_total', activeGroup='All metrics', search='';
  const fmt = (v,unit='count') => {
    if(v===null||v===undefined||!Number.isFinite(v))return 'Unavailable';
    if(unit==='percent')return `${v.toFixed(1)}%`;
    if(unit==='seconds'){const n=Math.round(v);return n>=3600?`${Math.floor(n/3600)}h ${Math.floor((n%3600)/60)}m`:n>=60?`${Math.floor(n/60)}m ${n%60}s`:`${n}s`;}
    return v.toLocaleString('en-US',{maximumFractionDigits:0});
  };
  const metric=id=>registry.metrics.find(m=>m.id===id);
  const scopeLabel=m=>m.id==='primary_not_answered'?'INBOUND · calculated remainder':m.id==='non_primary_abandoned'?'All eligible origins excluding INBOUND · calculated complement':m.methods?.join(', ')||'all eligible initiation methods';
  const value=id=>snapshot.totals[id]?.value??null;
  const formatted=id=>fmt(value(id),metric(id).unit);
  const source=(id,text='Definition & source ↗')=>`<button type="button" class="io-btn text" data-io-source="${id}">${esc(text)}</button>`;
  const shortDate=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  const period=()=>`${shortDate(snapshot.start)} – ${shortDate(snapshot.end)}, ${snapshot.start.slice(0,4)}`;
  const queueName=()=>snapshot.queue==='all'?'All standard queues':snapshot.queues.find(q=>q.id===snapshot.queue)?.name||'Selected queue';
  const check=id=>snapshot.checks.find(c=>c.id===id);
  const localParts=time=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:registry.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(new Date(time)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayKey=p=>`${p.year}-${p.month}-${p.day}`;
  function points(id,grain='hour'){
    const m=metric(id);
    if(!m.derive)return (grain==='day'?(snapshot.daily||[]):snapshot.hourly).filter(p=>p.id===id).sort((a,b)=>new Date(a.time)-new Date(b.time));
    const b=new Map(points(m.inputs[1],grain).map(p=>[p.time,p.value]));
    return points(m.inputs[0],grain).filter(p=>b.has(p.time)&&p.value>=b.get(p.time)).map(p=>({...p,id,value:p.value-b.get(p.time)}));
  }
  function assistantState(m){
    const result=verification?.metrics?.[m.id];
    const sameWindow=snapshot.start===verification?.start&&snapshot.end===verification?.end&&snapshot.queue==='all';
    if(!sameWindow)return {status:'Not compared for this selection',detail:'Assistant evidence is tied to its original date range and queue scope. Request a same-scope comparison for this selection.'};
    if(!result)return {status:'Assistant check pending',detail:'API evidence is available independently; this metric has not been verified by the assistant for this exact scope.'};
    if(result.status==='Value matched'){
      const current=value(m.id), tolerance=m.unit==='count'?0:m.unit==='percent'?.005:.1;
      if(current===null)return {status:'API unavailable',detail:'A current API value is required before comparing this assistant result.'};
      if(Math.abs(current-result.value)>tolerance)return {status:'Value changed since check',detail:`Assistant reported ${result.value}; current API value is ${current}. Recheck the historical result before claiming agreement.`};
    }
    return result;
  }
  function requestFor(m){
    if(m.derive)return m.inputs.map(id=>requestFor(metric(id)));
    const hash=snapshot.totals[m.id]?.request_hash;
    return snapshot.evidence.find(e=>e.request_hash===hash)?.request||{unavailable:'No saved API request'};
  }
  function proof(){
    const native=registry.metrics.filter(m=>m.field&&snapshot.totals[m.id]?.status==='available').length;
    return `<div class="io-proof"><b>Amazon Connect · ${native} native metrics retrieved</b><span>${esc(period())} · ${esc(queueName())} · Voice</span><span>Historical snapshot · Eastern time</span><button class="io-btn text" data-io-dictionary>Data dictionary ↗</button></div>`;
  }
  function filters(){
    return `<form class="io-filters" id="io-filters"><label>From<input name="start" type="date" required value="${snapshot.start}"></label><label>Through<input name="end" type="date" required value="${snapshot.end}"></label><label class="queue">Queue<select name="queue"><option value="all">All standard queues</option>${snapshot.queues.map(q=>`<option value="${esc(q.id)}" ${snapshot.queue===q.id?'selected':''}>${esc(q.name)}</option>`).join('')}</select></label><button class="io-btn" type="button" data-io-preset="7">Last 7 complete days</button><button class="io-btn primary" type="submit">Apply & retrieve</button></form><p class="io-filter-note" id="io-filter-status" role="status">Completed days only. Changing dates or queue retrieves a new API snapshot. Current day is excluded.</p>`;
  }
  const kpis=['primary_incoming','primary_not_answered','abandoned_total','primary_abandoned','non_primary_abandoned'];
  const kpiLabel={'primary_incoming':'Incoming calls · primary','primary_not_answered':'Not answered · primary','abandoned_total':'Total queue abandons','primary_abandoned':'Queue abandons · primary','non_primary_abandoned':'Queue abandons · non-primary'};
  function renderDashboard(){
    dashboard.innerHTML=`<main class="io" aria-label="Inbound operations dashboard"><header class="io-head"><div><span class="io-eyebrow">Call center operations / inbound</span><h1>Inbound operations</h1><p>Understand demand. Find where callers are lost. Put coverage where it matters.</p></div><div class="io-actions"><button class="io-btn" data-io-export="csv">Export metrics ↓</button><button class="io-btn primary" data-io-dictionary>Open data dictionary ↗</button></div></header>${proof()}${filters()}
      <div class="io-scope"><h2>Your five priorities</h2><p>Contact legs · ${esc(period())}<br>Original inbound = primary</p></div><section class="io-kpis" aria-label="Inbound priorities">${kpis.map((id,i)=>`<button class="io-kpi ${i>0?'loss':''}" data-io-source="${id}"><span>${kpiLabel[id]}</span><strong>${formatted(id)}${id==='primary_not_answered'?'*':''}</strong><em>${id==='primary_not_answered'?'Provisional reporting remainder':metric(id).derive?'Calculated from native counts':'Native Amazon metric'}</em></button>`).join('')}</section><p class="io-note">* Not answered is a calculated reporting remainder. Its cohort interpretation remains under review with Amazon’s assistant. ${source('primary_not_answered','Read the limitation ↗')}</p>
      <section class="io-service" aria-label="Queue service indicators">${['abandonment_rate','answer_speed','service_level_20','handle_time'].map(id=>`<button data-io-source="${id}"><span>${esc(metric(id).label)}</span><strong>${formatted(id)}</strong><small>${id==='service_level_20'?'Includes all eligible queue removals':id==='handle_time'?'All voice origins · queue context':'All eligible voice origins'}</small></button>`).join('')}</section>
      <div class="io-analysis"><section class="io-card"><div class="io-card-head"><div><span class="io-eyebrow">01 / demand over time</span><h2>Demand and service over time</h2><p>Historical reporting intervals, attributed by Amazon.</p></div>${source(chartMetric)}</div><div class="io-chart-controls"><label for="io-chart-metric">Metric</label><select id="io-chart-metric">${kpis.concat('primary_answered','queued','abandonment_rate','service_level_20','answer_speed').map(id=>`<option value="${id}" ${id===chartMetric?'selected':''}>${esc(metric(id).label)}</option>`).join('')}</select><label for="io-chart-grain">View</label><select id="io-chart-grain"><option value="day" ${chartGrain==='day'?'selected':''}>Daily</option><option value="hour" ${chartGrain==='hour'?'selected':''}>Hourly</option></select></div><div class="io-trend" id="io-trend"></div></section>
      <section class="io-card"><span class="io-eyebrow">02 / understand the loss</span><h2>Where are callers leaving?</h2><p class="io-note">Queue abandonment across all eligible voice origins.</p><div class="io-stack" aria-hidden="true"><i style="width:${value('abandoned_total')?100*value('primary_abandoned')/value('abandoned_total'):0}%"></i><i style="flex:1"></i></div>${['primary_abandoned','non_primary_abandoned'].map(id=>`<div class="io-split-row"><button data-io-source="${id}">${esc(metric(id).label)} ↗</button><strong>${formatted(id)}</strong><small>${id==='primary_abandoned'?'Original inbound contact legs':'Other eligible origins; not necessarily transfers only'}</small></div>`).join('')}<div class="io-equation">${formatted('primary_abandoned')} primary + ${formatted('non_primary_abandoned')} non-primary = ${formatted('abandoned_total')} total · ${check('abandon_partition')?.status==='pass'?'reconciled':'not verified'}</div><p class="io-note">Not answered · primary (${formatted('primary_not_answered')}) is a broader calculated remainder. Queue abandonment alone does not explain every not-handled outcome.</p>${source('primary_not_answered','Review the answer reconciliation ↗')}</section></div>
      <section class="io-card io-heatmap"><div class="io-card-head"><div><span class="io-eyebrow">03 / staffing pattern</span><h2>Which hours need attention?</h2><p>Weekday × local hour · all 24 hours · exact returned hourly counts.</p></div><div class="io-chart-controls"><label for="io-heat-metric">Show</label><select id="io-heat-metric">${kpis.map(id=>`<option value="${id}" ${id===heatMetric?'selected':''}>${esc(metric(id).label)}</option>`).join('')}</select></div></div><div id="io-heatmap"></div></section>
      <section class="io-card"><div class="io-card-head"><div><span class="io-eyebrow">04 / focus the team</span><h2>Queue comparison</h2><p>Highest abandoned volume first. Select a queue to retrieve its full dashboard.</p></div>${source('abandoned_total','Queue metric definitions ↗')}</div><div id="io-queue-list"></div><p class="io-note">Primary incoming counts original legs. Queue loss and service metrics cover all eligible voice origins. No universal target or severity is assumed.</p></section>
      <div class="io-native-grid">${[
        ['Handling & hold',['interaction_time','wrap_time','hold_time','held_contacts','hold_disconnects']],
        ['Routing & transfers',['non_response','agent_answer_rate','transferred_out','queue_transferred_out']],
        ['Waiting experience',['abandon_wait','max_queue_wait','answered_under_20','abandoned_under_5','abandoned_under_20']]
      ].map(([name,ids])=>`<section class="io-card"><h2>${name}</h2>${ids.map(id=>`<div class="io-native-row"><button data-io-source="${id}">${esc(metric(id).label)} ↗</button><strong>${formatted(id)}</strong></div>`).join('')}<p class="io-note">${name==='Handling & hold'?'Averages have different eligible populations. Do not add them to reconstruct handle time.':name==='Routing & transfers'?'Unaccepted offers count routing attempts. A contact can receive more than one offer.':'Threshold counts overlap. A long maximum deserves investigation even if the average looks acceptable.'}</p></section>`).join('')}</div>
      <footer class="io-footer"><span>Retrieved ${esc(new Date(snapshot.retrieved_at).toLocaleString('en-US',{timeZone:registry.timezone}))} ET · refresh on demand</span><span>Amazon source → governed definition → dashboard</span></footer></main>`;
    dashboard.querySelector('.io-heatmap').insertAdjacentHTML('beforebegin','<div class="io-graph-grid" id="io-extra-graphs" aria-label="Operational comparison graphs"></div>');
    renderTrend();renderComparisons();renderHeatmap();renderQueues();bindDashboard();
  }
  function comparisonGraph(title,ids,colors,stacked=false){
    const rows=window.InboundChartData.dailyRows(snapshot,ids,registry.metrics),unit=metric(ids[0]).unit;
    const usable=rows.filter(r=>stacked?ids.every(id=>r.values[id]!==null):ids.some(id=>r.values[id]!==null));
    if(!usable.length)return '<div class="io-empty">No comparable daily results returned. Missing values are not zero.</div>';
    const width=640,height=240,left=55,right=18,top=20,bottom=38;
    const peak=Math.max(1,...usable.map(r=>stacked?ids.reduce((sum,id)=>sum+r.values[id],0):Math.max(...ids.map(id=>r.values[id]??0))));
    const max=unit==='percent'?Math.max(100,peak):Math.ceil(peak*1.1);
    const x=i=>left+(width-left-right)*(stacked?(i+.5)/rows.length:rows.length===1?.5:i/(rows.length-1));
    const y=v=>height-bottom-v/max*(height-top-bottom);
    const ticks=new Set([0,Math.floor((rows.length-1)/3),Math.floor(2*(rows.length-1)/3),rows.length-1]);
    const barWidth=Math.min(55,(width-left-right)/rows.length*.65);
    const axis=[0,1,2,3,4].map(i=>`<line x1="${left}" x2="${width-right}" y1="${y(max*i/4)}" y2="${y(max*i/4)}" stroke="#e3eaed"/><text x="${left-8}" y="${y(max*i/4)+4}" text-anchor="end">${fmt(max*i/4,unit)}</text>`).join('');
    let marks='';
    if(stacked){
      marks=rows.map((r,i)=>{
        if(ids.some(id=>r.values[id]===null))return `<text x="${x(i)}" y="${y(0)-8}" text-anchor="middle">—</text>`;
        let base=0;
        return ids.map((id,j)=>{const v=r.values[id],before=base;base+=v;return `<rect x="${x(i)-barWidth/2}" y="${y(base)}" width="${barWidth}" height="${y(before)-y(base)}" fill="${colors[j]}"><title>${shortDate(r.date)} · ${esc(metric(id).label)}: ${fmt(v)}</title></rect>${base===0&&j===ids.length-1?`<circle cx="${x(i)}" cy="${y(0)}" r="3" fill="${colors[j]}"><title>${shortDate(r.date)}: 0 abandons</title></circle>`:''}`;}).join('');
      }).join('');
    }else{
      marks=ids.map((id,j)=>{
        let previous=false;
        const line=rows.map((r,i)=>{if(r.values[id]===null){previous=false;return '';}const prefix=previous?'L':'M';previous=true;return `${prefix}${x(i)},${y(r.values[id])}`;}).join(' ');
        return `<path d="${line}" fill="none" stroke="${colors[j]}" stroke-width="2.5" ${j?'stroke-dasharray="6 4"':''}/>${rows.map((r,i)=>r.values[id]===null?'':`<circle cx="${x(i)}" cy="${y(r.values[id])}" r="4" fill="${colors[j]}" stroke="white"><title>${shortDate(r.date)} · ${esc(metric(id).label)}: ${fmt(r.values[id],unit)}</title></circle>`).join('')}`;
      }).join('');
    }
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">${axis}${marks}${rows.map((r,i)=>ticks.has(i)?`<text x="${x(i)}" y="${height-10}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${shortDate(r.date)}</text>`:'').join('')}</svg><div class="io-graph-legend">${ids.map((id,i)=>`<span><i style="background:${colors[i]}"></i>${source(id,metric(id).label+' ↗')}</span>`).join('')}</div><details class="io-graph-values"><summary>View exact daily values</summary><div class="io-scroll"><table><thead><tr><th>Date (ET)</th>${ids.map(id=>`<th>${esc(metric(id).label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th>${shortDate(r.date)}</th>${ids.map(id=>`<td>${fmt(r.values[id],unit)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function renderComparisons(){
    const ranked=window.InboundChartData.rankedQueues(snapshot),max=Math.max(1,...ranked.map(q=>q.value));
    dashboard.querySelector('#io-extra-graphs').innerHTML=`
      <section class="io-card io-comparison"><span class="io-eyebrow">Demand & answers</span><h2>Incoming versus answered</h2><p class="io-note">Primary contact legs · native daily reporting counts.</p>${comparisonGraph('Daily primary incoming and answered calls',['primary_incoming','primary_answered'],['#254b68','#087f79'])}<p class="io-note">Two native reporting series, not a proven same-caller funnel. Their difference remains provisional.</p></section>
      <section class="io-card io-comparison"><span class="io-eyebrow">Abandonment over time</span><h2>Who is leaving the queue?</h2><p class="io-note">Daily total split into primary and non-primary origins.</p>${comparisonGraph('Daily queue abandonment by call origin',['primary_abandoned','non_primary_abandoned'],['#087f79','#b78336'],true)}<p class="io-note">Non-primary = all queue abandons − primary queue abandons, for the same day and scope. A complete stack equals that day’s native total.</p></section>
      <section class="io-card io-comparison"><span class="io-eyebrow">Service over time</span><h2>Service level & abandonment rate</h2><p class="io-note">Native daily percentages · all eligible voice origins.</p>${comparisonGraph('Daily service level and abandonment rate',['service_level_20','abandonment_rate'],['#087f79','#b78336'])}<p class="io-note">Separate measures, not complementary percentages. Service level includes eligible queue removals in under 20 seconds; no target is assumed.</p></section>
      <section class="io-card io-comparison"><span class="io-eyebrow">Where to investigate</span><h2>Queues with the most abandons</h2><p class="io-note">Up to six returned queues · ${esc(period())} · select a bar to drill in.</p><div class="io-ranked-bars">${ranked.length?ranked.map(q=>`<button class="io-ranked-bar" data-io-queue="${esc(q.id)}" aria-label="${esc(q.name)}, ${fmt(q.value)} queue abandons; open queue dashboard"><span>${esc(q.name)}</span><strong>${fmt(q.value)}</strong><i aria-hidden="true"><b style="width:${100*q.value/max}%"></b></i></button>`).join(''):'<div class="io-empty">No queue-level abandonment results returned.</div>'}</div><p class="io-note">Native queue counts, ranked by volume—not a performance score. This is a top-six subset, not the total across all queues.</p>${source('abandoned_total','Queue abandon definition ↗')}</section>`;
  }
  function renderTrend(){
    const raw=points(chartMetric,chartGrain), m=metric(chartMetric), host=dashboard.querySelector('#io-trend');
    if(!raw.length){host.innerHTML='<div class="io-empty">No returned interval values for this selection. Unavailable data is not shown as zero.</div>';return;}
    let pts;
    if(chartGrain==='day'){
      const groups=new Map();raw.forEach(p=>{const k=dayKey(localParts(p.time));groups.set(k,(groups.get(k)||0)+p.value);});
      pts=[...groups].sort().map(([time,value])=>({time,value,label:shortDate(time)}));
    }else pts=raw.map(p=>({...p,label:`${shortDate(dayKey(localParts(p.time)))} ${localParts(p.time).hour}:00`}));
    const w=760,h=230,left=55,right=12,top=22,bottom=35,max=m.unit==='percent'?Math.max(100,...pts.map(p=>p.value)):Math.max(1,...pts.map(p=>p.value))*1.1;
    const origin=chartGrain==='hour'?new Date(snapshot.envelope.start_utc).getTime():new Date(snapshot.start+'T00:00Z').getTime();
    const end=chartGrain==='hour'?new Date(snapshot.envelope.end_utc_exclusive).getTime()-3600000:new Date(snapshot.end+'T00:00Z').getTime();
    const x=i=>left+(w-left-right)*(end>origin?((new Date(chartGrain==='hour'?pts[i].time:pts[i].time+'T00:00Z').getTime()-origin)/(end-origin)):.5);
    const y=v=>h-bottom-(h-top-bottom)*v/max;
    const gapLimit=chartGrain==='hour'?3600000:86400000;
    const line=pts.map((p,i)=>`${i===0||new Date(p.time)-new Date(pts[i-1].time)>gapLimit?'M':'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const tickIndices=new Set([0,Math.floor((pts.length-1)/3),Math.floor(2*(pts.length-1)/3),pts.length-1]);
    host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(m.label)} ${chartGrain} trend">${[0,1,2,3].map(i=>{const v=max*i/3;return `<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e7edef"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,m.unit)}</text>`;}).join('')}<path d="${line}" fill="none" stroke="#09857e" stroke-width="2.5" stroke-linejoin="round"/>${pts.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="${pts.length<10?5:2.5}" fill="#0b8980" stroke="white" stroke-width="1.5"><title>${esc(p.label)}: ${fmt(p.value,m.unit)}</title></circle>${tickIndices.has(i)?`<text x="${x(i)}" y="${h-7}" text-anchor="${i===0?'start':i===pts.length-1?'end':'middle'}">${esc(p.label)}</text>`:''}`).join('')}</svg><div class="io-chart-footer"><span><i class="io-dot"></i>${esc(m.label)}</span><span>${pts.length} returned ${chartGrain==='day'?'day':'hour'} buckets · gaps are not filled</span></div><p class="io-note">${chartGrain==='day'?'Daily values use native DAY requests; calculated metrics subtract their same-day inputs. ':''}No points are extrapolated into missing intervals. ${source(chartMetric)}</p>`;
  }
  function renderHeatmap(){
    const host=dashboard.querySelector('#io-heatmap'), raw=points(heatMetric), cells=new Map(),days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    raw.forEach(p=>{const t=localParts(p.time),k=`${t.weekday}-${Number(t.hour)}`;cells.set(k,(cells.get(k)||0)+p.value);});
    const max=Math.max(1,...cells.values());
    const color=v=>`hsl(174 49% ${96-((v/max)**.6)*65}%)`;
    host.innerHTML=`<div class="io-scroll"><div class="io-heat-grid"><span>ET</span>${Array.from({length:24},(_,h)=>`<span>${h===0?'12a':h<12?h+'a':h===12?'12p':h-12+'p'}</span>`).join('')}${days.map(day=>`<strong>${day}</strong>${Array.from({length:24},(_,h)=>{const v=cells.get(`${day}-${h}`);return `<div class="io-cell" tabindex="0" ${v===undefined?'':`data-value="${v}" style="--heat-color:${color(v)};color:${v/max>.55?'#fff':'#326a65'}"`} title="${day} ${h}:00 ET: ${v===undefined?'No returned data':fmt(v)}" aria-label="${day} ${h}:00 ET, ${v===undefined?'no returned data':fmt(v)+' contacts'}">${v===undefined?'—':v}</div>`;}).join('')}`).join('')}</div></div><div class="io-heat-key">Less ${[0,.15,.35,.65,1].map(x=>`<i style="background:${color(max*x)}"></i>`).join('')} More<span>— No returned data</span></div><div class="io-chart-footer"><span>${fmt(raw.reduce((s,p)=>s+p.value,0))} in returned cells · native/computed total ${formatted(heatMetric)}</span>${source(heatMetric)}</div><p class="io-note">Hourly records are grouped by Eastern weekday and hour. Blank hours are preserved; the pull does not invent zeros. Use queue selection to investigate concentrated loss.</p>`;
  }
  function renderQueues(){
    const rows=Object.entries(snapshot.by_queue).sort((a,b)=>(b[1].abandoned_total??-1)-(a[1].abandoned_total??-1));
    dashboard.querySelector('#io-queue-list').innerHTML=rows.length?`<div class="io-scroll"><table class="io-queue-table"><thead><tr><th>Queue</th><th>Primary calls</th><th>Queued</th><th>Abandoned</th><th>Abandon rate</th><th>Avg answer</th><th>Service &lt;20s</th></tr></thead><tbody>${rows.map(([qid,v])=>`<tr><td><button data-io-queue="${esc(qid)}">${esc(snapshot.queues.find(q=>q.id===qid)?.name||qid)} ↗</button></td>${['primary_incoming','queued','abandoned_total','abandonment_rate','answer_speed','service_level_20'].map(id=>`<td>${fmt(v[id],metric(id).unit)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="io-empty">Queue-level results were not returned. See request evidence in the dictionary.</div>';
  }
  function renderDictionary(){
    dictionary.innerHTML=`<main class="io" aria-label="Inbound data dictionary"><header class="io-head"><div><span class="io-eyebrow">Call center operations / metric reference</span><h1>Inbound data dictionary</h1><p>The definition behind every number. Same metric registry, same API snapshot, same reporting scope.</p></div><div class="io-actions"><button class="io-btn" data-io-export="json">Download contract ↓</button><button class="io-btn primary" data-io-dashboard>Back to dashboard ↗</button></div></header>${proof()}<div class="io-scope-warning">Reporting scope: ${esc(registry.time_basis)} Queue-scoped counts do not claim to include every unqueued IVR exit. Primary means initiation method INBOUND; it does not mean a first-time caller.</div><div class="io-dictionary-layout"><aside class="io-dictionary-nav" aria-label="Metric topics">${['All metrics',...registry.groups].map(g=>`<button data-io-group="${esc(g)}" class="${g===activeGroup?'active':''}">${esc(g)}</button>`).join('')}<p>Native field names and exact request payloads are shown inside each definition.</p><button data-io-contract>Warehouse contract ↗</button></aside><div><div class="io-search"><input id="io-search" type="search" placeholder="Find a metric, Amazon field, or business question…" aria-label="Search metric dictionary" value="${esc(search)}"><span id="io-result-count"></span></div><div id="io-definitions"></div><details class="io-card io-contract" id="io-warehouse"><summary>Shared Amazon → Snowflake → semantic layer contract</summary><p>${esc(registry.warehouse.grain)}</p><pre>${esc(JSON.stringify(registry.warehouse,null,2))}</pre><p>Metric identity includes filters, threshold, window, interval, and queue scope. Native TOTAL values are not reconstructed by averaging hourly rates or times.</p><button class="io-btn" data-io-export="evidence">Download API evidence ↓</button></details></div></div></main>`;
    renderDefinitions();
    dictionary.querySelector('#io-search').addEventListener('input',e=>{search=e.target.value;renderDefinitions();});
  }
  function renderDefinitions(){
    const definitions=registry.metrics.filter(m=>(activeGroup==='All metrics'||m.group===activeGroup)&&(!search||JSON.stringify(m).toLowerCase().includes(search.toLowerCase())));
    dictionary.querySelector('#io-result-count').textContent=`${definitions.length} of ${registry.metrics.length} metrics`;
    dictionary.querySelector('#io-definitions').innerHTML=definitions.map(m=>{
      const state=assistantState(m), v=snapshot.totals[m.id], arithmetic=m.derive?`${m.inputs.map(id=>`${metric(id).field||id} [${id}]`).join(' − ')} = ${formatted(m.id)}`:'Returned directly by Amazon; display formatting only.';
      const relations=registry.reconciliations.filter(r=>r.parent===m.id||r.children.includes(m.id));
      const raw=snapshot.evidence.find(e=>e.request_hash===v?.request_hash);
      return `<details class="io-definition" id="io-def-${m.id}" data-metric-id="${m.id}"><summary><div><h3>${esc(m.label)}</h3><small>${esc(m.id)} · ${esc(m.field||'Native-count subtraction')} ${m.methods?'· '+esc(m.methods.join(', ')):''}${m.threshold?' · LT '+m.threshold+' seconds':''}</small></div><strong>${formatted(m.id)}</strong></summary><div class="io-definition-body"><p>${esc(m.meaning)}</p><div class="io-tags"><span class="io-tag">${m.derive?'Derived · disclosed arithmetic':'Native Amazon metric'}</span><span class="io-tag ${v?.status==='available'?'ok':'review'}">${v?.status==='available'?'API '+(m.derive?'inputs retrieved':'retrieved'):'API unavailable'}</span><span class="io-tag ${state.status==='Value matched'?'ok':'review'}">${esc(state.status)}</span></div><dl><dt>Operational use</dt><dd>${esc(m.action)}</dd><dt>Scope</dt><dd>${esc(queueName())} · VOICE · ${esc(scopeLabel(m))}</dd><dt>Window</dt><dd>${esc(period())} ET · end exclusive ${esc(snapshot.envelope.end_utc_exclusive)}</dd><dt>Time & grain</dt><dd>${esc(m.time_basis||registry.time_basis)} ${m.unit==='percent'||m.unit==='seconds'?'Non-additive native aggregate.':'Contact-leg count unless explicitly stated as offers.'}</dd><dt>Calculation</dt><dd><code>${esc(arithmetic)}</code></dd><dt>Assistant evidence</dt><dd>${esc(state.detail)}${state.value!==undefined?' Reported value: '+esc(state.value)+'.':''}</dd><dt>Documentation</dt><dd>${registry.source_docs.map((url,i)=>`<a href="${url}" target="_blank" rel="noopener">${['Amazon metric definitions','Historical reporting time basis','GetMetricDataV2 API reference'][i]} ↗</a>`).join(' · ')}</dd>${relations.length?`<dt>Reconciliations</dt><dd>${relations.map(r=>`${source(r.parent,metric(r.parent).label)} = ${r.children.map(id=>source(id,metric(id).label)).join(' + ')}<br><small>${esc(r.caveat||'Disjoint components in the same reporting scope.')}</small>`).join('<br>')}</dd>`:''}</dl><details class="io-technical"><summary>Exact Amazon request & returned result</summary><pre>${esc(JSON.stringify(requestFor(m),null,2))}</pre><pre>${esc(JSON.stringify(m.derive?{inputs:m.inputs.map(id=>({id,...snapshot.totals[id]})),result:v}:raw?.pages||v,null,2))}</pre></details><details class="io-technical"><summary>Snowflake & semantic implementation</summary><p class="io-note">Semantic ID: <code>${m.id}</code> · unit: ${m.unit} · classification: ${m.derive?'DERIVED':'AMAZON_PROVIDED'}</p><pre>${esc(m.derive?`${m.id==='primary_not_answered'?'-- PROVISIONAL: do not publish as a verified outcome population.\n-- Resolve time-basis interpretation with contact-record evidence first.\n':''}-- Join the two input rows on identical scope, window and interval keys.\n-- Require both statuses available and validate the subset.\nSELECT a.metric_value - b.metric_value AS ${m.id}\nFROM MART_CALL_CENTER.VW_INBOUND_OPERATIONS a\nJOIN MART_CALL_CENTER.VW_INBOUND_OPERATIONS b\n  USING (instance_id, queue_scope_hash, channel, interval_period,\n         interval_start_utc, interval_end_utc, timezone, contract_version)\nWHERE a.metric_id = '${m.inputs[0]}' AND b.metric_id = '${m.inputs[1]}'\n  AND a.status = 'available' AND b.status = 'available'\n  AND a.metric_value >= b.metric_value;`:registry.warehouse.sql.replace(':metric_id',`'${m.id}'`))}</pre><p class="io-note">${esc(registry.warehouse.refresh)}</p><p class="io-note">Tests: ${esc(registry.warehouse.tests.join('; '))}.</p></details></div></details>`;
    }).join('')||'<p class="io-results-message">No matching metrics. Try another field or topic.</p>';
  }
  function tab(view){document.querySelector(`[data-call-center-tab="${view}"]`)?.click();}
  function jump(id){
    activeGroup='All metrics';search='';renderDictionary();tab('northstar-call-center');
    const el=dictionary.querySelector(`#io-def-${id}`);if(!el)return;
    el.open=true;el.classList.add('highlight');
    requestAnimationFrame(()=>{el.scrollIntoView({block:'start',behavior:'instant'});el.querySelector('summary').focus({preventScroll:true});});
  }
  async function refresh(start,end,queue){
    const status=dashboard.querySelector('#io-filter-status'), form=dashboard.querySelector('#io-filters');
    status.classList.remove('error');status.textContent='Retrieving native totals, hourly intervals and queue comparisons from Amazon Connect…';
    form.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
    try{
      const response=await fetch(`/api/inbound?${new URLSearchParams({start,end,queue})}`);
      if(!response.ok)throw new Error(response.headers.get('content-type')?.includes('json')?(await response.json()).error:'This static preview cannot retrieve data. Open the local operations server on port 4318.');
      const data=await response.json();
      if(!data.totals||!data.envelope)throw new Error('The API did not return a complete snapshot.');
      snapshot=data;renderDashboard();renderDictionary();
      dashboard.querySelector('#io-filter-status').textContent='New reporting window loaded. All figures and source definitions now use this selection.';
    }catch(error){status.classList.add('error');status.textContent=`Refresh did not complete: ${error.message} Displayed data remains ${period()}.`;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);}
  }
  function bindDashboard(){
    const form=dashboard.querySelector('#io-filters');
    form.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(form);refresh(f.get('start'),f.get('end'),f.get('queue'));});
    dashboard.querySelector('#io-chart-metric').addEventListener('change',e=>{chartMetric=e.target.value;renderTrend();const b=e.target.closest('.io-card').querySelector('.io-card-head [data-io-source]');b.dataset.ioSource=chartMetric;});
    dashboard.querySelector('#io-chart-grain').addEventListener('change',e=>{chartGrain=e.target.value;renderTrend();});
    dashboard.querySelector('#io-heat-metric').addEventListener('change',e=>{heatMetric=e.target.value;renderHeatmap();});
  }
  function download(type){
    let content,name,mime;
    if(type==='csv'){
      const rows=[['metric_id','label','value','unit','classification','start_et','end_et_inclusive','queue_scope','retrieved_at','api_status','assistant_status'],...registry.metrics.map(m=>[m.id,m.label,value(m.id)??'',m.unit,m.derive?'DERIVED':'AMAZON_PROVIDED',snapshot.start,snapshot.end,queueName(),snapshot.retrieved_at,snapshot.totals[m.id]?.status,assistantState(m).status])];
      content=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');name='inbound-operations.csv';mime='text/csv';
    }else{content=JSON.stringify(type==='evidence'?snapshot:registry,null,2);name=type==='evidence'?'inbound-api-evidence.json':'inbound-metric-contract.json';mime='application/json';}
    const url=URL.createObjectURL(new Blob([content],{type:mime})), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function events(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ioSource){jump(b.dataset.ioSource);return;}
    if(b.hasAttribute('data-io-dictionary')){tab('northstar-call-center');dictionary.querySelector('h1').scrollIntoView();}
    if(b.hasAttribute('data-io-dashboard')){tab('inbound-call-dashboard');dashboard.querySelector('h1').scrollIntoView();}
    if(b.dataset.ioGroup){activeGroup=b.dataset.ioGroup;renderDictionary();}
    if(b.hasAttribute('data-io-contract')){const d=dictionary.querySelector('#io-warehouse');d.open=true;d.scrollIntoView();}
    if(b.dataset.ioExport)download(b.dataset.ioExport);
    if(b.dataset.ioQueue){tab('inbound-call-dashboard');refresh(snapshot.start,snapshot.end,b.dataset.ioQueue);dashboard.querySelector('h1').scrollIntoView();}
    if(b.dataset.ioPreset){
      const now=localParts(new Date().toISOString());const end=new Date(dayKey(now)+'T12:00Z');end.setUTCDate(end.getUTCDate()-1);const start=new Date(end);start.setUTCDate(start.getUTCDate()-6);
      const form=dashboard.querySelector('#io-filters');form.elements.start.value=start.toISOString().slice(0,10);form.elements.end.value=end.toISOString().slice(0,10);
      dashboard.querySelector('#io-filter-status').textContent='Last 7 completed days selected. Apply & retrieve to load this window.';
    }
  }
  async function init(){
    dashboard=document.querySelector('[data-audit-panel="inbound-call-dashboard"]');dictionary=document.querySelector('[data-audit-panel="northstar-call-center"]');
    if(!dashboard||!dictionary)return;
    try{
      const responses=await Promise.all([fetch('data/inbound-operations-registry.json'),fetch('data/inbound-operations-snapshot.json'),fetch('data/inbound-assistant-verification.json')]);
      registry=await responses[0].json();snapshot=await responses[1].json();verification=responses[2].ok?await responses[2].json():null;
      if(snapshot.sanitized){window.renderPublicDictionary(dashboard,dictionary,registry,'inbound');return;}
      renderDashboard();renderDictionary();dashboard.addEventListener('click',events);dictionary.addEventListener('click',events);
      const syncShell=()=>document.body.classList.toggle('io-active',!dashboard.hidden||!dictionary.hidden);
      new MutationObserver(syncShell).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
      new MutationObserver(syncShell).observe(dictionary,{attributes:true,attributeFilter:['hidden']});
      syncShell();
      // Preserve external links from the operations shell to the old governed metric IDs.
      document.addEventListener('click',e=>{const b=e.target.closest('[data-cc-jump-target]');if(!b)return;const m=registry.metrics.find(m=>m.legacy&&b.dataset.ccJumpTarget===`cc-def-${m.legacy}`);if(m){e.preventDefault();e.stopImmediatePropagation();jump(m.id);}},true);
    }catch(error){dashboard.innerHTML=`<main class="io"><h1>Inbound operations</h1><p class="io-empty">Could not load the governed metric data: ${esc(error.message)}. Open the local dashboard server to load the API snapshot.</p></main>`;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
