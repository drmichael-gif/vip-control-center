-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
-- Joe package — Phase 2 stub
-- Targets:
--   ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT
--   ANALYTICS_CONNECT.SNAPSHOT_QUEUE_CURRENT   (queue-scoped current depth / agents)
-- Purpose: land GetCurrentMetricData for AGENTS_AVAILABLE and related current metrics.
-- Context: archival available_voice_agents_current was PARTIAL via
--          PRD_RAW_DB.AMAZON_CONNECT.BRANDED_CAMPAIGN_METRICS.AGENTS_AVAILABLE — not contract snapshot.
-- HARD: do not use FCT_CONNECT_AGENT_STATUS_DAILY headcount as AGENTS_AVAILABLE.
-- HARD: PROPOSE ONLY — DO NOT CREATE until Phase 3.

/* =============================================================================
   PROPOSE ONLY — FCT_CONNECT_CURRENT_METRIC_SNAPSHOT
   Grain: snapshot_ts × instance × metric × filters × resource scope × channel
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT AS
CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT (
    -- Logical PK:
    --   instance_id, metric_name, metric_filters_hash, threshold_hash,
    --   queue_scope_hash, channel, snapshot_ts_utc, timezone, request_hash
    instance_id                 VARCHAR        COMMENT 'PK part',
    metric_name                 VARCHAR        COMMENT 'PK part — e.g. AGENTS_AVAILABLE, CONTACTS_IN_QUEUE',
    metric_filters_hash         VARCHAR        COMMENT 'PK part',
    threshold_hash              VARCHAR        COMMENT 'PK part (usually empty for current metrics)',
    queue_scope_hash            VARCHAR        COMMENT 'PK part',
    channel                     VARCHAR        COMMENT 'PK part — VOICE for available_voice_agents_current',
    snapshot_ts_utc             TIMESTAMP_NTZ  COMMENT 'PK part — GetCurrentMetricData observation time UTC',
    timezone                    VARCHAR        COMMENT 'PK part — IANA',
    request_hash                VARCHAR        COMMENT 'PK part',

    metric_filters_json         VARIANT,
    threshold_comparison        VARCHAR,
    threshold_value             NUMBER(18,4),
    queue_scope_json            VARIANT,
    queue_id                   VARCHAR,
    queue_name                 VARCHAR,
    routing_profile_id          VARCHAR,
    agent_id                    VARCHAR,

    metric_value                FLOAT          COMMENT 'AGENTS_AVAILABLE value etc.',
    source_classification       VARCHAR        COMMENT 'Amazon',
    source_fact                 VARCHAR        COMMENT 'RAW_CONNECT.METRIC_RESULT (api_name=GetCurrentMetricData)',
    formula_version             VARCHAR,
    refreshed_at_utc            TIMESTAMP_NTZ
)
COMMENT = 'PROPOSE ONLY / DO NOT CREATE until Phase 3 — current metric snapshot (AGENTS_AVAILABLE etc.).'
;

/* =============================================================================
   PROPOSE ONLY — SNAPSHOT_QUEUE_CURRENT (queue-facing convenience)
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.SNAPSHOT_QUEUE_CURRENT AS
CREATE OR REPLACE TABLE ANALYTICS_CONNECT.SNAPSHOT_QUEUE_CURRENT (
    -- Logical PK: instance_id, queue_scope_hash, channel, snapshot_ts_utc, timezone, request_hash
    instance_id                 VARCHAR,
    queue_scope_hash            VARCHAR,
    queue_id                   VARCHAR,
    queue_name                 VARCHAR,
    channel                     VARCHAR,
    snapshot_ts_utc             TIMESTAMP_NTZ,
    timezone                    VARCHAR,
    request_hash                VARCHAR,

    agents_available            FLOAT          COMMENT 'From metric_name = AGENTS_AVAILABLE',
    agents_on_call              FLOAT          COMMENT 'Optional current metrics if requested',
    agents_staffed              FLOAT,
    contacts_in_queue           FLOAT          COMMENT 'CONTACTS_IN_QUEUE if landed',
    oldest_contact_age_seconds  FLOAT,

    source_classification       VARCHAR        COMMENT 'Amazon',
    source_fact                 VARCHAR,
    formula_version             VARCHAR,
    refreshed_at_utc            TIMESTAMP_NTZ
)
COMMENT = 'PROPOSE ONLY / DO NOT CREATE until Phase 3 — pivoted queue current snapshot.'
;

/* =============================================================================
   PROPOSE ONLY — empty CTAS skeletons
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT AS
SELECT
    r.instance_id,
    r.metric_name,
    r.metric_filters_hash,
    r.threshold_hash,
    r.queue_scope_hash,
    r.channel,
    r.snapshot_ts_utc,
    r.timezone,
    r.request_hash,
    r.metric_filters_json,
    r.threshold_comparison,
    r.threshold_value,
    r.queue_scope_json,
    r.queue_id,
    CAST(NULL AS VARCHAR) AS queue_name,
    CAST(NULL AS VARCHAR) AS routing_profile_id,
    r.agent_id,
    r.metric_value,
    COALESCE(r.source_classification, 'Amazon') AS source_classification,
    'RAW_CONNECT.METRIC_RESULT' AS source_fact,
    r.formula_version,
    r.ingested_at_utc AS refreshed_at_utc
FROM RAW_CONNECT.METRIC_RESULT r
WHERE 1 = 0
  -- Phase 3: AND r.api_name = 'GetCurrentMetricData'
;

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.SNAPSHOT_QUEUE_CURRENT AS
SELECT
    s.instance_id,
    s.queue_scope_hash,
    s.queue_id,
    s.queue_name,
    s.channel,
    s.snapshot_ts_utc,
    s.timezone,
    s.request_hash,
    MAX(IFF(s.metric_name = 'AGENTS_AVAILABLE', s.metric_value, NULL)) AS agents_available,
    MAX(IFF(s.metric_name = 'AGENTS_ON_CALL', s.metric_value, NULL)) AS agents_on_call,
    MAX(IFF(s.metric_name = 'AGENTS_STAFFED', s.metric_value, NULL)) AS agents_staffed,
    MAX(IFF(s.metric_name = 'CONTACTS_IN_QUEUE', s.metric_value, NULL)) AS contacts_in_queue,
    MAX(IFF(s.metric_name = 'OLDEST_CONTACT_AGE', s.metric_value, NULL)) AS oldest_contact_age_seconds,
    'Amazon' AS source_classification,
    'ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT' AS source_fact,
    MAX(s.formula_version) AS formula_version,
    MAX(s.refreshed_at_utc) AS refreshed_at_utc
FROM ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT s
WHERE 1 = 0
GROUP BY 1,2,3,4,5,6,7,8
;

-- >>> END PROPOSE ONLY — DO NOT CREATE until Phase 3 <<<
