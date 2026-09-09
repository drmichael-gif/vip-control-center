# Phase 2 OOBD — Joe package (PROPOSE ONLY)

**Path:** `/workspace/connect-audit/phase2-OOBD.md`  
**Package:** `/workspace/connect-audit/phase2-proposed-sql/`  
**When:** 2026-09-09 America/Bogota (UTC-5)  
**Snowflake apply:** **NONE** (hard rule)

---

## OOBD

| Field | Value |
|---|---|
| **Outcome** | Phase 2 propose-only SQL stubs written for Joe: RAW `METRIC_RESULT` → `ANALYTICS_CONNECT` interval / current / campaign facts → `MART_CALL_CENTER.VW_INBOUND_OPERATIONS` (live inbound 29). Every statement marked **PROPOSE ONLY / DO NOT CREATE until Phase 3**. No objects created in Snowflake. |
| **Owner** | Joe package (Snowflake implementation). Contract sign-off: Dashboard / Call Center Warehouse map. MC gate: wait for `ANALYTICS_CONNECT`. |
| **Blocker** | (1) Schemas `ANALYTICS_CONNECT`, `MART_CALL_CENTER`, `RAW_CONNECT` **do not exist** (Sep 3 inventory). (2) GetMetricDataV2 / GetCurrentMetricData **long-form envelopes** not landed (wide `QUEUES_REPORT_*` / hybrid `FCT_QUEUE_*` are not substitutes). (3) MC decision: **no temporary PARTIAL binds**; **no PARTIAL → MATCH**. (4) Live `service_level_20` must not bind to warehouse Derived TRUE_SLA. |
| **Next** | Phase 3 only after MC unlock: create schemas → implement `01`→`05` in dependency order → land Amazon envelopes with full PK hashes → project mart → re-score Phase 1 map. Keep archival `service_level_lt_30` as **separate** threshold-30 key. Do not message other agents from this package. |

---

## Decision log (binding)

| # | Decision |
|---|---|
| D1 | Wait for `ANALYTICS_CONNECT` — no interim CORE/PARTIAL Control Center binds. |
| D2 | No PARTIAL → MATCH promotions in Phase 2. |
| D3 | `service_level_20` = Amazon `SERVICE_LEVEL` **LT20** rows only; never TRUE_SLA. |
| D4 | Archival `service_level_lt_30` = separate column/key threshold **30**. |
| D5 | Campaign metrics retain `campaign_id`; never funnel-add; never UNION to OUTBOUND legs. |
| D6 | `ABANDONMENT_RATE` native only — no abandoned/queued arithmetic. |
| D7 | Stubs use `WHERE 1=0` / empty CTAS / commented CREATE — enough for Joe to implement, not production-runnable without Phase 3. |

---

## Deliverable paths

```
/workspace/connect-audit/phase2-proposed-sql/00-README.md
/workspace/connect-audit/phase2-proposed-sql/01-raw-metric-result.sql
/workspace/connect-audit/phase2-proposed-sql/02-fct-connect-metric-interval.sql
/workspace/connect-audit/phase2-proposed-sql/03-fct-current-snapshot.sql
/workspace/connect-audit/phase2-proposed-sql/04-fct-campaign-metric-interval.sql
/workspace/connect-audit/phase2-proposed-sql/05-mart-inbound-operations.sql
/workspace/connect-audit/phase2-proposed-sql/06-gap-coverage.md
/workspace/connect-audit/phase2-OOBD.md
```
