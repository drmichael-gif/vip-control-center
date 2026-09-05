#!/usr/bin/env python3
"""Read-only API verification. Preserve raw responses; missing never means zero."""
import concurrent.futures
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from inbound_operations import aws, ARN, spec_key

ROOT = Path(__file__).resolve().parents[1]

def run():
    old = json.loads((ROOT / 'data/amazon-connect-live-outbound-2026-08.json').read_text())
    registry = json.loads((ROOT / 'data/outbound-operations-registry.json').read_text())
    base = {'ResourceArn': ARN, 'StartTime': old['request']['start_utc'], 'EndTime': old['request']['end_utc'],
            'Interval': {'TimeZone': 'America/New_York', 'IntervalPeriod': 'TOTAL'},
            'Filters': [{'FilterKey': 'QUEUE', 'FilterValues': old['request']['queue_ids']}, {'FilterKey': 'CHANNEL', 'FilterValues': ['VOICE']}]}
    def request(specs, period='TOTAL', start=None, end=None, campaign=False, grouped=False):
        req = json.loads(json.dumps(base))
        req['Metrics'] = specs
        req['Interval']['IntervalPeriod'] = period
        if start: req['StartTime'] = start
        if end: req['EndTime'] = end
        if campaign:
            req['StartTime'], req['EndTime'] = '2026-08-27T04:00:00Z', '2026-08-29T04:00:00Z'
            req['Filters'] = [{'FilterKey': 'CAMPAIGN', 'FilterValues': [registry['campaign_arn']]}]
        if grouped: req['Groupings'] = ['QUEUE']
        evidence = {'request': json.loads(json.dumps(req)), 'pages': [], 'error': None}
        evidence['hash'] = hashlib.sha256(json.dumps(req, sort_keys=True).encode()).hexdigest()
        try:
            while True:
                page = aws('connect', 'get-metric-data-v2', '--cli-input-json', json.dumps(req))
                evidence['pages'].append(page)
                if page.get('Errors'): raise RuntimeError(json.dumps(page['Errors']))
                if not page.get('NextToken'): break
                req['NextToken'] = page['NextToken']
        except Exception as exc:
            evidence['error'] = str(exc)
        return evidence
    def spec(m):
        result = {'Name': m['field']}
        if m.get('filters'):
            result['MetricFilters'] = [{'MetricFilterKey': k, 'MetricFilterValues': v} for k,v in m['filters'].items()]
        return result
    metrics = [m for m in registry['metrics'] if m.get('field')]
    def total(m):
        e = request([spec(m)], campaign=m.get('scope') == 'campaign')
        values = [c for p in e['pages'] for r in p.get('MetricResults',[]) for c in r.get('Collections',[])
                  if spec_key(c['Metric']) == spec_key(spec(m)) and c.get('Value') is not None and not c.get('MetricResultError')]
        value = values[0]['Value'] if not e['error'] and len(values) == 1 else None
        return m['id'], {'value': value, 'status': 'available' if value is not None else 'unavailable', 'evidence': e}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        totals = dict(pool.map(total, metrics))
    direct = [m for m in metrics if m.get('scope') != 'campaign' and totals[m['id']]['value'] is not None]
    specs = [spec(m) for m in direct]
    id_by_spec = {spec_key(spec(m)): m['id'] for m in direct}
    daily_e = request(specs, 'DAY')
    hourly_specs = [spec(m) for m in direct if m['id'] in ('created','handled')]
    hours_e = [request(hourly_specs, 'HOUR', '2026-08-12T04:00:00Z','2026-08-14T04:00:00Z'),
               request(hourly_specs, 'HOUR', '2026-08-14T04:00:00Z','2026-08-16T04:00:00Z')]
    queue_e = request(hourly_specs, grouped=True)
    def unpack(e):
        if e['error']: return []
        output = []
        for page in e['pages']:
            for row in page.get('MetricResults',[]):
                vals = {id_by_spec.get(spec_key(c['Metric'])): c.get('Value') if not c.get('MetricResultError') else None for c in row.get('Collections',[])}
                vals.pop(None, None)
                output.append({'start':row.get('MetricInterval',{}).get('StartTime'), 'end':row.get('MetricInterval',{}).get('EndTime'), 'dimensions':row.get('Dimensions',{}), 'values':vals})
        return output
    listed = aws('connect','list-queues','--instance-id',old['request']['instance_id'],'--queue-types','STANDARD','--max-results','100')
    names = {q['Id']:q['Name'] for q in listed['QueueSummaryList']}
    result = {'verified_at':datetime.now(timezone.utc).isoformat(), 'scope':base, 'queue_names':names,
              'totals':totals,'daily':unpack(daily_e),'hourly':[r for e in hours_e for r in unpack(e)],
              'queues':unpack(queue_e),'series_evidence':{'daily':daily_e,'hourly':hours_e,'queues':queue_e}}
    (ROOT/'data/outbound-operations-snapshot.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({k:v['value'] for k,v in totals.items()},indent=2))
    print('Daily:',len(result['daily']),'Hourly:',len(result['hourly']),'Queues:',len(result['queues']))

if __name__ == '__main__': run()
