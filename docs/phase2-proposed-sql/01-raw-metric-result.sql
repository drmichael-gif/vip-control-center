-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
-- Joe package — Phase 2 stub
-- Target: RAW_CONNECT.METRIC_RESULT  (alt landing: PRD_RAW_DB.<schema>.METRIC_RESULT / AMAZON_CONNECT_METRIC_RESULT)
-- Purpose: store GetMetricDataV2 (historical) and GetCurrentMetricData envelopes long-form
--          BEFORE pivoting into ANALYTICS_CONNECT facts.
-- Source maps: phase1-metric-map-live.md, 05-contract-gaps.md
-- HARD: do not CTAS from QUEUES_REPORT_* / AGENTS_REPORT_* wide dumps as a substitute for envelopes.
-- HARD: do not run this script against production Snowflake in Phase 2.

/* =============================================================================
   PROPOSE ONLY — schema placeholder (Phase 3 infra)
   ============================================================================= */
-- CREATE SCHEMA IF NOT EXISTS RAW_CONNECT;
-- -- OR land under existing PRD_RAW_DB (preferred if RAW_CONNECT DB/schema not approved):
-- --   PRD_RAW_DB.AMAZON_CONNECT.METRIC_RESULT
-- --   PRD_RAW_DB.RAW_CONNECT.METRIC_RESULT

/* =============================================================================
   PROPOSE ONLY — RAW_CONNECT.METRIC_RESULT
   Grain: one row per Amazon metric result cell inside a request envelope
   (instance × metric × filters × threshold × resource scope × channel ×
    interval/period × request).
   ============================================================================= */

-- CREATE OR REPLACE TABLE RAW_CONNECT.METRIC_RESULT AS
CREATE OR REPLACE TABLE RAW_CONNECT.METRIC_RESULT (
    -- Identity / request envelope
    instance_id                 VARCHAR        COMMENT 'Amazon Connect InstanceId',
    aws_account_id              VARCHAR        COMMENT 'Optional AWS account',
    request_id                  VARCHAR        COMMENT 'API RequestId if available',
    request_hash                VARCHAR        COMMENT 'SHA of normalized request body (metrics+filters+resources+interval)',
    api_name                    VARCHAR        COMMENT 'GetMetricDataV2 | GetCurrentMetricData | GetMetricData',
    ingested_at_utc             TIMESTAMP_NTZ  COMMENT 'Loader clock UTC',
    raw_payload                 VARIANT        COMMENT 'Full response / cell envelope JSON',

    -- Metric identity
    metric_name                 VARCHAR        COMMENT 'Amazon metric name e.g. SERVICE_LEVEL, CONTACTS_QUEUED',
    metric_namespace            VARCHAR        COMMENT 'Optional; Connect historical metrics',
    statistic                   VARCHAR        COMMENT 'If present on metric definition',

    -- Filters / threshold (must survive landing — critical for SL20 vs SL30 vs SUM_*_IN_X)
    metric_filters_json         VARIANT        COMMENT 'InitiationMethod, DisconnectReason, Channel, etc.',
    metric_filters_hash         VARCHAR        COMMENT 'Stable hash of normalized filters',
    threshold_json              VARIANT        COMMENT 'ThresholdComparison + ThresholdValue for SERVICE_LEVEL / SUM_*_IN_X',
    threshold_hash              VARCHAR        COMMENT 'Stable hash; empty hash = no threshold',
    threshold_comparison        VARCHAR        COMMENT 'LT | LTE | GT | GTE — denormalized',
    threshold_value             NUMBER(18,4)   COMMENT 'e.g. 20 for service_level_20; 30 for archival LT30; 5 for abandoned_under_5',

    -- Resource / queue / agent / campaign scope
    queue_scope_json            VARIANT        COMMENT 'Queues[], RoutingProfiles[], Agents[], etc.',
    queue_scope_hash            VARCHAR        COMMENT 'Stable hash of normalized resource ARNs/Ids',
    queue_id                   VARCHAR        COMMENT 'Denormalized single queue if applicable',
    queue_arn                  VARCHAR,
    agent_id                    VARCHAR,
    campaign_id                 VARCHAR        COMMENT 'Outbound campaign Id when present — never drop',
    campaign_arn                VARCHAR,
    channel                     VARCHAR        COMMENT 'VOICE | CHAT | TASK | EMAIL | …',

    -- Time envelope (UTC contract — do not store ET-only NTZ without timezone)
    interval_period             VARCHAR        COMMENT 'FIFTEEN_MIN | HALF_HOUR | HOUR | DAY | WEEK | TOTAL | CURRENT',
    interval_start_utc          TIMESTAMP_NTZ  COMMENT 'Window start UTC',
    interval_end_utc            TIMESTAMP_NTZ  COMMENT 'Window end UTC',
    timezone                    VARCHAR        COMMENT 'IANA e.g. America/New_York — required alongside UTC windows',
    snapshot_ts_utc             TIMESTAMP_NTZ  COMMENT 'For GetCurrentMetricData only',

    -- Value
    metric_value                FLOAT,
    metric_value_count          FLOAT          COMMENT 'Optional count component if API returns structured value',
    metric_value_sum            FLOAT,
    metric_value_max            FLOAT,
    metric_value_min            FLOAT,

    -- Classification / lineage
    source_classification       VARCHAR        COMMENT 'Amazon — always Amazon at raw landing',
    formula_version             VARCHAR        COMMENT 'Contract/formula tag for Control Center',
    source_system               VARCHAR        DEFAULT 'AmazonConnect',

    -- Loader metadata
    file_name                   VARCHAR,
    load_batch_id               VARCHAR,
    _loaded_at                  TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'PROPOSE ONLY / DO NOT CREATE until Phase 3 — GetMetricDataV2 + GetCurrentMetricData envelope landing (long-form).'
;

-- PRIMARY KEY (logical — comment only; Snowflake may use NOT ENFORCED later):
--   PK_CANDIDATE:
--     instance_id,
--     metric_name,
--     metric_filters_hash,
--     threshold_hash,
--     queue_scope_hash,
--     channel,
--     interval_period,
--     interval_start_utc,
--     interval_end_utc,
--     timezone,
--     request_hash
--   For CURRENT snapshots, interval_* may be NULL; use snapshot_ts_utc + same hashes.

/* =============================================================================
   PROPOSE ONLY — empty skeleton pattern (safe shape for Joe CTAS review)
   Demonstrates column list without reading production data.
   ============================================================================= */

-- CREATE OR REPLACE TABLE RAW_CONNECT.METRIC_RESULT AS
SELECT
    CAST(NULL AS VARCHAR)        AS instance_id,
    CAST(NULL AS VARCHAR)        AS aws_account_id,
    CAST(NULL AS VARCHAR)        AS request_id,
    CAST(NULL AS VARCHAR)        AS request_hash,
    CAST(NULL AS VARCHAR)        AS api_name,
    CAST(NULL AS TIMESTAMP_NTZ)  AS ingested_at_utc,
    CAST(NULL AS VARIANT)        AS raw_payload,
    CAST(NULL AS VARCHAR)        AS metric_name,
    CAST(NULL AS VARCHAR)        AS metric_namespace,
    CAST(NULL AS VARCHAR)        AS statistic,
    CAST(NULL AS VARIANT)        AS metric_filters_json,
    CAST(NULL AS VARCHAR)        AS metric_filters_hash,
    CAST(NULL AS VARIANT)        AS threshold_json,
    CAST(NULL AS VARCHAR)        AS threshold_hash,
    CAST(NULL AS VARCHAR)        AS threshold_comparison,
    CAST(NULL AS NUMBER(18,4))   AS threshold_value,
    CAST(NULL AS VARIANT)        AS queue_scope_json,
    CAST(NULL AS VARCHAR)        AS queue_scope_hash,
    CAST(NULL AS VARCHAR)        AS queue_id,
    CAST(NULL AS VARCHAR)        AS queue_arn,
    CAST(NULL AS VARCHAR)        AS agent_id,
    CAST(NULL AS VARCHAR)        AS campaign_id,
    CAST(NULL AS VARCHAR)        AS campaign_arn,
    CAST(NULL AS VARCHAR)        AS channel,
    CAST(NULL AS VARCHAR)        AS interval_period,
    CAST(NULL AS TIMESTAMP_NTZ)  AS interval_start_utc,
    CAST(NULL AS TIMESTAMP_NTZ)  AS interval_end_utc,
    CAST(NULL AS VARCHAR)        AS timezone,
    CAST(NULL AS TIMESTAMP_NTZ)  AS snapshot_ts_utc,
    CAST(NULL AS FLOAT)          AS metric_value,
    CAST(NULL AS FLOAT)          AS metric_value_count,
    CAST(NULL AS FLOAT)          AS metric_value_sum,
    CAST(NULL AS FLOAT)          AS metric_value_max,
    CAST(NULL AS FLOAT)          AS metric_value_min,
    CAST(NULL AS VARCHAR)        AS source_classification,
    CAST(NULL AS VARCHAR)        AS formula_version,
    CAST(NULL AS VARCHAR)        AS source_system,
    CAST(NULL AS VARCHAR)        AS file_name,
    CAST(NULL AS VARCHAR)        AS load_batch_id,
    CAST(NULL AS TIMESTAMP_NTZ)  AS _loaded_at
WHERE 1 = 0
;

-- >>> END PROPOSE ONLY — DO NOT CREATE until Phase 3 <<<
