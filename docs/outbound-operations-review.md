# Outbound verification and chart review — September 4, 2026

## Result

All 17 native values were freshly reproduced through GetMetricDataV2. Thirteen are direct OUTBOUND metrics for August 12–15 ET; four belong to one campaign for August 27–28 ET. These are historical, completed periods, not today's changing data.

Connect Assistant independently returned five matching totals without being supplied the expected values: handled outbound 2,647; campaign send attempts 44; campaign contacts connected 7; targeted recipients 85; campaign progress 100%. The Assistant's exact queue-ID envelope is not exposed. A value match is not proof of identical internal request envelopes or verification of every daily/hourly/queue point.

An independent follow-up also matched each handled DAY value: August 12 = 898, August 13 = 859, August 14 = 851, August 15 = 39. The dashboard marks only this daily series as Assistant-matched; created, other daily measures, hourly and queue breakdowns retain API-only comparison status. The Assistant subsequently accepted the documented distinction between its own filtering limitation and the V2 API's supported OUTBOUND filters.

Current sources: `data/outbound-operations-registry.json`, `data/outbound-operations-snapshot.json`, and `data/outbound-assistant-verification.json`. At the user's request, superseded outbound tables and the old-reference disclosure are removed from the page. The final dictionary reuses the inbound reference's topic navigation, search, expandable definitions, and Amazon/Snowflake technical disclosures. Current limitations and raw evidence remain; no metric values or acquisition mappings changed in this presentation cleanup.

## Findings

1. Native fields and OUTBOUND metric filters were accepted. The Assistant cannot apply many of these filters; its larger all-method counts are different scopes, not replacements.
2. Handled outbound is agent-connected workload, not confirmed human customer reach. The native legacy label maps to V2 `CONTACTS_HANDLED` plus the OUTBOUND metric filter. Do not send legacy `CONTACTS_HANDLED_OUTBOUND` as a V2 identifier.
3. `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME` counts connections in the connection-timestamp interval. The prior description of a measurable connected-duration interval was wrong. Its 2,647 happens to match disconnect-timed handled in this window, but the definitions remain distinct.
4. `CONTACTS_HOLD_ABANDONS` includes both agent and customer disconnects while on hold. The previous customer-only wording was too narrow.
5. Native transfer-out includes transfers before agent connection. Do not assert it is always a handled-child population.
6. `SUM_CONNECTING_TIME_AGENT` is agent activity-driven connecting time; the handbook explicitly documents an OUTBOUND metric filter. Do not adopt the Assistant's contrary filter/time-basis assertion.
7. The 175 created-minus-handled remainder is correct arithmetic but is not certified as 175 customer non-answers. CREATED attribution remains disputed with the Assistant, and record-level population verification is unavailable. It is provisional and excluded from the core performance cards.
8. The old dashboard's 120 campaign abandonments and assertions about targets/trends were illustrative/unsubstantiated. They have been removed from the current dictionary; this review records why they were excluded.
9. The previous card API examples showed Aug 1–28 while displaying Aug 12–15 values, and used incorrect resource-filter syntax for initiation method. New source entries show actual successful request JSON, exact dates, both metric filters where applicable, and response hashes.
10. Campaign connected eligibility depends on answering machine detection: HUMAN_ANSWERED only when detection is enabled; all connected contacts when disabled. This field applies to agent-assisted delivery. Campaign progress is attempted recipients / targeted recipients, not sends / targets or customer connection rate. No 7/44 conversion-rate claim is promoted as a native metric.
11. The old `pull()` helper defaulted absent collections to zero. The verification extractor does not: null, error, and explicit zero stay distinct, with all response pages retained.
12. The old prototype verification script contains hardcoded mock equations; its passing results do not prove API correctness. Use the new raw-evidence and chart checks for the current outbound view.

## Charts and dates

Nine charts (eight mapped families): daily created/handled; handled timing comparison; date/hour handled heat map; disconnect reason bars; daily hold/transfer; daily interaction/wrap; daily connecting seconds; top-six handled queues; campaign audience/attempt/connection comparison. Each metric links to its current dictionary definition. Charts use native DAY/HOUR/QUEUE values, not allocations from period totals.

Direct date controls filter only the loaded August 12–15 interval. Disjoint DAY counts may be summed, but daily averages are never averaged into a multi-day average. Queue ranking remains full-window only, and is explicitly unavailable for subranges. Campaign dates remain separately labeled August 27–28. Missing hours remain hatched/unavailable even where the sum of returned hours equals the native total. Chart families retain native grain and are not stacked unless a proven partition applies.

## Authoritative sources

- [Amazon metric definitions](https://docs.aws.amazon.com/connect/latest/adminguide/metrics-definitions.html)
- [Historical reporting timestamp rules](https://docs.aws.amazon.com/connect/latest/adminguide/historical-metrics.html)
- [GetMetricDataV2 identifiers and filters](https://docs.aws.amazon.com/connect/latest/APIReference/API_GetMetricDataV2.html)
- [Outbound campaign definitions](https://docs.aws.amazon.com/connect/latest/adminguide/outbound-campaign-metrics.html)

The handbook governs definitions; real API requests establish retrieval. Assistant results are independent comparison evidence, not authoritative overrides of documented API capabilities.
