-- >>> PROPOSE ONLY / DO NOT CREATE until Phase 3 <<<
-- Joe package — Phase 2 stub
-- Target: MART_CALL_CENTER.VW_INBOUND_OPERATIONS
-- Purpose: project live inbound registry 29 metric_ids from ANALYTICS_CONNECT
--          envelope facts (FCT_METRIC_RESULT / FCT_CONNECT_METRIC_INTERVAL).
-- Authority: inbound-operations-registry.json via phase1-metric-map-live.*
-- HARD: service_level_20 FROM Amazon SERVICE_LEVEL rows with threshold_value = 20 ONLY.
--       NEVER select CORE_CONTACT_CENTER … SERVICE_LEVEL / TRUE_SLA.
-- HARD: archival service_level_lt_30 is NOT a column on this live view.
-- HARD: Derived remainders (primary_not_answered, non_primary_abandoned) only if both
--       legs are Amazon-native same envelope — else leave NULL / exclude until Phase 3 rules.
-- HARD: no PARTIAL binds; wait for ANALYTICS_CONNECT (MC).
-- PROPOSE ONLY — DO NOT CREATE until Phase 3.

/* =============================================================================
   PROPOSE ONLY — schema placeholder
   ============================================================================= */
-- CREATE SCHEMA IF NOT EXISTS MART_CALL_CENTER;

/* =============================================================================
   PROPOSE ONLY — helper filter comments (Joe implements as CTEs)
   Live inbound Amazon metric_name map (29):
     primary_incoming          <- CONTACTS_CREATED          filters: INBOUND
     primary_answered          <- CONTACTS_HANDLED           filters: INBOUND
     primary_not_answered      <- Derived (incoming − answered) same envelope only
     incoming_total            <- CONTACTS_CREATED          filters: INBOUND+TRANSFER+QUEUE_TRANSFER
     incoming_transfer         <- CONTACTS_CREATED          filters: TRANSFER
     incoming_queue_transfer   <- CONTACTS_CREATED          filters: QUEUE_TRANSFER
     incoming_handled          <- CONTACTS_HANDLED           filters: INBOUND+TRANSFER+QUEUE_TRANSFER
     abandoned_total           <- CONTACTS_ABANDONED         (scope per registry)
     primary_abandoned         <- CONTACTS_ABANDONED         filters: primary/INBOUND
     non_primary_abandoned     <- Derived (total − primary) same envelope only
     queued                    <- CONTACTS_QUEUED
     abandonment_rate          <- ABANDONMENT_RATE          native only — no arithmetic
     service_level_20          <- SERVICE_LEVEL             threshold LT 20 ONLY
     answer_speed              <- AVG_QUEUE_ANSWER_TIME
     abandon_wait              <- AVG_ABANDON_TIME
     max_queue_wait            <- MAX_QUEUED_TIME
     answered_under_20         <- SUM_CONTACTS_ANSWERED_IN_X  threshold 20
     abandoned_under_5         <- SUM_CONTACTS_ABANDONED_IN_X  threshold 5
     abandoned_under_20        <- SUM_CONTACTS_ABANDONED_IN_X  threshold 20
     handle_time               <- AVG_HANDLE_TIME
     interaction_time          <- AVG_INTERACTION_TIME        + INBOUND filter if required
     wrap_time                 <- AVG_AFTER_CONTACT_WORK_TIME + INBOUND filter if required
     hold_time                 <- AVG_HOLD_TIME
     held_contacts             <- CONTACTS_PUT_ON_HOLD
     hold_disconnects          <- CONTACTS_HOLD_ABANDONS
     non_response              <- AGENT_NON_RESPONSE          offer-attempt grain
     agent_answer_rate         <- AGENT_ANSWER_RATE           non-additive
     transferred_out           <- CONTACTS_TRANSFERRED_OUT
     queue_transferred_out     <- CONTACTS_TRANSFERRED_OUT_FROM_QUEUE
   ============================================================================= */

-- CREATE OR REPLACE VIEW MART_CALL_CENTER.VW_INBOUND_OPERATIONS AS
CREATE OR REPLACE VIEW MART_CALL_CENTER.VW_INBOUND_OPERATIONS AS
WITH
-- PROPOSE ONLY: Amazon-native interval rows (empty until Phase 3 landings)
base AS (
    SELECT
        f.instance_id,
        f.queue_scope_hash,
        f.queue_id,
        f.queue_name,
        f.channel,
        f.interval_period,
        f.interval_start_utc,
        f.interval_end_utc,
        f.timezone,
        f.metric_filters_hash,
        f.request_hash,
        f.metric_name,
        f.threshold_comparison,
        f.threshold_value,
        f.initiation_method,
        f.metric_value,
        f.source_classification,
        f.formula_version,
        f.refreshed_at_utc
    FROM ANALYTICS_CONNECT.FCT_METRIC_RESULT f
    -- Prefer FCT_METRIC_RESULT; equivalent: FCT_CONNECT_METRIC_INTERVAL
    WHERE 1 = 0  -- PROPOSE ONLY skeleton
      AND f.source_classification = 'Amazon'
),
-- Pivot helpers (illustrative — Joe may use conditional aggregation or join-per-metric)
pivoted AS (
    SELECT
        instance_id,
        queue_scope_hash,
        queue_id,
        queue_name,
        channel,
        interval_period,
        interval_start_utc,
        interval_end_utc,
        timezone,
        metric_filters_hash,
        request_hash,
        formula_version,
        MAX(refreshed_at_utc) AS refreshed_at_utc,

        -- 1 primary_incoming
        MAX(IFF(metric_name = 'CONTACTS_CREATED'
                AND initiation_method = 'INBOUND', metric_value, NULL)) AS primary_incoming,
        -- 2 primary_answered
        MAX(IFF(metric_name = 'CONTACTS_HANDLED'
                AND initiation_method = 'INBOUND', metric_value, NULL)) AS primary_answered,
        -- 3 primary_not_answered (Derived — only if both Amazon legs present; else NULL)
        CAST(NULL AS FLOAT) AS primary_not_answered,
        -- 4 incoming_total (3-method parent — filters hash must encode INBOUND+TRANSFER+QUEUE_TRANSFER)
        MAX(IFF(metric_name = 'CONTACTS_CREATED'
                AND initiation_method IS NULL /* placeholder: 3-method parent filter */,
                metric_value, NULL)) AS incoming_total,
        -- 5 incoming_transfer
        MAX(IFF(metric_name = 'CONTACTS_CREATED'
                AND initiation_method = 'TRANSFER', metric_value, NULL)) AS incoming_transfer,
        -- 6 incoming_queue_transfer
        MAX(IFF(metric_name = 'CONTACTS_CREATED'
                AND initiation_method = 'QUEUE_TRANSFER', metric_value, NULL)) AS incoming_queue_transfer,
        -- 7 incoming_handled
        MAX(IFF(metric_name = 'CONTACTS_HANDLED'
                AND initiation_method IS NULL /* 3-method handled parent */,
                metric_value, NULL)) AS incoming_handled,
        -- 8 abandoned_total
        MAX(IFF(metric_name = 'CONTACTS_ABANDONED'
                AND initiation_method IS NULL /* all-origins abandoned */,
                metric_value, NULL)) AS abandoned_total,
        -- 9 primary_abandoned
        MAX(IFF(metric_name = 'CONTACTS_ABANDONED'
                AND initiation_method = 'INBOUND', metric_value, NULL)) AS primary_abandoned,
        -- 10 non_primary_abandoned (Derived)
        CAST(NULL AS FLOAT) AS non_primary_abandoned,
        -- 11 queued
        MAX(IFF(metric_name = 'CONTACTS_QUEUED', metric_value, NULL)) AS queued,
        -- 12 abandonment_rate — NATIVE ONLY
        MAX(IFF(metric_name = 'ABANDONMENT_RATE', metric_value, NULL)) AS abandonment_rate,
        -- 13 service_level_20 — Amazon LT20 ONLY (NOT TRUE_SLA, NOT threshold 30)
        MAX(IFF(metric_name = 'SERVICE_LEVEL'
                AND threshold_value = 20
                AND COALESCE(threshold_comparison, 'LT') = 'LT',
                metric_value, NULL)) AS service_level_20,
        -- 14 answer_speed
        MAX(IFF(metric_name = 'AVG_QUEUE_ANSWER_TIME', metric_value, NULL)) AS answer_speed,
        -- 15 abandon_wait
        MAX(IFF(metric_name = 'AVG_ABANDON_TIME', metric_value, NULL)) AS abandon_wait,
        -- 16 max_queue_wait
        MAX(IFF(metric_name = 'MAX_QUEUED_TIME', metric_value, NULL)) AS max_queue_wait,
        -- 17 answered_under_20
        MAX(IFF(metric_name = 'SUM_CONTACTS_ANSWERED_IN_X'
                AND threshold_value = 20, metric_value, NULL)) AS answered_under_20,
        -- 18 abandoned_under_5
        MAX(IFF(metric_name = 'SUM_CONTACTS_ABANDONED_IN_X'
                AND threshold_value = 5, metric_value, NULL)) AS abandoned_under_5,
        -- 19 abandoned_under_20
        MAX(IFF(metric_name = 'SUM_CONTACTS_ABANDONED_IN_X'
                AND threshold_value = 20, metric_value, NULL)) AS abandoned_under_20,
        -- 20 handle_time
        MAX(IFF(metric_name = 'AVG_HANDLE_TIME', metric_value, NULL)) AS handle_time,
        -- 21 interaction_time
        MAX(IFF(metric_name = 'AVG_INTERACTION_TIME', metric_value, NULL)) AS interaction_time,
        -- 22 wrap_time
        MAX(IFF(metric_name = 'AVG_AFTER_CONTACT_WORK_TIME', metric_value, NULL)) AS wrap_time,
        -- 23 hold_time
        MAX(IFF(metric_name = 'AVG_HOLD_TIME', metric_value, NULL)) AS hold_time,
        -- 24 held_contacts
        MAX(IFF(metric_name = 'CONTACTS_PUT_ON_HOLD', metric_value, NULL)) AS held_contacts,
        -- 25 hold_disconnects
        MAX(IFF(metric_name = 'CONTACTS_HOLD_ABANDONS', metric_value, NULL)) AS hold_disconnects,
        -- 26 non_response (offer-attempt grain — do not mix with contact-leg)
        MAX(IFF(metric_name = 'AGENT_NON_RESPONSE', metric_value, NULL)) AS non_response,
        -- 27 agent_answer_rate (non-additive)
        MAX(IFF(metric_name = 'AGENT_ANSWER_RATE', metric_value, NULL)) AS agent_answer_rate,
        -- 28 transferred_out
        MAX(IFF(metric_name = 'CONTACTS_TRANSFERRED_OUT', metric_value, NULL)) AS transferred_out,
        -- 29 queue_transferred_out
        MAX(IFF(metric_name = 'CONTACTS_TRANSFERRED_OUT_FROM_QUEUE', metric_value, NULL)) AS queue_transferred_out

    FROM base
    GROUP BY
        instance_id, queue_scope_hash, queue_id, queue_name, channel,
        interval_period, interval_start_utc, interval_end_utc, timezone,
        metric_filters_hash, request_hash, formula_version
)
SELECT
    instance_id,
    queue_scope_hash,
    queue_id,
    queue_name,
    channel,
    interval_period,
    interval_start_utc AS window_start_utc,
    interval_end_utc   AS window_end_utc,
    timezone,
    metric_filters_hash,
    request_hash,
    -- Live inbound 29 metric_id columns
    primary_incoming,
    primary_answered,
    -- Derived remainder: Phase 3 may set
    --   primary_not_answered = primary_incoming - primary_answered
    -- only when both are Amazon same envelope; until then keep NULL
    primary_not_answered,
    incoming_total,
    incoming_transfer,
    incoming_queue_transfer,
    incoming_handled,
    abandoned_total,
    primary_abandoned,
    non_primary_abandoned,
    queued,
    abandonment_rate,
    service_level_20,          -- Amazon LT20 only — NOT warehouse TRUE_SLA
    answer_speed,
    abandon_wait,
    max_queue_wait,
    answered_under_20,
    abandoned_under_5,
    abandoned_under_20,
    handle_time,
    interaction_time,
    wrap_time,
    hold_time,
    held_contacts,
    hold_disconnects,
    non_response,
    agent_answer_rate,
    transferred_out,
    queue_transferred_out,
    -- Lineage envelope
    'Amazon' AS source_classification,
    'ANALYTICS_CONNECT.FCT_METRIC_RESULT' AS source_fact,
    formula_version,
    refreshed_at_utc,
    -- Guardrail flags for consumers
    'PROPOSE ONLY — DO NOT CREATE until Phase 3' AS _stub_banner,
    'service_level_20=Amazon SERVICE_LEVEL threshold 20; archival LT30 excluded' AS _sla_rule
FROM pivoted
WHERE 1 = 0  -- PROPOSE ONLY: empty view body until Phase 3
;

/* =============================================================================
   PROPOSE ONLY — explicit anti-patterns (do not implement)
   =============================================================================
   -- BAD: service_level_20 = CORE_CONTACT_CENTER.FCT_QUEUE_*.SERVICE_LEVEL
   -- BAD: service_level_20 = INT_CONNECT_SERVICE_LEVEL_*.TRUE_SLA
   -- BAD: abandonment_rate = abandoned_total / queued
   -- BAD: SELECT … FROM FCT_QUEUE_CONSOLIDATED_METRICS_* as VW_INBOUND_OPERATIONS
   -- BAD: include service_level_lt_30 on this live inbound view
   -- BAD: PARTIAL→MATCH while envelope facts absent (MC)
   ============================================================================= */

-- Older mart contract name (optional synonym — still PROPOSE ONLY):
-- CREATE OR REPLACE VIEW MART_CALL_CENTER.FCT_INBOUND_DAILY AS
-- SELECT … FROM MART_CALL_CENTER.VW_INBOUND_OPERATIONS
-- WHERE interval_period = 'DAY';

-- >>> END PROPOSE ONLY — DO NOT CREATE until Phase 3 <<<
