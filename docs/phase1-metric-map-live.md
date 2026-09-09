# Phase 1 — Live metric map (contracts/definitions only)

**Path:** `/workspace/connect-audit/phase1-metric-map-live.md`  
**Companion CSV:** `/workspace/connect-audit/phase1-metric-map-live.csv`  
**Scope:** LIVE registries only — inbound 29 + outbound 18 + agent 15 = 62. Archival centerwide 10 **deferred**.  
**No SELECT parity** — FR_MONITOR denied; mapping from DDL + registry contracts.  
**Generated:** 2026-09-09 America/Bogota (UTC-5).

---

## OOBD — Out of Band Decisions / Hard Rules

| # | Rule |
|---|---|
| O1 | **Never** silently equate warehouse `SERVICE_LEVEL` (Derived TRUE_SLA 20s = answered_within_20 / (offered − short_abandons_5s)) to live inbound `service_level_20` (Amazon native `SERVICE_LEVEL` threshold 20) or to archival LT30. Status must stay **PARTIAL** with explicit Derived-mismatch gap note. |
| O2 | **Never** mix contact-leg vs offer-attempt grains (e.g. `CONTACTS_HANDLED` vs `AGENT_NON_RESPONSE`). |
| O3 | **Never** mix initiation-time vs disconnect-time bases; **never** equate connection-time `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME` to disconnect-timed `CONTACTS_HANDLED`. |
| O4 | Outbound `connecting` = **agent-activity** `SUM_CONNECTING_TIME_AGENT` — not a contact count. |
| O5 | Campaign `campaign_sends` / `campaign_connected` / `campaign_targeted` / `campaign_progress` are **separate** attempt / contact / recipient / rate grains (Aug 27–28 campaign scope). **Never** add as one funnel; **never** UNION to direct OUTBOUND legs. |
| O6 | `ABANDONMENT_RATE` is Amazon-native non-additive — **do not** substitute `abandoned/queued` arithmetic. |
| O7 | Status **MATCH** requires same Amazon metric name **and** compatible grain **and** same classification **and** usable filters/envelope. Almost none qualify without envelope → expect near-zero MATCH. |
| O8 | Live stack only: `PRD_RAW_DB.AMAZON_CONNECT` → `STAGING_AMAZON_CONNECT` → `INTERMEDIATE_AMAZON_CONNECT` → `CORE_CONTACT_CENTER`. No `ANALYTICS_CONNECT` / `MART_CALL_CENTER` / `RAW_CONNECT`. |
| O9 | Use outbound registry **id + semantic_name** pairs in the outbound table labels. |
| O10 | Archival centerwide 10 deferred to follow-up map. |

---

## 1) Summary counts

| Domain | MATCH | PARTIAL | MISSING | Total |
|---|---:|---:|---:|---:|
| inbound | 0 | 22 | 7 | 29 |
| outbound | 0 | 12 | 6 | 18 |
| agent | 0 | 13 | 2 | 15 |
| **LIVE TOTAL** | **0** | **47** | **15** | **62** |

---

## 2) Tables by domain

### Inbound (29) — authority `inbound-operations-registry.json`

| metric_id | contract class | Amazon field/filters/threshold | live warehouse object.column | status | warehouse grain | warehouse Amazon-vs-Derived | gap notes |
|---|---|---|---|---|---|---|---|
| primary_incoming | Amazon | CONTACTS_CREATED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_CREATED | TOTAL_INBOUND | CONTACTS_CREATED_INBOUND(stg daily only)` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Hybrid | Amazon dump CONTACTS_CREATED is unfiltered all-methods; method filter INBOUND not stored as envelope. TOTAL_INBOUND is Derived CTR initiation-count (contact-leg, initiation-time bucket) — do NOT equate to Amazon CONTACTS_CREATED INBOUND without labeling. CONTACTS_CREATED_INBOUND on staging daily not carried to core hourly. No Control Center envelope (window_*_utc, queue_scope_hash, metric_filters_hash, source_classification, formula_version). |
| primary_answered | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HANDLED_INBOUND | CONTACTS_ANSWERED_INBOUND` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Hybrid | Amazon CONTACTS_HANDLED_INBOUND on queue dump ≈ filtered handled; Derived CONTACTS_ANSWERED_INBOUND is CTR CONTACT_TYPE=ANSWERED×INBOUND (disconnect/contact taxonomy) — not identical to Amazon handled. No method envelope hash. Do not mix with offer-attempt grain. |
| primary_not_answered | Derived | (derive) primary_incoming − primary_answered | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`(none computed)` | **MISSING** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | — | Registry provisional arithmetic remainder. No warehouse column. Reconstructing from mixed Amazon CREATED + Derived ANSWERED would mix classifications and time bases — forbidden without explicit Derived label. |
| incoming_total | Amazon | CONTACTS_CREATED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_CREATED` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | CONTACTS_CREATED exists but dump does not retain 3-method filter. Cannot prove INBOUND+TRANSFER+QUEUE_TRANSFER partition = parent. No CONTACTS_INCOMING semantic column. Critical: 3-method envelope missing. |
| incoming_transfer | Amazon | CONTACTS_CREATED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_TRANSFER_TRANSFER` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Derived | Warehouse has Derived CTR CONTACT_TYPE=TRANSFER count, not Amazon CONTACTS_CREATED×TRANSFER filter. Classification mismatch. |
| incoming_queue_transfer | Amazon | CONTACTS_CREATED | `—`.`—` | **MISSING** | — | — | No QUEUE_TRANSFER method column on queue facts or CTR pivot. |
| incoming_handled | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HANDLED | CONTACTS_HANDLED_INBOUND` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | No CONTACTS_HANDLED_INCOMING / 3-method filter retained. CONTACTS_HANDLED_INBOUND is Amazon inbound-only subset, not full incoming origins. |
| abandoned_total | Amazon | CONTACTS_ABANDONED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_ABANDONED` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Column name MATCH Amazon; grain queue×ET interval. Still PARTIAL: no envelope/queue_scope_hash/channel; do not mix with Derived CONTACTS_ABANDONED_INBOUND / SHORT / CALLBACK / VM taxonomy. No Control Center envelope (window_*_utc, queue_scope_hash, metric_filters_hash, source_classification, formula_version). |
| primary_abandoned | Amazon | CONTACTS_ABANDONED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_ABANDONED_INBOUND` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Derived | Closest is Derived CTR ABANDONED×INBOUND — not Amazon native filtered CONTACTS_ABANDONED. Short-abandons split out separately in warehouse. |
| non_primary_abandoned | Derived | (derive) abandoned_total − primary_abandoned | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`(none computed)` | **MISSING** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | — | No residual column. Mixing Amazon CONTACTS_ABANDONED with Derived primary abandon would be invalid. |
| queued | Amazon | CONTACTS_QUEUED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_QUEUED` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Name+classification OK; missing envelope/channel; disconnect-interval grain ET NTZ. No Control Center envelope (window_*_utc, queue_scope_hash, metric_filters_hash, source_classification, formula_version). |
| abandonment_rate | Amazon | ABANDONMENT_RATE | `—`.`—` | **MISSING** | — | — | CRITICAL: ABANDONMENT_RATE not in QUEUES_REPORT_* or FCT_QUEUE_*. Do not substitute abandoned/queued arithmetic for native rate. |
| service_level_20 | Amazon | SERVICE_LEVEL | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`SERVICE_LEVEL` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Derived | CRITICAL MISMATCH: live registry service_level_20 = Amazon native SERVICE_LEVEL threshold 20. Warehouse SERVICE_LEVEL column = Derived TRUE_SLA 20s = answered_within_20/(offered−short_abandons_5s) from INT_CONNECT_SERVICE_LEVEL_*. Amazon dump SERVICE_LEVEL on STG_QUEUES_REPORT is overwritten in FCT by TRUE_SLA. Never silently equate Amazon native SL20 to TRUE_SLA; label Derived mismatch. Also possible double TZ convert on DATE_BUCKET. |
| answer_speed | Amazon | AVG_QUEUE_ANSWER_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_QUEUE_ANSWER_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Amazon avg on queue dump; non-additive — never avg-of-avgs. No envelope. No Control Center envelope (window_*_utc, queue_scope_hash, metric_filters_hash, source_classification, formula_version). |
| abandon_wait | Amazon | AVG_ABANDON_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_ABANDON_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Amazon avg present; same non-additive + envelope gaps. |
| max_queue_wait | Amazon | MAX_QUEUED_TIME | `—`.`—` | **MISSING** | — | — | MAX_QUEUED_TIME not landed in QUEUES_REPORT_* / FCT_QUEUE_*. |
| answered_under_20 | Amazon | SUM_CONTACTS_ANSWERED_IN_X | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`SUM_CONTACTS_ANSWERED_IN_X` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Column exists but dump does not document which threshold X was requested; threshold not part of warehouse key. Cannot assert X=20. |
| abandoned_under_5 | Amazon | SUM_CONTACTS_ABANDONED_IN_X | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`SUM_CONTACTS_ABANDONED_IN_X | CONTACTS_SHORT_ABANDONED_INBOUND` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Hybrid | Amazon SUM_*_IN_X threshold undocumented in dump. Derived SHORT_ABANDONED_INBOUND uses 5s CTR rule — different population/classification from Amazon SUM metric. |
| abandoned_under_20 | Amazon | SUM_CONTACTS_ABANDONED_IN_X | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`SUM_CONTACTS_ABANDONED_IN_X` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Same single SUM_*_IN_X column — cannot host both LT5 and LT20 without threshold key. |
| handle_time | Amazon | AVG_HANDLE_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_HANDLE_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Queue-level Amazon avg; registry is all-voice. Non-additive; no envelope. |
| interaction_time | Amazon | AVG_INTERACTION_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_INTERACTION_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Unfiltered queue avg; INBOUND method filter not retained. |
| wrap_time | Amazon | AVG_AFTER_CONTACT_WORK_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_AFTER_CONTACT_WORK_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Unfiltered; method filter missing. |
| hold_time | Amazon | AVG_HOLD_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_HOLD_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Amazon avg present; envelope/non-additive gaps. |
| held_contacts | Amazon | CONTACTS_PUT_ON_HOLD | `—`.`—` | **MISSING** | — | — | CONTACTS_PUT_ON_HOLD not in queue dump/FCT. |
| hold_disconnects | Amazon | CONTACTS_HOLD_ABANDONS | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HOLD_ABANDONS` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Column exists unfiltered; INBOUND filter not retained. |
| non_response | Amazon | AGENT_NON_RESPONSE | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AGENT_NON_RESPONSE` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Present on queue dump (offer-attempt grain). Do not equate to contact-leg counts. Typo twin AGENT_NON_REPONSE_WITHOUT_CUSTOMER_ABANDONS on queue. |
| agent_answer_rate | Amazon | AGENT_ANSWER_RATE | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AGENT_ANSWER_RATE` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope | Amazon (dump) | Not on queue FCT; available agent×day only. Grain mismatch vs inbound queue scope. Non-additive native rate. |
| transferred_out | Amazon | CONTACTS_TRANSFERRED_OUT | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_TRANSFERRED_OUT_BY_AGENT | CONTACTS_TRANSFERRED_OUT_INTERNAL` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Exact CONTACTS_TRANSFERRED_OUT missing; split BY_AGENT/INTERNAL present. Method filter missing. |
| queue_transferred_out | Amazon | CONTACTS_TRANSFERRED_OUT_FROM_QUEUE | `—`.`—` | **MISSING** | — | — | CONTACTS_TRANSFERRED_OUT_FROM_QUEUE not landed. |

### Outbound (18) — authority `outbound-operations-registry.json` (id + semantic)

| metric_id | contract class | Amazon field/filters/threshold | live warehouse object.column | status | warehouse grain | warehouse Amazon-vs-Derived | gap notes |
|---|---|---|---|---|---|---|---|
| created | Amazon | CONTACTS_CREATED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_CREATED (unfiltered) | CONTACTS_OUTBOUND_* Derived` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Hybrid | No Amazon CONTACTS_CREATED×OUTBOUND filter retained on queue dump. Derived CTR outbound/campaign counts are different initiation (OUTBOUND vs API campaign) — do not mix contact-leg created with campaign attempt grain. |
| handled | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HANDLED_OUTBOUND` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | CONTACTS_HANDLED_OUTBOUND ≈ disconnect-timed handled outbound. Do NOT equate to handled_connection (connection-time) or campaign connected. Envelope/method hash missing. |
| remainder | Derived | (derive) created − handled | `—`.`—` | **MISSING** | — | — | Provisional arithmetic only; no warehouse column. Do not treat as verified not-answered. |
| customer_disconnect | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY`.`CUSTOMER_DISCONNECT` | **PARTIAL** | centerwide ATTEMPT_HOUR ET only — no campaign_id/queue | Derived | FCT_OUTBOUND_CAMPAIGN_HOURLY.CUSTOMER_DISCONNECT is Derived campaign-disposition (API+VOICE), NOT Amazon GetMetricData handled×OUTBOUND×CUSTOMER_DISCONNECT. Wrong grain (campaign/centerwide vs outbound queue legs). Do not mix. |
| agent_disconnect | Amazon | CONTACTS_HANDLED | `—`.`—` | **MISSING** | — | — | No Amazon disconnect-reason breakdown for OUTBOUND handled on queue/agent dumps. |
| third_party_disconnect | Amazon | CONTACTS_HANDLED | `—`.`—` | **MISSING** | — | — | No THIRD_PARTY_DISCONNECT metric column. |
| other_disconnect | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY`.`OTHER` | **PARTIAL** | centerwide ATTEMPT_HOUR ET only — no campaign_id/queue | Derived | Derived campaign residual OTHER — not Amazon OTHER disconnect filter on OUTBOUND handled. |
| held | Amazon | CONTACTS_PUT_ON_HOLD | `—`.`—` | **MISSING** | — | — | CONTACTS_PUT_ON_HOLD not landed. |
| hold_disconnect | Amazon | CONTACTS_HOLD_ABANDONS | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HOLD_ABANDONS` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Unfiltered hold abandons; OUTBOUND method filter missing. |
| transfer | Amazon | CONTACTS_TRANSFERRED_OUT | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_TRANSFERRED_OUT_BY_AGENT | _INTERNAL` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Exact TRANSFERRED_OUT missing; splits present; OUTBOUND filter missing. |
| interaction | Amazon | AVG_INTERACTION_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_INTERACTION_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Unfiltered queue avg; OUTBOUND filter missing. Non-additive. |
| wrap | Amazon | AVG_AFTER_CONTACT_WORK_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`AVG_AFTER_CONTACT_WORK_TIME` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | Unfiltered; OUTBOUND filter missing. |
| connecting | Amazon | SUM_CONNECTING_TIME_AGENT | `—`.`—` | **MISSING** | — | — | CRITICAL grain: agent-activity SUM_CONNECTING_TIME_AGENT — not contact-leg, not handled count. Column absent from AGENTS_* / FCT_AGENT_* dumps. |
| handled_connection | Amazon | CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME | `CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY/HOURLY`.`CONTACTS_HANDLED_OUTBOUND (DISCONNECT-timed only)` | **PARTIAL** | QUEUE_NAME × INTERVAL ET day/hour (TIMESTAMP_NTZ); not UTC envelope | Amazon (dump) | CRITICAL: must NOT equate to disconnect-timed CONTACTS_HANDLED / CONTACTS_HANDLED_OUTBOUND. Connection-time basis column CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME is MISSING. Period-boundary divergence expected. |
| campaign_sends | Amazon | CAMPAIGN_SEND_ATTEMPTS | `PRD_RAW_DB.AMAZON_CONNECT.OUTBOUND_CAMPAIGNS_REPORT_DAILY / CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY`.`CAMPAIGN_SEND_ATTEMPTS | TOTAL_ATTEMPTS` | **PARTIAL** | campaign×interval (raw unused 10 rows) OR centerwide hour Derived | Hybrid | CRITICAL: campaign attempt grain ≠ outbound contact-leg ≠ recipient. Amazon OUTBOUND_CAMPAIGNS_REPORT_DAILY has CAMPAIGN_SEND_ATTEMPTS but unused (~10 rows). FCT_OUTBOUND TOTAL_ATTEMPTS is Derived API+VOICE centerwide — no campaign_id. Never funnel-add with connected/targeted. |
| campaign_connected | Amazon | CAMPAIGN_CONTACTS_CONNECTED | `PRD_RAW_DB.AMAZON_CONNECT.OUTBOUND_CAMPAIGNS_REPORT_DAILY / CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY`.`HUMAN_ANSWERED_CALLS | CONNECTED_TO_AGENT_REAL/SHORT` | **PARTIAL** | campaign×interval OR centerwide hour Derived | Hybrid | Exact CAMPAIGN_CONTACTS_CONNECTED missing. HUMAN_ANSWERED_CALLS on unused Amazon campaign dump; Derived CONNECTED_* on FCT_OUTBOUND. AMD/human rules differ. Never equate to outbound handled. |
| campaign_targeted | Amazon | RECIPIENTS_TARGETED | `PRD_RAW_DB.AMAZON_CONNECT.OUTBOUND_CAMPAIGNS_REPORT_DAILY`.`RECIPIENTS_TARGETED` | **PARTIAL** | campaign×interval (unused dump) | Amazon (dump) | Recipient grain — not attempts, not contacts. Present on unused OUTBOUND_CAMPAIGNS_REPORT_DAILY only; not on FCT_OUTBOUND_CAMPAIGN_HOURLY. Never use as funnel denominator with sends/connected. |
| campaign_progress | Amazon | CAMPAIGN_PROGRESS_RATE | `PRD_RAW_DB.AMAZON_CONNECT.OUTBOUND_CAMPAIGNS_REPORT_DAILY`.`RECIPIENTS_ATTEMPTED / RECIPIENTS_TARGETED (no native rate col)` | **MISSING** | — | — | CAMPAIGN_PROGRESS_RATE not stored. Do not reconstruct from mixed Derived FCT columns. Not connection rate. |

### Agent (15) — authority `agent-operations-registry.json`

| metric_id | contract class | Amazon field/filters/threshold | live warehouse object.column | status | warehouse grain | warehouse Amazon-vs-Derived | gap notes |
|---|---|---|---|---|---|---|---|
| handled | Amazon | CONTACTS_HANDLED | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`CONTACTS_HANDLED` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope | Amazon (dump) | Agent×day Amazon handled (all eligible methods in dump). Voice scope filter / envelope missing. Contact-leg disconnect grain — not unique callers. |
| non_response | Amazon | AGENT_NON_RESPONSE | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AGENT_NON_RESPONSE` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · routing-attempt | Amazon (dump) | Offer-attempt grain OK on agent dump. Do not subtract from contact-leg handled. Envelope missing. |
| non_response_excluding_abandons | Amazon | AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · routing-attempt | Amazon (dump) | Column present; same envelope gaps. Do not derive from handled. |
| answer_rate | Amazon | AGENT_ANSWER_RATE | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AGENT_ANSWER_RATE` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · non-additive | Amazon (dump) | Native rate present; never avg agent rates to team total. Not % of incoming customers. |
| handle_time | Amazon | AVG_HANDLE_TIME | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AVG_HANDLE_TIME` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · non-additive | Amazon (dump) | Amazon avg present; do not avg-of-avgs. |
| interaction | Amazon | AVG_INTERACTION_TIME | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY`.`SUM_INTERACTION_TIME (no AVG_INTERACTION_TIME on agent FCT)` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope | Amazon (dump) | AVG_INTERACTION_TIME on queue dump only; agent facts have SUM_INTERACTION_TIME / AVG_TALK_TIME — not equivalent to native AVG_INTERACTION_TIME. |
| hold | Amazon | AVG_HOLD_TIME | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AVG_HOLD_TIME` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · non-additive | Amazon (dump) | Present; queue-wait ≠ agent hold. |
| wrap | Amazon | AVG_AFTER_CONTACT_WORK_TIME | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY`.`AVG_AFTER_CONTACT_WORK_TIME` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · non-additive | Amazon (dump) | Present; Amazon zero-inclusion rules — do not naive AVG nullable CTR. |
| occupancy | Amazon | AGENT_OCCUPANCY | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY`.`AGENT_OCCUPANCY` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · profile non-additive | Amazon (dump) | On consolidated daily only (not detailed). Not schedule adherence. |
| online | Amazon | SUM_ONLINE_TIME_AGENT | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY`.`SUM_ONLINE_TIME_AGENT` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · activity duration | Amazon (dump) | Present on consolidated. Not roster headcount. |
| contact_time | Amazon | SUM_CONTACT_TIME_AGENT | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY`.`SUM_CONTACT_TIME_AGENT` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · activity duration | Amazon (dump) | Present consolidated. Do not reconstruct from CTR durations. |
| idle | Amazon | SUM_IDLE_TIME_AGENT | `—`.`—` | **MISSING** | — | — | SUM_IDLE_TIME_AGENT not in AGENTS_REPORT_* / FCT_AGENT_*. Derived status durations exist on FCT_CONNECT_AGENT_STATUS_DAILY but not Amazon idle definition. |
| non_productive | Amazon | SUM_NON_PRODUCTIVE_TIME_AGENT | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY`.`SUM_NON_PRODUCTIVE_TIME_AGENT` | **PARTIAL** | AGENT_ID × INTERVAL ET day (optional CHANNEL on detailed); not UTC envelope · activity duration | Amazon (dump) | Present consolidated; custom-status semantics. |
| adherence | Amazon | AGENT_SCHEDULE_ADHERENCE | `—`.`—` | **MISSING** | — | — | No schedule interval fact; HAS_ATTENDANCE boolean only — not adherence %. |
| quality | Amazon | AVG_WEIGHTED_EVALUATION_SCORE | `CORE_CONTACT_CENTER.FCT_AGENT_CONSOLIDATED_METRICS_DAILY / CORE_CONTACT_CENTER.FCT_AGENT_DETAILED_METRICS_DAILY / FCT_CONNECT_QA_*`.`AVG_EVALUATION_SCORE` | **PARTIAL** | agent×day / eval | Hybrid | AVG_EVALUATION_SCORE ≠ AVG_WEIGHTED_EVALUATION_SCORE (name/weighting). QA views exist but not contract-named. |

---

## 3) Critical mismatches (flag before either side changes definitions)

| # | metric | Why critical |
|---|---|---|
| 1 | `inbound/service_level_20` | Amazon SERVICE_LEVEL LT20 vs warehouse SERVICE_LEVEL=Derived TRUE_SLA 20s — never silent equate |
| 2 | `inbound/abandonment_rate` | ABANDONMENT_RATE column MISSING — do not substitute abandoned/queued |
| 3 | `inbound/incoming_total (+primary/transfer)` | CONTACTS_CREATED 3-method filter envelope missing; cannot prove partition |
| 4 | `inbound/primary_not_answered` | Derived remainder MISSING; mixing Amazon CREATED + Derived ANSWERED forbidden |
| 5 | `outbound/handled_connection` | CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME MISSING — must NOT = disconnect CONTACTS_HANDLED_OUTBOUND |
| 6 | `outbound/connecting` | SUM_CONNECTING_TIME_AGENT (activity grain) MISSING |
| 7 | `outbound/campaign_* quartet` | attempt/recipient/campaign grains separate Aug27–28 — never add as one funnel; core FCT has no campaign_id |
| 8 | `outbound/customer_disconnect et al.` | Amazon OUTBOUND×DISCONNECT_REASON filters MISSING; Derived campaign dispositions wrong grain |
| 9 | `agent/idle + adherence` | SUM_IDLE_TIME_AGENT and AGENT_SCHEDULE_ADHERENCE MISSING; no current snapshot either |
| 10 | `all domains / envelope` | ANALYTICS_CONNECT missing; 0 envelope-hash columns; ET NTZ ≠ UTC window contract |


## 4) Proposed view SQL sketches (PROPOSE ONLY — do not create)

> Targeting future `PRD_ANALYTICS_DB.ANALYTICS_CONNECT` / `MART_CALL_CENTER`. Stubs only.

```sql
-- PROPOSE ONLY: Amazon-native queue interval with method/threshold envelope
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL AS
-- SELECT
--   queue_id, queue_name,
--   interval_start_utc, interval_end_utc, 'America/New_York' AS timezone,
--   channel, initiation_method, threshold_comparison, threshold_value,
--   metric_name, metric_value,
--   'Amazon' AS source_classification,
--   metric_filters_hash, queue_scope_hash, formula_version, refreshed_at_utc
-- FROM /* land GetMetricDataV2 long-form — NOT FCT_QUEUE_CONSOLIDATED hybrid */;

-- PROPOSE ONLY: expose TRUE_SLA separately from Amazon SERVICE_LEVEL
-- CREATE VIEW MART_CALL_CENTER.VW_QUEUE_SLA_COMPARE AS
-- SELECT q.queue_name, q.interval_start,
--        q.amazon_service_level_20,          -- from untouched Amazon dump
--        s.true_sla AS derived_true_sla_20,  -- INT_CONNECT_SERVICE_LEVEL_*
--        'Derived mismatch — do not equate' AS warning
-- FROM amazon_queues_service_level_20 q
-- JOIN INT_CONNECT_SERVICE_LEVEL_DAILY s USING (queue_name, date_bucket);

-- PROPOSE ONLY: native abandonment rate (do not compute from counts)
-- CREATE VIEW MART_CALL_CENTER.VW_INBOUND_ABANDONMENT_RATE AS
-- SELECT ... ABANDONMENT_RATE AS queue_abandonment_rate  -- GetMetricDataV2 native only;

-- PROPOSE ONLY: connection-time outbound handled ≠ disconnect handled
-- CREATE VIEW MART_CALL_CENTER.VW_OUTBOUND_HANDLED_CONNECTION AS
-- SELECT ... CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME
-- WHERE initiation_method = 'OUTBOUND';

-- PROPOSE ONLY: campaign metrics retain campaign_id; never UNION to direct OUTBOUND
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL AS
-- SELECT campaign_arn, campaign_id, interval_start_utc, interval_end_utc,
--        campaign_send_attempts, campaign_contacts_connected,
--        recipients_targeted, campaign_progress_rate
-- FROM OUTBOUND_CAMPAIGNS_REPORT_* /* wire unused Amazon dump */;

-- PROPOSE ONLY: agent activity + current snapshot
-- CREATE VIEW ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT AS
-- SELECT snapshot_ts, AGENTS_AVAILABLE, ... FROM GetCurrentMetricData landings;
-- CREATE VIEW MART_CALL_CENTER.VW_AGENT_IDLE AS
-- SELECT agent_id, interval_start, SUM_IDLE_TIME_AGENT FROM Amazon agent activity dump;
```



## 5) One-page executive (orchestrators room)

**Authority:** Live Control Center registries (inbound 29 / outbound 18 / agent 15). Warehouse truth = Sep 3 DDL audit under `/workspace/connect-audit/` (FR_MONITOR SELECT denied — map from DDL only). Contract schemas `ANALYTICS_CONNECT` / `MART_CALL_CENTER` / `RAW_CONNECT` **do not exist**. Closest facts: `FCT_QUEUE_CONSOLIDATED_METRICS_*`, `FCT_AGENT_*`, `FCT_OUTBOUND_CAMPAIGN_HOURLY`.

**Scorecard (live only):** MATCH **0** · PARTIAL **47** · MISSING **15** of **62**  
- Inbound: 0/22/7 of 29  
- Outbound: 0/12/6 of 18  
- Agent: 0/13/2 of 15

**Do not ship without resolving:**
1. `service_level_20` (Amazon native) ≠ warehouse `SERVICE_LEVEL` (Derived TRUE_SLA 20s).
2. `ABANDONMENT_RATE` absent — no silent arithmetic substitute.
3. Incoming 3-method `CONTACTS_CREATED` envelope not retained.
4. Outbound connection-time handled ≠ disconnect handled; connecting is activity-seconds.
5. Campaign sends/connected/targeted/progress are **three grains** — never one funnel; FCT outbound is centerwide Derived without `campaign_id`.
6. Agent current snapshot / idle / schedule adherence missing.
7. Zero envelope-hash columns anywhere — every “name match” stays PARTIAL until envelope lands.

**Next:** land long-form GetMetricDataV2 + campaign dump into ANALYTICS_CONNECT; keep Derived TRUE_SLA as a **separate** column; archival centerwide 10 deferred.

