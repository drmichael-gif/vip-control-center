# Phase 2 — PROPOSE-ONLY SQL stubs (Joe package)

**Path:** `/workspace/connect-audit/phase2-proposed-sql/`  
**Generated:** 2026-09-09 America/Bogota (UTC-5)  
**Authority:** Phase 1 live map + archival addendum + Sep 3 warehouse inventory under `/workspace/connect-audit/`

---

## HARD RULE — DO NOT CREATE

| Rule | Detail |
|---|---|
| **PROPOSE ONLY** | Every `.sql` file is a **skeleton for Joe**. Do **not** run against Snowflake until Phase 3. |
| **No APPLY** | No `CREATE`, `ALTER`, `INSERT`, task, stream, or grant execution in Phase 2. |
| **MC decision** | **Wait for `ANALYTICS_CONNECT`**. No temporary PARTIAL binds. **No PARTIAL → MATCH** promotions. |
| **No CORE bind** | Do not bind live Control Center metrics to `CORE_CONTACT_CENTER.FCT_QUEUE_*` / TRUE_SLA as MATCH. |
| **SLA split** | Live `service_level_20` = Amazon native `SERVICE_LEVEL` **threshold 20** only. **Never** use warehouse Derived `TRUE_SLA`. Archival `service_level_lt_30` is a **separate** column/key (threshold 30). |

Every statement in this folder is prefixed / commented:

```text
-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
```

---

## Purpose

Propose the missing contract stack that live inbound registry expects:

1. Land **GetMetricDataV2** envelopes long-form (not wide hybrid queue dumps).
2. Materialize **envelope-keyed** interval + current + campaign facts under `ANALYTICS_CONNECT` (and/or alias `FCT_METRIC_RESULT`).
3. Project **MART_CALL_CENTER.VW_INBOUND_OPERATIONS** for the live inbound **29** `metric_id`s.
4. Document which Phase 1 **MISSING / PARTIAL** rows each stub unlocks — and what remains Derived / CTR-only.

Schemas **do not exist** today (Sep 3 inventory): `ANALYTICS_CONNECT`, `MART_CALL_CENTER`, `RAW_CONNECT`. Closest live stack remains:

`PRD_RAW_DB.AMAZON_CONNECT` → `STAGING_AMAZON_CONNECT` → `INTERMEDIATE_AMAZON_CONNECT` → `CORE_CONTACT_CENTER`.

---

## Dependency order (Phase 3 apply sequence — not now)

| Step | File | Object(s) | Depends on |
|---:|---|---|---|
| 0 | *(infra)* | Create schemas `RAW_CONNECT` (or `PRD_RAW_DB` landing), `ANALYTICS_CONNECT`, `MART_CALL_CENTER` | Warehouse + role grants |
| 1 | `01-raw-metric-result.sql` | `RAW_CONNECT.METRIC_RESULT` (or `PRD_RAW_DB…` landing) | GetMetricDataV2 / GetCurrentMetricData ingest jobs |
| 2 | `02-fct-connect-metric-interval.sql` | `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL` / `FCT_METRIC_RESULT` | Raw metric envelopes |
| 3 | `03-fct-current-snapshot.sql` | `FCT_CONNECT_CURRENT_METRIC_SNAPSHOT` / `SNAPSHOT_QUEUE_CURRENT` | Current-metric landings |
| 4 | `04-fct-campaign-metric-interval.sql` | `FCT_CAMPAIGN_METRIC_INTERVAL` | Campaign metric / report envelopes with `campaign_id` |
| 5 | `05-mart-inbound-operations.sql` | `MART_CALL_CENTER.VW_INBOUND_OPERATIONS` | Interval fact + SLA threshold=20 rows only |
| — | `06-gap-coverage.md` | Documentation only | Phase 1 maps |

**Do not** shortcut by CTAS from `FCT_QUEUE_CONSOLIDATED_METRICS_*` — those are hybrid Amazon+Derived, ET NTZ, no envelope hashes, and overwrite `SERVICE_LEVEL` with TRUE_SLA.

---

## File index

| File | Stub target |
|---|---|
| `00-README.md` | This file |
| `01-raw-metric-result.sql` | Raw GetMetricDataV2 / GetCurrentMetricData envelope landing |
| `02-fct-connect-metric-interval.sql` | Envelope-PK interval fact (`FCT_CONNECT_METRIC_INTERVAL` / `FCT_METRIC_RESULT`) |
| `03-fct-current-snapshot.sql` | Current snapshot for `AGENTS_AVAILABLE` etc. |
| `04-fct-campaign-metric-interval.sql` | Campaign × interval with `campaign_id` |
| `05-mart-inbound-operations.sql` | Live inbound 29-metric projection view |
| `06-gap-coverage.md` | Unlock matrix + remaining Derived/CTR-only |

Companion OOBD: `/workspace/connect-audit/phase2-OOBD.md`

---

## OOBD (Phase 2 package)

| Field | Value |
|---|---|
| **Outcome** | Propose-only SQL skeletons for RAW → ANALYTICS_CONNECT → MART inbound path; no Snowflake objects created. |
| **Owner** | Joe package (Snowflake implementation); Dashboard / Call Center Warehouse map for contract sign-off. |
| **Blocker** | Schemas `ANALYTICS_CONNECT` / `MART_CALL_CENTER` / `RAW_CONNECT` missing; GetMetricDataV2 long-form ingest not landed; MC: wait — no PARTIAL binds. |
| **Next** | Phase 3: create schemas + land envelopes + implement facts/views **after** MC unlock. Keep archival LT30 separate. Never bind TRUE_SLA to `service_level_20`. |

---

## Source maps

- `/workspace/connect-audit/phase1-metric-map-live.md` (+ `.csv`)
- `/workspace/connect-audit/phase1-metric-map-archival.md` (+ `.csv`)
- `/workspace/connect-audit/00-SUMMARY.md`, `05-contract-gaps.md`
