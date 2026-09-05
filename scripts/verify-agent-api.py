#!/usr/bin/env python3
"""Read-only historical agent evidence. No customer contacts or credentials published."""
import concurrent.futures
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from inbound_operations import aws, ARN, CONFIG

ROOT = Path(__file__).resolve().parents[1]
REG = json.loads((ROOT/'data/agent-operations-registry.json').read_text())

def fetch(operation, request):
    e={'operation':operation,'request':request,'pages':[],'error':None,'retrieved_at':datetime.now(timezone.utc).isoformat()}
    e['hash']=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest()
    req=dict(request)
    try:
        while True:
            page=aws('connect',operation,'--cli-input-json',json.dumps(req),'--no-paginate')
            e['pages'].append(page)
            if page.get('Errors'): raise RuntimeError(json.dumps(page['Errors']))
            if not page.get('NextToken'): break
            req['NextToken']=page['NextToken']
    except Exception as exc: e['error']=str(exc)
    return e

def validate_units(metrics):
    o=metrics['occupancy']['value'];c=metrics['contact_time']['value'];i=metrics['idle']['value']
    if o is not None and (not 0 <= o <= 1 or c is None or i is None or c+i<=0 or abs(o-c/(c+i))>1e-8):
        raise RuntimeError('Occupancy native scale or scope validation failed. Preserve prior snapshot; review units before publication.')

def run():
    instance=CONFIG['instance_id']
    queues=fetch('list-queues',{'InstanceId':instance,'QueueTypes':['STANDARD'],'MaxResults':100})
    profiles=fetch('list-routing-profiles',{'InstanceId':instance,'MaxResults':100})
    qids=[q['Id'] for p in queues['pages'] for q in p.get('QueueSummaryList',[])]
    rpids=[r['Id'] for p in profiles['pages'] for r in p.get('RoutingProfileSummaryList',[])]
    if queues['error'] or profiles['error'] or not qids or not rpids: raise RuntimeError('Queue or routing-profile enumeration failed; do not publish a partial scope.')
    def request(m,interval='TOTAL',group=False):
        filters=[{'FilterKey':'QUEUE','FilterValues':qids},{'FilterKey':'CHANNEL','FilterValues':['VOICE']}] if m['scope']=='voice' else [{'FilterKey':'ROUTING_PROFILE','FilterValues':rpids}]
        req={'ResourceArn':ARN,'StartTime':'2026-08-12T04:00:00Z','EndTime':'2026-08-16T04:00:00Z','Interval':{'TimeZone':'America/New_York','IntervalPeriod':interval},'Filters':filters,'Metrics':[{'Name':m['field']}],'MaxResults':100}
        if group: req['Groupings']=['AGENT']
        return fetch('get-metric-data-v2',req)
    def rows(e,m):
        if e['error']: return []
        return [{'start':r.get('MetricInterval',{}).get('StartTime'),'end':r.get('MetricInterval',{}).get('EndTime'),'agent':r.get('Dimensions',{}).get('AGENT'),'value':c.get('Value') if not c.get('MetricResultError') else None,'error':c.get('MetricResultError')} for p in e['pages'] for r in p.get('MetricResults',[]) for c in r.get('Collections',[]) if c['Metric']['Name']==m['field']]
    def load(m):
        total=request(m); vals=rows(total,m); value=vals[0]['value'] if len(vals)==1 else None
        daily=request(m,'DAY'); agents=request(m,group=True)
        return m['id'],{'value':value,'status':'available' if value is not None else 'unavailable','total_evidence':total,'daily_evidence':daily,'agent_evidence':agents,'daily':rows(daily,m),'agents':rows(agents,m)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: metrics=dict(pool.map(load,REG['metrics']))
    validate_units(metrics)
    users=fetch('list-users',{'InstanceId':instance,'MaxResults':100})
    identities={u['Id']:{'id':u['Id'],'username':u['Username'],'name':u['Username'],'source':'ListUsers.Username'} for p in users['pages'] for u in p.get('UserSummaryList',[])}
    ids={r['agent'].split('/')[-1] for m in metrics.values() for r in m['agents'] if r['agent']}
    # Names only: never publish email addresses, phone configuration or other identity fields.
    def name(uid):
        e=fetch('describe-user',{'InstanceId':instance,'UserId':uid})
        u=e['pages'][0].get('User',{}) if e['pages'] else {}; info=u.get('IdentityInfo',{})
        return uid,{'id':uid,'username':u.get('Username',identities.get(uid,{}).get('username',uid)),'name':' '.join(filter(None,[info.get('FirstName'),info.get('LastName')])) or u.get('Username',uid),'source':'DescribeUser.IdentityInfo' if info else 'ListUsers.Username','error':e['error']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for uid,identity in pool.map(name,sorted(ids)): identities[uid]=identity
    result={'retrieved_at':datetime.now(timezone.utc).isoformat(),'period':REG['period'],'queues':qids,'routing_profiles':rpids,'metrics':metrics,'identities':identities,'identity_source':{'list_request':users['request'],'error':users['error'],'name_fields':['User.IdentityInfo.FirstName','User.IdentityInfo.LastName','User.Username'],'key':'User.Id'},'assistant':{'status':'Not independently verified','detail':'No recorded same-scope agent-metric comparison yet. API evidence and documentation are independently available.'}}
    (ROOT/'data/agent-operations-snapshot.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({k:{'value':v['value'],'agents':len(v['agents']),'days':len(v['daily']),'error':v['total_evidence']['error']} for k,v in metrics.items()},indent=2))

def current():
    """Refresh only the sanitized point-in-time roster, not historical totals."""
    path=ROOT/'data/agent-operations-snapshot.json'
    snap=json.loads(path.read_text())
    e=fetch('get-current-user-data',{'InstanceId':CONFIG['instance_id'],'Filters':{'Queues':snap['queues']},'MaxResults':100})
    # Deliberately omit Contacts and all customer/contact identifiers.
    safe=[{k:u.get(k) for k in ['User','Status','AvailableSlotsByChannel','ActiveSlotsByChannel','MaxSlotsByChannel','RoutingProfile']} for p in e['pages'] for u in p.get('UserDataList',[])]
    snap['current']={'operation':e['operation'],'request':e['request'],'retrieved_at':e['retrieved_at'],'error':e['error'],'users':safe if not e['error'] else [],'sanitization':'Selected native agent-state fields only; contact details excluded. Not historical availability.'}
    path.write_text(json.dumps(snap,indent=2))
    print(json.dumps({'current_users':len(safe),'error':e['error']}))

def agent_days():
    path=ROOT/'data/agent-operations-snapshot.json'
    snap=json.loads(path.read_text())
    def load(m):
        req=dict(snap['metrics'][m['id']]['agent_evidence']['request'])
        req['Interval']={'TimeZone':'America/New_York','IntervalPeriod':'DAY'}
        e=fetch('get-metric-data-v2',req)
        rows=[] if e['error'] else [{'start':r.get('MetricInterval',{}).get('StartTime'),'end':r.get('MetricInterval',{}).get('EndTime'),'agent':r.get('Dimensions',{}).get('AGENT'),'value':c.get('Value') if not c.get('MetricResultError') else None,'error':c.get('MetricResultError')} for p in e['pages'] for r in p.get('MetricResults',[]) for c in r.get('Collections',[]) if c['Metric']['Name']==m['field']]
        return m['id'],e,rows
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for key,e,rows in pool.map(load,REG['metrics']):
            snap['metrics'][key]['agent_daily_evidence']=e
            snap['metrics'][key]['agent_daily']=rows
    path.write_text(json.dumps(snap,indent=2))
    print(json.dumps({k:len(v['agent_daily']) for k,v in snap['metrics'].items()}))

if __name__=='__main__':
    import sys
    current() if '--current' in sys.argv else agent_days() if '--agent-days' in sys.argv else run()
