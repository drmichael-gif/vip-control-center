-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
-- Joe package — Phase 2 stub
-- Targets (aliases — same grain; pick one canonical in Phase 3):
--   ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL   (older contract name)
--   ANALYTICS_CONNECT.FCT_METRIC_RESULT             (live inbound registry expectation)
-- Purpose: Amazon-native metric × interval fact with FULL envelope primary key.
-- HARD: service_level_20 rows MUST be Amazon SERVICE_LEVEL with threshold_value = 20.
--       Do NOT source from CORE_CONTACT_CENTER.FCT_QUEUE_*.SERVICE_LEVEL (Derived TRUE_SLA).
-- HARD: archival service_level_lt_30 is a SEPARATE key (threshold_value = 30) — never overwrite SL20.
-- HARD: no PARTIAL→MATCH; wait for ANALYTICS_CONNECT (MC).

/* =============================================================================
   PROPOSE ONLY — schema placeholder
   ============================================================================= */
-- CREATE SCHEMA IF NOT EXISTS ANALYTICS_CONNECT;

/* =============================================================================
   PROPOSE ONLY — ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL
   (canonical physical table; FCT_METRIC_RESULT may be VIEW synonym)
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL AS
CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL (
    -- ===== FULL ENVELOPE PRIMARY KEY (logical) =====
    -- PK:
    --   instance_id,
    --   metric_name,
    --   metric_filters_hash,
    --   threshold_hash,
    --   queue_scope_hash,
    --   channel,
    --   interval_period,
    --   interval_start_utc,
    --   interval_end_utc,
    --   timezone,
    --   request_hash
    instance_id                 VARCHAR        COMMENT 'PK part — Connect InstanceId',
    metric_name                 VARCHAR        COMMENT 'PK part — Amazon metric name',
    metric_filters_hash         VARCHAR        COMMENT 'PK part — hash of method/disconnect/etc filters',
    threshold_hash              VARCHAR        COMMENT 'PK part — hash of threshold; distinguishes SL20 vs SL30 vs SUM_IN_X',
    queue_scope_hash            VARCHAR        COMMENT 'PK part — hash of queue/agent/routing resource set',
    channel                     VARCHAR        COMMENT 'PK part — VOICE etc.',
    interval_period             VARCHAR        COMMENT 'PK part — HOUR|DAY|FIFTEEN_MIN|…',
    interval_start_utc          TIMESTAMP_NTZ  COMMENT 'PK part — UTC window start',
    interval_end_utc            TIMESTAMP_NTZ  COMMENT 'PK part — UTC window end',
    timezone                    VARCHAR        COMMENT 'PK part — IANA timezone for the window',
    request_hash                VARCHAR        COMMENT 'PK part — normalized request identity',

    -- Denormalized filter / threshold / scope (not PK but required for mart projection)
    metric_filters_json         VARIANT,
    initiation_method           VARCHAR        COMMENT 'INBOUND | TRANSFER | QUEUE_TRANSFER | OUTBOUND | CALLBACK | …',
    disconnect_reason           VARCHAR,
    threshold_comparison        VARCHAR        COMMENT 'LT for service_level_20 / service_level_lt_30',
    threshold_value             NUMBER(18,4)   COMMENT '20 = live SL; 30 = archival LT30; 5/20 = SUM_*_IN_X',
    queue_scope_json            VARIANT,
    queue_id                   VARCHAR,
    queue_name                 VARCHAR,
    agent_id                    VARCHAR,
    campaign_id                 VARCHAR        COMMENT 'NULL for non-campaign interval metrics',

    -- Value + classification
    metric_value                FLOAT,
    source_classification       VARCHAR        COMMENT 'Amazon | Derived — Amazon only for MATCH path',
    source_fact                 VARCHAR        COMMENT 'e.g. RAW_CONNECT.METRIC_RESULT',
    formula_version             VARCHAR,
    refreshed_at_utc            TIMESTAMP_NTZ,

    -- Optional display helpers
    metric_id_hint              VARCHAR        COMMENT 'Optional Control Center metric_id annotation — not PK',
    notes                       VARCHAR
)
COMMENT = 'PROPOSE ONLY / DO NOT CREATE until Phase 3 — envelope-keyed Amazon metric interval fact.'
;

/* =============================================================================
   PROPOSE ONLY — synonym / registry-facing name FCT_METRIC_RESULT
   ============================================================================= */

-- CREATE OR REPLACE VIEW ANALYTICS_CONNECT.FCT_METRIC_RESULT AS
-- SELECT * FROM ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL;

CREATE OR REPLACE VIEW ANALYTICS_CONNECT.FCT_METRIC_RESULT AS
SELECT
    instance_id,
    metric_name,
    metric_filters_hash,
    threshold_hash,
    queue_scope_hash,
    channel,
    interval_period,
    interval_start_utc,
    interval_end_utc,
    timezone,
    request_hash,
    metric_filters_json,
    initiation_method,
    disconnect_reason,
    threshold_comparison,
    threshold_value,
    queue_scope_json,
    queue_id,
    queue_name,
    agent_id,
    campaign_id,
    metric_value,
    source_classification,
    source_fact,
    formula_version,
    refreshed_at_utc,
    metric_id_hint,
    notes
FROM ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL
WHERE 1 = 0   -- PROPOSE ONLY skeleton: empty projection
;

/* =============================================================================
   PROPOSE ONLY — empty CTAS pattern from raw (illustrative; not runnable)
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL AS
SELECT
    r.instance_id,
    r.metric_name,
    r.metric_filters_hash,
    r.threshold_hash,
    r.queue_scope_hash,
    r.channel,
    r.interval_period,
    r.interval_start_utc,
    r.interval_end_utc,
    r.timezone,
    r.request_hash,
    r.metric_filters_json,
    CAST(NULL AS VARCHAR) AS initiation_method,  -- parse from metric_filters_json in Phase 3
    CAST(NULL AS VARCHAR) AS disconnect_reason,
    r.threshold_comparison,
    r.threshold_value,
    r.queue_scope_json,
    r.queue_id,
    CAST(NULL AS VARCHAR) AS queue_name,
    r.agent_id,
    r.campaign_id,
    r.metric_value,
    COALESCE(r.source_classification, 'Amazon') AS source_classification,
    'RAW_CONNECT.METRIC_RESULT' AS source_fact,
    r.formula_version,
    r.ingested_at_utc AS refreshed_at_utc,
    CAST(NULL AS VARCHAR) AS metric_id_hint,
    CAST(NULL AS VARCHAR) AS notes
FROM RAW_CONNECT.METRIC_RESULT r
WHERE 1 = 0
  -- Phase 3: AND r.api_name IN ('GetMetricDataV2', 'GetMetricData')
  -- Phase 3: AND r.interval_period <> 'CURRENT'
;

/* =============================================================================
   PROPOSE ONLY — SLA key reminders (comments for Joe)
   =============================================================================
   Live inbound service_level_20:
     metric_name = 'SERVICE_LEVEL'
     AND threshold_comparison = 'LT'          -- confirm Amazon LT20 semantics
     AND threshold_value = 20
     AND source_classification = 'Amazon'
     -- NEVER join/replace with CORE … SERVICE_LEVEL (TRUE_SLA Derived)

   Archival service_level_lt_30 (separate column/key):
     metric_name = 'SERVICE_LEVEL'
     AND threshold_value = 30
     -- store as distinct rows; do not collapse into SL20
   ============================================================================= */

-- >>> END PROPOSE ONLY — DO NOT CREATE until Phase 3 <<<
