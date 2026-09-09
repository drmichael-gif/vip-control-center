# Joe Phase 2 — Executive scorecard (zero-variance)

**Package date:** 2026-09-09 (America/Bogota)  
**Product rule (locked):** no temporary PARTIAL dashboard binds; wait for envelope facts. Phase 2 = documentation + proposed SQL only.

## Live scorecard (authoritative)

| Domain | MATCH | PARTIAL | MISSING | Total |
|---|---:|---:|---:|---:|
| inbound | 0 | 22 | 7 | 29 |
| outbound | 0 | 12 | 6 | 18 |
| agent | 0 | 13 | 2 | 15 |
| **LIVE TOTAL** | **0** | **47** | **15** | **62** |

## Archival centerwide stubs (Joe-only; UI retired)

| MATCH | PARTIAL | MISSING | Total |
|---:|---:|---:|---:|
| 0 | 7 | 3 | 10 |

Archival `service_level_lt_30_seconds` and `queue_abandonment_rate` stay **MISSING** / unmapped to CORE. Never equate archival LT30 to live `service_level_20` or warehouse Derived TRUE_SLA.

## Warehouse reality

- **ANALYTICS_CONNECT absent** (also no `MART_CALL_CENTER` / `RAW_CONNECT` as contract schemas).
- Live stack only: `PRD_RAW_DB.AMAZON_CONNECT` → `STAGING_AMAZON_CONNECT` → `INTERMEDIATE_AMAZON_CONNECT` → `CORE_CONTACT_CENTER`.
- Closest facts: `FCT_QUEUE_CONSOLIDATED_METRICS_*`, `FCT_AGENT_*`, `FCT_OUTBOUND_CAMPAIGN_HOURLY`.
- Zero Control Center envelope columns (`window_*_utc`, `queue_scope_hash`, `metric_filters_hash`, `source_classification`, `formula_version`) → name matches stay PARTIAL.

## Critical do-not-ship without resolving

1. `service_level_20` (Amazon native LT20) ≠ warehouse `SERVICE_LEVEL` (Derived TRUE_SLA 20s).
2. `ABANDONMENT_RATE` absent — no abandoned/queued arithmetic substitute.
3. Incoming 3-method `CONTACTS_CREATED` envelope not retained.
4. Outbound connection-time handled ≠ disconnect handled; `connecting` is activity-seconds.
5. Campaign sends/connected/targeted/progress are separate grains — never one funnel.
6. Agent idle / schedule adherence / current snapshot missing.
7. No envelope hashes anywhere.

## Pointers

- Glossary: `docs/joe-phase2-metric-glossary.md`
- Lineage: `docs/joe-phase2-lineage.md` + `data/joe-phase2-lineage.csv`
- Proposed SQL (stubs only): `docs/joe-phase2-proposed-sql.md`
- Phase 1 provenance: `docs/phase1-metric-map-live.md`, `data/phase1-metric-map-live.csv`, archival pair
