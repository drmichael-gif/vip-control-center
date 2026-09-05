-- Implementation contract, not executed against Snowflake.
-- Store one native result per full request/interval/dimension key. Do not average
-- native averages. Raw request includes resource filters, metric filters, timezone,
-- grouping, metric identifier and interval kind. Strip NextToken for request hash.
CREATE TABLE IF NOT EXISTS FCT_CONNECT_METRIC_INTERVAL (
  INSTANCE_ID VARCHAR NOT NULL,
  METRIC_SPEC_HASH VARCHAR NOT NULL,
  SCOPE_HASH VARCHAR NOT NULL,
  INTERVAL_START TIMESTAMP_TZ NOT NULL,
  INTERVAL_END TIMESTAMP_TZ NOT NULL,
  INTERVAL_PERIOD VARCHAR NOT NULL,
  DIMENSIONS_HASH VARCHAR NOT NULL,
  DIMENSIONS VARIANT,
  METRIC_ID VARCHAR NOT NULL,
  SEMANTIC_ID VARCHAR NOT NULL,
  NATIVE_VALUE DOUBLE,
  NATIVE_UNIT VARCHAR,
  RESULT_STATUS VARCHAR, -- AVAILABLE / EMPTY / ERROR; zero remains AVAILABLE
  RETRIEVED_AT TIMESTAMP_TZ,
  REQUEST_HASH VARCHAR,
  RAW_REQUEST VARIANT,
  RAW_RESPONSE VARIANT,
  PRIMARY KEY (INSTANCE_ID,METRIC_SPEC_HASH,SCOPE_HASH,INTERVAL_START,
               INTERVAL_END,INTERVAL_PERIOD,DIMENSIONS_HASH)
);
-- Snowflake standard-table PKs are informational: enforce uniqueness during load
-- and in tests. MERGE only fully paginated, validated retrievals. Preserve immutable
-- raw evidence outside this latest-result table before replacing late-updated values.

CREATE TABLE IF NOT EXISTS DIM_CONNECT_USER (
  INSTANCE_ID VARCHAR NOT NULL, USER_ID VARCHAR NOT NULL,
  USERNAME VARCHAR, FIRST_NAME VARCHAR, LAST_NAME VARCHAR,
  VALID_FROM TIMESTAMP_TZ NOT NULL, VALID_TO TIMESTAMP_TZ,
  PRIMARY KEY (INSTANCE_ID,USER_ID,VALID_FROM)
);
CREATE TABLE IF NOT EXISTS FCT_CONNECT_USER_SNAPSHOT (
  INSTANCE_ID VARCHAR NOT NULL, USER_ID VARCHAR NOT NULL,
  RETRIEVED_AT TIMESTAMP_TZ NOT NULL, SCOPE_HASH VARCHAR NOT NULL,
  STATUS_NAME VARCHAR, STATUS_START TIMESTAMP_TZ,
  AVAILABLE_VOICE_SLOTS NUMBER, ACTIVE_VOICE_SLOTS NUMBER,
  SANITIZED_RESPONSE VARIANT,
  PRIMARY KEY (INSTANCE_ID,USER_ID,RETRIEVED_AT,SCOPE_HASH)
);
-- JSON acquisition: UserDataList[].User.Id, Status.StatusName,
-- Status.StatusStartTimestamp, AvailableSlotsByChannel.VOICE,
-- ActiveSlotsByChannel.VOICE. Missing keys -> NULL, never COALESCE(...,0).
-- No Contacts array, customer names or telephone numbers in this presentation feed.

CREATE OR REPLACE VIEW VW_AGENT_OPERATIONS AS
SELECT f.*, SPLIT_PART(f.DIMENSIONS:AGENT::VARCHAR,'/',-1) AS AGENT_USER_ID,
  CASE WHEN f.METRIC_ID='AGENT_OCCUPANCY' AND f.NATIVE_UNIT='ratio'
       AND f.NATIVE_VALUE BETWEEN 0 AND 1 THEN f.NATIVE_VALUE*100
       WHEN f.METRIC_ID='AGENT_OCCUPANCY' THEN NULL
       ELSE f.NATIVE_VALUE END AS DISPLAY_VALUE,
  CASE WHEN f.METRIC_ID='AGENT_OCCUPANCY' THEN 'percent'
       ELSE f.NATIVE_UNIT END AS DISPLAY_UNIT,
  CASE WHEN f.METRIC_ID='AGENT_OCCUPANCY' THEN 'DERIVED_DISPLAY_CONVERSION'
       ELSE 'AMAZON_PROVIDED' END AS DISPLAY_CLASSIFICATION
FROM FCT_CONNECT_METRIC_INTERVAL f;
-- Use registry semantic IDs when inserting each metric. Every chart selects exact
-- instance/scope/metric/interval/agent keys. Team TOTAL has empty dimensions; AGENT
-- rows do not get averaged into that team result. Current directory names join by
-- instance+user_id with VALID_TO IS NULL; label that choice as current identity.
-- Historical SCD names can instead join by interval time once history is available.
-- Hours presentation uses NATIVE_VALUE/3600. Never alter stored seconds.
-- Adherence/quality remain schedule/evaluation scoped. No evaluation/handled ratio:
-- evaluation count can exceed contact count and would require a distinct-contact fact.
-- Apply role-limited views for managers before deploying identities or coaching data.
