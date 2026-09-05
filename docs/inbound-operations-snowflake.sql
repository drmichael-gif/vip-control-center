-- Implementation contract; not executed against a live Snowflake warehouse.
CREATE SCHEMA IF NOT EXISTS RAW_CONNECT;
CREATE SCHEMA IF NOT EXISTS ANALYTICS_CONNECT;
CREATE SCHEMA IF NOT EXISTS MART_CALL_CENTER;

CREATE TABLE IF NOT EXISTS RAW_CONNECT.METRIC_RESPONSE (
  request_hash VARCHAR NOT NULL,
  retrieved_at_utc TIMESTAMP_TZ NOT NULL,
  request_json VARIANT NOT NULL,
  response_pages VARIANT,
  error_message VARCHAR,
  contract_version VARCHAR NOT NULL
);

-- IDs resolve to registry entries including native field, filters and threshold.
-- Use queue ID/hash from Dimensions for grouped results, not the all-queue hash.
CREATE TABLE IF NOT EXISTS ANALYTICS_CONNECT.FCT_METRIC_RESULT (
  instance_id VARCHAR NOT NULL,
  metric_id VARCHAR NOT NULL,
  queue_scope_hash VARCHAR NOT NULL,
  channel VARCHAR NOT NULL,
  interval_period VARCHAR NOT NULL,
  interval_start_utc TIMESTAMP_TZ NOT NULL,
  interval_end_utc TIMESTAMP_TZ NOT NULL,
  timezone VARCHAR NOT NULL,
  contract_version VARCHAR NOT NULL,
  request_hash VARCHAR NOT NULL,
  metric_value DOUBLE,
  unit VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  retrieved_at_utc TIMESTAMP_TZ NOT NULL,
  response_json VARIANT
);

-- Deduplicate only compatible reporting envelopes. Do not collapse interval grains.
CREATE OR REPLACE VIEW MART_CALL_CENTER.VW_INBOUND_OPERATIONS AS
SELECT * FROM ANALYTICS_CONNECT.FCT_METRIC_RESULT
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY instance_id, metric_id, queue_scope_hash, channel,
    interval_period, interval_start_utc, interval_end_utc, timezone, contract_version
  ORDER BY CASE WHEN status='available' THEN 0 ELSE 1 END,
    retrieved_at_utc DESC
) = 1;

-- Example derived subset complement. Retain classification = DERIVED downstream.
CREATE OR REPLACE VIEW MART_CALL_CENTER.VW_NON_PRIMARY_ABANDONED AS
SELECT a.instance_id, a.queue_scope_hash, a.channel, a.interval_period,
       a.interval_start_utc, a.interval_end_utc, a.timezone, a.contract_version,
       a.metric_value - b.metric_value AS non_primary_abandoned,
       a.request_hash AS total_request_hash, b.request_hash AS primary_request_hash
FROM MART_CALL_CENTER.VW_INBOUND_OPERATIONS a
JOIN MART_CALL_CENTER.VW_INBOUND_OPERATIONS b
  USING(instance_id, queue_scope_hash, channel, interval_period,
        interval_start_utc, interval_end_utc, timezone, contract_version)
WHERE a.metric_id='abandoned_total' AND b.metric_id='primary_abandoned'
  AND a.status='available' AND b.status='available'
  AND a.metric_value >= b.metric_value;

-- No production unanswered-call semantic view is approved until the cohort
-- interpretation dispute documented in inbound-assistant-verification.json closes.
-- Preserve native TOTAL averages/percentages. Do not AVG hourly averages.
-- ET heatmaps for additive counts only:
-- SELECT DAYOFWEEKISO(CONVERT_TIMEZONE('America/New_York', interval_start_utc)),
--        HOUR(CONVERT_TIMEZONE('America/New_York', interval_start_utc)), SUM(metric_value)
-- FROM MART_CALL_CENTER.VW_INBOUND_OPERATIONS
-- WHERE interval_period='HOUR' AND metric_id=:count_metric AND status='available'
-- GROUP BY 1,2;
