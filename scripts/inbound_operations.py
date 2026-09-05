#!/usr/bin/env python3
"""Read-only Connect acquisition and loopback dashboard server. No credentials in browser."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = json.loads((ROOT / 'data/inbound-operations-registry.json').read_text())
TZ = ZoneInfo(REGISTRY['timezone'])
CONFIG = REGISTRY['amazon']
CONFIG = {**CONFIG, **{key:os.environ[env] for key,env in [('region','AWS_REGION'),('profile','AWS_PROFILE'),('account_id','AWS_ACCOUNT_ID'),('instance_id','CONNECT_INSTANCE_ID')] if os.environ.get(env)}}
ENV = os.environ.copy()
for key in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE'):
    ENV.pop(key, None)
ENV.update(AWS_PROFILE=CONFIG['profile'], AWS_PAGER='')
ARN = f"arn:aws:connect:{CONFIG['region']}:{CONFIG['account_id']}:instance/{CONFIG['instance_id']}"

def aws(*args):
    if CONFIG.get('account_id')=='000000000000' or CONFIG.get('instance_id')=='00000000-0000-0000-0000-000000000000':
        raise RuntimeError('Public mapping edition: configure a private AWS profile and deployment identifiers outside source control before pulling data. No credentials are changed by this script.')
    p = subprocess.run(['aws', *args, '--region', CONFIG['region'], '--output', 'json', '--no-cli-pager'], env=ENV, capture_output=True, text=True, timeout=90)
    if p.returncode:
        raise RuntimeError(p.stderr.strip()[:1600])
    return json.loads(p.stdout or '{}')

def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def metric_spec(m):
    spec = {'Name': m['field']}
    if m.get('methods'):
        spec['MetricFilters'] = [{'MetricFilterKey': 'INITIATION_METHOD', 'MetricFilterValues': m['methods']}]
    if m.get('threshold'):
        spec['Threshold'] = [{'Comparison': 'LT', 'ThresholdValue': m['threshold']}]
    return spec

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'))

def spec_key(spec):
    normalized = json.loads(json.dumps(spec))
    for f in normalized.get('MetricFilters', []):
        f.setdefault('Negate', False)
        f['MetricFilterValues'] = sorted(f['MetricFilterValues'])
    for threshold in normalized.get('Threshold', []):
        threshold['ThresholdValue'] = float(threshold['ThresholdValue'])
    return canonical(normalized)

def fetch(start, end, queue='all'):
    first = datetime.fromisoformat(start).replace(tzinfo=TZ)
    last = datetime.fromisoformat(end).replace(tzinfo=TZ) + timedelta(days=1)
    today = datetime.now(TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    if first >= last or last > today or (last-first).days > 31 or (today-first).days > 89:
        raise ValueError('Choose 1–31 completed days within the last 89 days. Today is excluded.')
    q = aws('connect', 'list-queues', '--instance-id', CONFIG['instance_id'], '--queue-types', 'STANDARD', '--max-results', '100')['QueueSummaryList']
    queues = [{'id': x['Id'], 'name': x['Name']} for x in q]
    ids = sorted(x['id'] for x in queues)
    if queue != 'all':
        if queue not in ids:
            raise ValueError('Unknown standard queue.')
        ids = [queue]
    top = [{'FilterKey':'QUEUE','FilterValues':ids}, {'FilterKey':'CHANNEL','FilterValues':['VOICE']}]
    evidence = []
    lock = threading.Lock()
    def request(metrics, interval='TOTAL', a=first, b=last, grouped=False):
        payload = {'ResourceArn':ARN, 'StartTime':iso(a), 'EndTime':iso(b), 'Interval':{'TimeZone':str(TZ),'IntervalPeriod':interval}, 'Filters':top, 'Metrics':metrics}
        if grouped:
            payload['Groupings'] = ['QUEUE']
        pages = []
        base = dict(payload)
        try:
            while True:
                result = aws('connect','get-metric-data-v2','--cli-input-json',json.dumps(payload))
                pages.append(result)
                if result.get('Errors'):
                    raise RuntimeError(json.dumps(result['Errors']))
                if not result.get('NextToken'):
                    break
                payload['NextToken'] = result['NextToken']
            err = None
        except Exception as exc:
            err = str(exc)
        item = {'request':base,'request_hash':hashlib.sha256(canonical(base).encode()).hexdigest(),'pages':pages,'error':err}
        with lock:
            evidence.append(item)
        return item

    native = [m for m in REGISTRY['metrics'] if m.get('field')]
    def total(m):
        r = request([metric_spec(m)])
        values = [c for p in r['pages'] for row in p.get('MetricResults',[]) for c in row.get('Collections',[])]
        valid = [c for c in values if c.get('Value') is not None and not c.get('MetricResultError')]
        good = not r['error'] and len(valid) == 1
        return m['id'], {'value':valid[0]['Value'] if good else None, 'status':'available' if good else 'unavailable', 'error':r['error'] or (None if good else 'No single populated native TOTAL result returned.'), 'request_hash':r['request_hash']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        totals = dict(pool.map(total, native))

    series_ids = ['primary_incoming','primary_answered','primary_abandoned','abandoned_total','queued','abandonment_rate','service_level_20','answer_speed']
    series_specs = [metric_spec(m) for m in native if m['id'] in series_ids and totals[m['id']]['status']=='available']
    spec_ids = {spec_key(metric_spec(m)):m['id'] for m in native}
    chunks = []
    cursor = first
    while cursor < last:
        finish = min(cursor + timedelta(days=2), last)
        chunks.append((cursor,finish))
        cursor = finish
    def hour_pull(chunk):
        return request(series_specs, 'HOUR', *chunk) if series_specs else None
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        hour_results = list(pool.map(hour_pull,chunks))
    daily_result = request(series_specs, 'DAY') if series_specs else {'pages':[]}
    daily = []
    if not daily_result.get('error'):
        for p in daily_result['pages']:
            for row in p.get('MetricResults',[]):
                for c in row.get('Collections',[]):
                    mid = spec_ids.get(spec_key(c['Metric']))
                    if mid and c.get('Value') is not None and not c.get('MetricResultError'):
                        daily.append({'time':row['MetricInterval']['StartTime'],'id':mid,'value':c['Value']})
    hourly = []
    for r in hour_results:
        if not r or r['error']:
            continue
        for page in r['pages']:
            for row in page.get('MetricResults',[]):
                start_time = row.get('MetricInterval',{}).get('StartTime')
                if not start_time:
                    continue
                for c in row.get('Collections',[]):
                    mid = spec_ids.get(spec_key(c['Metric']))
                    if mid and c.get('Value') is not None and not c.get('MetricResultError'):
                        hourly.append({'time':start_time,'id':mid,'value':c['Value']})
    queue_ids = ['primary_incoming','primary_abandoned','queued','abandoned_total','abandonment_rate','service_level_20','answer_speed']
    queue_specs = [metric_spec(m) for m in native if m['id'] in queue_ids and totals[m['id']]['status']=='available']
    qr = request(queue_specs, grouped=True) if queue_specs else {'pages':[]}
    by_queue = {}
    for p in ([] if qr.get('error') else qr['pages']):
        for row in p.get('MetricResults',[]):
            qid = row.get('Dimensions',{}).get('QUEUE','').split('/')[-1]
            if not qid:
                continue
            values = by_queue.setdefault(qid,{})
            for c in row.get('Collections',[]):
                mid = spec_ids.get(spec_key(c['Metric']))
                if mid and c.get('Value') is not None and not c.get('MetricResultError'):
                    values[mid] = c['Value']
    for m in REGISTRY['metrics']:
        if not m.get('derive'):
            continue
        a,b = (totals[x]['value'] for x in m['inputs'])
        good = a is not None and b is not None and a>=b
        totals[m['id']] = {'value': a-b if good else None,'status':'available' if good else 'unavailable','derived':True,'error':None if good else 'Operands unavailable or subset validation failed.'}
    checks = []
    for check in REGISTRY['reconciliations']:
        values = [totals[x]['value'] for x in [check['parent'],*check['children']]]
        ok = all(x is not None for x in values)
        checks.append({'id':check['id'],'status':('pass' if abs(values[0]-sum(values[1:]))<0.001 else 'fail') if ok else 'unavailable'})
    expected_hours = int((last.astimezone(timezone.utc)-first.astimezone(timezone.utc)).total_seconds()/3600)
    for mid in series_ids:
        metric = next(m for m in native if m['id']==mid)
        if metric['unit'] != 'count':
            continue
        points = [p for p in hourly if p['id']==mid]
        full = len({p['time'] for p in points})==expected_hours
        expected = totals[mid]['value']
        reconciled = all(r and not r['error'] for r in hour_results) and expected is not None and abs(sum(p['value'] for p in points)-expected)<0.001
        checks.append({'id':'hourly_'+mid,'status':('pass' if full else 'pass_sparse') if reconciled else 'incomplete','expected_hours':expected_hours,'returned_hours':len(points),'sum':sum(p['value'] for p in points),'note':'Omitted hours are not synthesized as zero; only returned cells are shown. Sum of returned count cells checked against native TOTAL.'})
    return {'version':1,'retrieved_at':iso(datetime.now(timezone.utc)),'start':start,'end':end,'timezone':str(TZ),'queue':queue,'queues':queues,'envelope':{'start_utc':iso(first),'end_utc_exclusive':iso(last),'queue_ids':ids,'channel':'VOICE'},'totals':totals,'hourly':hourly,'daily':daily,'by_queue':by_queue,'checks':checks,'evidence':evidence}

CACHE = {}
PULL_LOCK = threading.Lock()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        u = urlsplit(self.path)
        if u.path != '/api/inbound':
            return super().do_GET()
        try:
            params = parse_qs(u.query)
            args = tuple(params.get(k,[v])[0] for k,v in [('start','2026-08-12'),('end','2026-08-15'),('queue','all')])
            with PULL_LOCK:
                now = datetime.now().timestamp()
                if args not in CACHE or now-CACHE[args][0]>300:
                    CACHE[args] = (now,fetch(*args))
                data = CACHE[args][1]
            self.send_response(200)
        except Exception as exc:
            data = {'error':str(exc)}
            self.send_response(400)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--serve',type=int)
    parser.add_argument('--start',default='2026-08-12')
    parser.add_argument('--end',default='2026-08-15')
    parser.add_argument('--output',default='data/inbound-operations-snapshot.json')
    parser.add_argument('--rebuild-series',action='store_true',help='Reparse saved response metadata without making another API request.')
    args = parser.parse_args()
    if args.rebuild_series:
        snapshot = json.loads((ROOT/args.output).read_text())
        ids = {spec_key(metric_spec(m)):m['id'] for m in REGISTRY['metrics'] if m.get('field')}
        snapshot.update(hourly=[],daily=[],by_queue={})
        for e in snapshot['evidence']:
            if e['error']:
                continue
            period = e['request']['Interval']['IntervalPeriod']
            grouped = e['request'].get('Groupings')==['QUEUE']
            for page in e['pages']:
                for row in page.get('MetricResults',[]):
                    for c in row.get('Collections',[]):
                        mid = ids.get(spec_key(c['Metric']))
                        if not mid or c.get('Value') is None or c.get('MetricResultError'):
                            continue
                        if grouped:
                            qid = row.get('Dimensions',{}).get('QUEUE','').split('/')[-1]
                            if qid:
                                snapshot['by_queue'].setdefault(qid,{})[mid]=c['Value']
                        elif period in ('DAY','HOUR'):
                            snapshot['daily' if period=='DAY' else 'hourly'].append({'time':row['MetricInterval']['StartTime'],'id':mid,'value':c['Value']})
        (ROOT/args.output).write_text(json.dumps(snapshot,indent=2)+'\n')
        print('Rebuilt series from retained API evidence; no new retrieval.')
    elif args.serve:
        print(f'Inbound operations: http://127.0.0.1:{args.serve}',flush=True)
        ThreadingHTTPServer(('127.0.0.1',args.serve),Handler).serve_forever()
    else:
        snapshot = fetch(args.start,args.end)
        (ROOT/args.output).write_text(json.dumps(snapshot,indent=2)+'\n')
        print(json.dumps({'available':sum(v['status']=='available' for v in snapshot['totals'].values()),'unavailable':{k:v['error'] for k,v in snapshot['totals'].items() if v['status']!='available'},'checks':snapshot['checks']}))
