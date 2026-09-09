# Joe Phase 2 — Proposed Snowflake SQL stubs (DO NOT APPLY)

> **PROPOSE ONLY.** Create View sketches for a future `PRD_ANALYTICS_DB.ANALYTICS_CONNECT` / `MART_CALL_CENTER`. Do not run against production. Do not bind Control Center dashboards until envelopes exist.

```sql
-- =============================================================================
-- PROPOSE ONLY — Phase 2 Joe package
-- Target: future ANALYTICS_CONNECT / MART_CALL_CENTER (schemas currently ABSENT)
-- Live stack today: PRD_RAW_DB.AMAZON_CONNECT → STG → INT → CORE_CONTACT_CENTER
-- =============================================================================

-- 1) Amazon-native queue interval with method/threshold envelope (long-form GetMetricDataV2)
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL AS
-- SELECT
--   queue_id,
--   queue_name,
--   interval_start_utc,
--   interval_end_utc,
--   'America/New_York' AS timezone,
--   channel,
--   initiation_method,
--   threshold_comparison,
--   threshold_value,
--   metric_name,
--   metric_value,
--   'Amazon' AS source_classification,
--   metric_filters_hash,
--   queue_scope_hash,
--   formula_version,
--   refreshed_at_utc
-- FROM /* land GetMetricDataV2 long-form — NOT FCT_QUEUE_CONSOLIDATED hybrid */;

-- 2) Expose Derived TRUE_SLA separately from Amazon SERVICE_LEVEL LT20
-- NEVER overwrite Amazon dump SERVICE_LEVEL with TRUE_SLA in the same column.
-- CREATE VIEW MART_CALL_CENTER.VW_QUEUE_SLA_COMPARE AS
-- SELECT
--   q.queue_name,
--   q.interval_start_utc,
--   q.amazon_service_level_20,            -- untouched Amazon native SERVICE_LEVEL threshold 20
--   s.true_sla AS derived_true_sla_20,    -- INT_CONNECT_SERVICE_LEVEL_* formula
--   CAST(NULL AS FLOAT) AS amazon_service_level_30, -- archival LT30; do not fake from TRUE_SLA
--   'Derived mismatch — do not equate TRUE_SLA to Amazon SL20 or LT30' AS warning
-- FROM amazon_queues_service_level_20 q
-- JOIN INT_CONNECT_SERVICE_LEVEL_DAILY s
--   ON q.queue_name = s.queue_name AND q.date_bucket = s.date_bucket;

-- 3) Native abandonment rate only (do not compute abandoned/queued)
-- CREATE VIEW MART_CALL_CENTER.VW_INBOUND_ABANDONMENT_RATE AS
-- SELECT
--   queue_id,
--   interval_start_utc,
--   interval_end_utc,
--   ABANDONMENT_RATE AS queue_abandonment_rate,
--   'Amazon' AS source_classification,
--   metric_filters_hash,
--   queue_scope_hash
-- FROM /* GetMetricDataV2 native ABANDONMENT_RATE only */;

-- 4) Connection-time outbound handled ≠ disconnect-timed handled
-- CREATE VIEW MART_CALL_CENTER.VW_OUTBOUND_HANDLED_CONNECTION AS
-- SELECT
--   queue_id,
--   interval_start_utc,
--   CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME AS handled_connection,
--   'Amazon' AS source_classification
-- FROM /* GetMetricDataV2 */
-- WHERE initiation_method = 'OUTBOUND';
-- -- Do NOT select CONTACTS_HANDLED_OUTBOUND as a substitute.

-- 5) Agent connecting time (activity grain — not a contact count)
-- CREATE VIEW MART_CALL_CENTER.VW_OUTBOUND_AGENT_CONNECTING AS
-- SELECT
--   agent_id,
--   interval_start_utc,
--   SUM_CONNECTING_TIME_AGENT AS connecting_seconds,
--   'Amazon' AS source_classification
-- FROM /* Amazon agent activity dump */;

-- 6) Campaign metrics retain campaign_id; never UNION to direct OUTBOUND legs
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL AS
-- SELECT
--   campaign_arn,
--   campaign_id,
--   interval_start_utc,
--   interval_end_utc,
--   campaign_send_attempts,
--   campaign_contacts_connected,
--   recipients_targeted,
--   campaign_progress_rate,
--   'Amazon' AS source_classification,
--   metric_filters_hash
-- FROM /* wire unused OUTBOUND_CAMPAIGNS_REPORT_* Amazon dump */;

-- 7) Current metric snapshot + agent idle / adherence (missing today)
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT AS
-- SELECT snapshot_ts_utc, AGENTS_AVAILABLE, /* ... */ FROM GetCurrentMetricData landings;
-- CREATE VIEW MART_CALL_CENTER.VW_AGENT_IDLE AS
-- SELECT agent_id, interval_start_utc, SUM_IDLE_TIME_AGENT FROM Amazon agent activity dump;
-- CREATE VIEW MART_CALL_CENTER.VW_AGENT_SCHEDULE_ADHERENCE AS
-- SELECT agent_id, interval_start_utc, AGENT_SCHEDULE_ADHERENCE FROM /* schedule interval facts — not HAS_ATTENDANCE alone */;
```

## Implementation notes for Joe
- Land long-form GetMetricDataV2 before flipping any PARTIAL → MATCH.
- Keep Derived TRUE_SLA as its **own** column forever next to Amazon SL20.
- Archival LT30 stays unmapped until a true Amazon LT30 series exists.
- No dashboard bind until envelope hashes are populated.

## Warehouse Phase 2 propose-only package (Call Center Warehouse)

**Builder hold until Phase 3** = no Snowflake `CREATE` / no dashboard PARTIAL binds. Packaging only.

Authoritative Joe stubs from warehouse audit:
- OOBD: `docs/phase2-OOBD.md`
- SQL stubs `00`–`06`: `docs/phase2-proposed-sql/`
  - `00-README.md` — hard rules
  - `01-raw-metric-result.sql` — RAW envelope landing
  - `02-fct-connect-metric-interval.sql` — ANALYTICS_CONNECT interval facts (Amazon SL20 ≠ TRUE_SLA)
  - `03-fct-current-snapshot.sql` — GetCurrentMetricData snapshot
  - `04-fct-campaign-metric-interval.sql` — campaign_id retained
  - `05-mart-inbound-operations.sql` — MART inbound 29 projection
  - `06-gap-coverage.md` — which stubs unlock which gaps

Every statement is **PROPOSE ONLY / DO NOT CREATE until Phase 3**. Prefer these warehouse stubs over the sketch views above when implementing.
