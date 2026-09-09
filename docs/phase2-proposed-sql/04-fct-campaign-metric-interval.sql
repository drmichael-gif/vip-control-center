-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
-- Joe package — Phase 2 stub
-- Target: ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL
-- Purpose: campaign × interval Amazon metrics WITH campaign_id retained.
-- HARD (O5 / Aug 27–28): campaign_sends / campaign_connected / campaign_targeted /
--       campaign_progress are SEPARATE grains — never add as one funnel;
--       never UNION to direct OUTBOUND contact-leg metrics.
-- HARD: do not use CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY as MATCH
--       (Derived centerwide, no campaign_id).
-- HARD: unused PRD_RAW_DB.AMAZON_CONNECT.OUTBOUND_CAMPAIGNS_REPORT_DAILY is a
--       candidate source to wire — still needs envelope + campaign_id discipline.
-- PROPOSE ONLY — DO NOT CREATE until Phase 3.

/* =============================================================================
   PROPOSE ONLY — FCT_CAMPAIGN_METRIC_INTERVAL
   Grain: campaign_id × interval × metric (± channel / filters / request)
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL AS
CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL (
    -- Logical PK:
    --   instance_id, campaign_id, metric_name, metric_filters_hash, threshold_hash,
    --   queue_scope_hash, channel, interval_period,
    --   interval_start_utc, interval_end_utc, timezone, request_hash
    instance_id                 VARCHAR        COMMENT 'PK part',
    campaign_id                 VARCHAR        COMMENT 'PK part — REQUIRED; never drop',
    campaign_arn                VARCHAR,
    campaign_name               VARCHAR,
    metric_name                 VARCHAR        COMMENT 'PK part — CAMPAIGN_SEND_ATTEMPTS, CAMPAIGN_CONTACTS_CONNECTED, RECIPIENTS_TARGETED, CAMPAIGN_PROGRESS_RATE, …',
    metric_filters_hash         VARCHAR        COMMENT 'PK part',
    threshold_hash              VARCHAR        COMMENT 'PK part',
    queue_scope_hash            VARCHAR        COMMENT 'PK part — may be empty if campaign-scoped only',
    channel                     VARCHAR        COMMENT 'PK part',
    interval_period             VARCHAR        COMMENT 'PK part',
    interval_start_utc          TIMESTAMP_NTZ  COMMENT 'PK part',
    interval_end_utc            TIMESTAMP_NTZ  COMMENT 'PK part',
    timezone                    VARCHAR        COMMENT 'PK part',
    request_hash                VARCHAR        COMMENT 'PK part',

    metric_filters_json         VARIANT,
    threshold_comparison        VARCHAR,
    threshold_value             NUMBER(18,4),
    queue_scope_json            VARIANT,

    metric_value                FLOAT,
    -- Optional wide pivots for Joe convenience (still one logical grain each):
    campaign_send_attempts      FLOAT          COMMENT 'Attempt grain — metric CAMPAIGN_SEND_ATTEMPTS',
    campaign_contacts_connected FLOAT          COMMENT 'Contact grain — CAMPAIGN_CONTACTS_CONNECTED',
    recipients_targeted         FLOAT          COMMENT 'Recipient grain — RECIPIENTS_TARGETED',
    campaign_progress_rate      FLOAT          COMMENT 'Native rate — CAMPAIGN_PROGRESS_RATE; do not reconstruct',

    source_classification       VARCHAR        COMMENT 'Amazon',
    source_fact                 VARCHAR        COMMENT 'RAW_CONNECT.METRIC_RESULT or OUTBOUND_CAMPAIGNS_REPORT_* wired with campaign_id',
    formula_version             VARCHAR,
    refreshed_at_utc            TIMESTAMP_NTZ,
    notes                       VARCHAR        COMMENT 'Never funnel-add sends+connected+targeted; never UNION to OUTBOUND legs'
)
COMMENT = 'PROPOSE ONLY / DO NOT CREATE until Phase 3 — campaign×interval with campaign_id.'
;

/* =============================================================================
   PROPOSE ONLY — empty long-form CTAS from raw envelopes
   ============================================================================= */

-- CREATE OR REPLACE TABLE ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL AS
SELECT
    r.instance_id,
    r.campaign_id,
    r.campaign_arn,
    CAST(NULL AS VARCHAR) AS campaign_name,
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
    r.threshold_comparison,
    r.threshold_value,
    r.queue_scope_json,
    r.metric_value,
    IFF(r.metric_name = 'CAMPAIGN_SEND_ATTEMPTS', r.metric_value, NULL) AS campaign_send_attempts,
    IFF(r.metric_name = 'CAMPAIGN_CONTACTS_CONNECTED', r.metric_value, NULL) AS campaign_contacts_connected,
    IFF(r.metric_name = 'RECIPIENTS_TARGETED', r.metric_value, NULL) AS recipients_targeted,
    IFF(r.metric_name = 'CAMPAIGN_PROGRESS_RATE', r.metric_value, NULL) AS campaign_progress_rate,
    COALESCE(r.source_classification, 'Amazon') AS source_classification,
    'RAW_CONNECT.METRIC_RESULT' AS source_fact,
    r.formula_version,
    r.ingested_at_utc AS refreshed_at_utc,
    'Separate attempt/contact/recipient/rate grains — do not funnel-add' AS notes
FROM RAW_CONNECT.METRIC_RESULT r
WHERE 1 = 0
  -- Phase 3: AND r.campaign_id IS NOT NULL
  -- Phase 3: AND r.metric_name IN (
  --   'CAMPAIGN_SEND_ATTEMPTS', 'CAMPAIGN_CONTACTS_CONNECTED',
  --   'RECIPIENTS_TARGETED', 'CAMPAIGN_PROGRESS_RATE', …
  -- )
;

/* =============================================================================
   PROPOSE ONLY — do-not-do reminders
   =============================================================================
   -- BAD: SELECT … FROM CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY
   --      (no campaign_id; Derived API+VOICE centerwide)
   -- BAD: UNION campaign rows with CONTACTS_HANDLED_OUTBOUND queue legs
   -- BAD: campaign_progress_rate = connected / sends  (wrong grains; not native rate)
   ============================================================================= */

-- >>> END PROPOSE ONLY — DO NOT CREATE until Phase 3 <<<
