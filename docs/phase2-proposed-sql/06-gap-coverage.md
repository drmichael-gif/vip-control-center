# Phase 2 — Gap coverage (which stubs unlock what)

**Path:** `/workspace/connect-audit/phase2-proposed-sql/06-gap-coverage.md`  
**Maps:** `phase1-metric-map-live.*`, `phase1-metric-map-archival.*`  
**MC:** wait for `ANALYTICS_CONNECT`; **no temporary PARTIAL binds**; **no PARTIAL → MATCH**.  
**Generated:** 2026-09-09 America/Bogota (UTC-5)

---

## How to read this

| Unlock | Meaning |
|---|---|
| **Unlocks (Amazon path)** | Stub enables a future MATCH path via GetMetricDataV2 / GetCurrentMetricData envelopes — **not** MATCH today. |
| **Still PARTIAL until land** | Status stays PARTIAL until envelopes exist + Phase 3 apply + parity. |
| **Remains Derived / CTR-only** | Registry Derived arithmetic or CTR hybrid — envelope stubs do not auto-resolve; need explicit Derived labeling or stay unbound. |
| **Out of scope this package** | Needs other facts (agent schedule, eval weighting, etc.). |

---

## A) Live inbound 29 — unlock matrix

Stub keys: **R**=`01-raw-metric-result` · **I**=`02-fct-interval/FCT_METRIC_RESULT` · **M**=`05-mart-inbound-operations` · **S**=`03-current-snapshot` · **C**=`04-campaign-interval`

| metric_id | Phase 1 status | Class | Unlocked by | Notes |
|---|---|---|---|---|
| primary_incoming | PARTIAL | Amazon | R+I+M | Needs CONTACTS_CREATED × INBOUND filter retained in envelope |
| primary_answered | PARTIAL | Amazon | R+I+M | CONTACTS_HANDLED × INBOUND |
| primary_not_answered | MISSING | **Derived** | M only (conditional) | Remains Derived; set only if both Amazon legs same envelope — else leave NULL |
| incoming_total | PARTIAL | Amazon | R+I+M | Needs 3-method CONTACTS_CREATED parent filter hash |
| incoming_transfer | PARTIAL | Amazon | R+I+M | CONTACTS_CREATED × TRANSFER (replaces Derived CTR TRANSFER count) |
| incoming_queue_transfer | MISSING | Amazon | R+I+M | CONTACTS_CREATED × QUEUE_TRANSFER — currently absent everywhere |
| incoming_handled | PARTIAL | Amazon | R+I+M | CONTACTS_HANDLED with 3-method incoming origins |
| abandoned_total | PARTIAL | Amazon | R+I+M | CONTACTS_ABANDONED + envelope/channel |
| primary_abandoned | PARTIAL | Amazon | R+I+M | Amazon filtered abandon — not Derived ABANDONED_INBOUND |
| non_primary_abandoned | MISSING | **Derived** | M only (conditional) | Remains Derived remainder; no mixed Amazon/Derived subtract |
| queued | PARTIAL | Amazon | R+I+M | CONTACTS_QUEUED + UTC envelope |
| abandonment_rate | MISSING | Amazon | R+I+M | Native ABANDONMENT_RATE only — **never** abandoned/queued |
| service_level_20 | PARTIAL | Amazon | R+I+M | **SERVICE_LEVEL threshold 20 only**; unlocks escape from TRUE_SLA mismatch |
| answer_speed | PARTIAL | Amazon | R+I+M | AVG_QUEUE_ANSWER_TIME; non-additive |
| abandon_wait | PARTIAL | Amazon | R+I+M | AVG_ABANDON_TIME |
| max_queue_wait | MISSING | Amazon | R+I+M | MAX_QUEUED_TIME landing |
| answered_under_20 | PARTIAL | Amazon | R+I+M | SUM_CONTACTS_ANSWERED_IN_X with **threshold_hash = 20** |
| abandoned_under_5 | PARTIAL | Amazon | R+I+M | SUM_CONTACTS_ABANDONED_IN_X threshold **5** (≠ Derived SHORT_ABANDONED) |
| abandoned_under_20 | PARTIAL | Amazon | R+I+M | Same metric name, **threshold 20** — separate PK via threshold_hash |
| handle_time | PARTIAL | Amazon | R+I+M | AVG_HANDLE_TIME |
| interaction_time | PARTIAL | Amazon | R+I+M | AVG_INTERACTION_TIME + method filter |
| wrap_time | PARTIAL | Amazon | R+I+M | AVG_AFTER_CONTACT_WORK_TIME + method filter |
| hold_time | PARTIAL | Amazon | R+I+M | AVG_HOLD_TIME |
| held_contacts | MISSING | Amazon | R+I+M | CONTACTS_PUT_ON_HOLD |
| hold_disconnects | PARTIAL | Amazon | R+I+M | CONTACTS_HOLD_ABANDONS + INBOUND filter |
| non_response | PARTIAL | Amazon | R+I+M | AGENT_NON_RESPONSE offer-attempt grain |
| agent_answer_rate | PARTIAL | Amazon | R+I+M | AGENT_ANSWER_RATE at queue/inbound scope if requested |
| transferred_out | PARTIAL | Amazon | R+I+M | Exact CONTACTS_TRANSFERRED_OUT (not only BY_AGENT/INTERNAL splits) |
| queue_transferred_out | MISSING | Amazon | R+I+M | CONTACTS_TRANSFERRED_OUT_FROM_QUEUE |

### Inbound summary

| Bucket | Count | metric_ids |
|---|---:|---|
| Amazon MISSING unlocked by R+I+M | **5** | incoming_queue_transfer, abandonment_rate, max_queue_wait, held_contacts, queue_transferred_out |
| Amazon PARTIAL → envelope path (still PARTIAL until Phase 3) | **22** | all other Amazon inbound rows including service_level_20 |
| Derived remainders (not auto-MATCH) | **2** | primary_not_answered, non_primary_abandoned |

**Critical unlock:** `service_level_20` gets a dedicated Amazon LT20 key — warehouse `SERVICE_LEVEL`=TRUE_SLA stays unrelated.

---

## B) Live outbound 18 — coverage from this package

| metric_id | Phase 1 | Unlocked by | Remains / caveat |
|---|---|---|---|
| created, handled, hold_disconnect, transfer, interaction, wrap | PARTIAL | R+I (not in inbound mart) | Method filter OUTBOUND on envelope |
| remainder | MISSING Derived | — | Remains Derived |
| customer/agent/third_party/other_disconnect | PARTIAL/MISSING | R+I | Needs HANDLED × OUTBOUND × DisconnectReason filters |
| held | MISSING | R+I | CONTACTS_PUT_ON_HOLD × OUTBOUND |
| connecting | MISSING | R+I | SUM_CONNECTING_TIME_AGENT activity grain |
| handled_connection | PARTIAL | R+I | CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME — ≠ disconnect HANDLED |
| campaign_sends | PARTIAL | **C** (+R) | campaign_id × CAMPAIGN_SEND_ATTEMPTS |
| campaign_connected | PARTIAL | **C** (+R) | CAMPAIGN_CONTACTS_CONNECTED |
| campaign_targeted | PARTIAL | **C** (+R) | RECIPIENTS_TARGETED recipient grain |
| campaign_progress | MISSING | **C** (+R) | Native CAMPAIGN_PROGRESS_RATE only |

Campaign quartet: **never funnel-add**; **never UNION** to direct OUTBOUND legs. `FCT_OUTBOUND_CAMPAIGN_HOURLY` remains Derived/CTR-only stand-in — not MATCH.

---

## C) Live agent 15 — coverage

| metric_id | Phase 1 | Unlocked by | Remains |
|---|---|---|---|
| handled, non_response, non_response_excluding_abandons, answer_rate, handle_time, hold, wrap, occupancy, online, contact_time, non_productive | PARTIAL | R+I (agent resource scope) | Envelope + UTC; still not MATCH until land |
| interaction | PARTIAL | R+I | Need AVG_INTERACTION_TIME (not only SUM) |
| idle | MISSING | R+I | SUM_IDLE_TIME_AGENT — Derived status durations ≠ Amazon idle |
| adherence | MISSING | — | Needs schedule interval fact — **out of scope** this package |
| quality | PARTIAL | — | AVG_WEIGHTED_EVALUATION_SCORE ≠ AVG_EVALUATION_SCORE — QA package |

`AGENTS_AVAILABLE` / archival `available_voice_agents_current`: unlocked by **S** (`03-fct-current-snapshot`), not by agent interval dumps or status headcount.

---

## D) Archival centerwide 10 — relation to stubs

| id | Phase 1 | Stub relation |
|---|---|---|
| contacts_abandoned / incoming / handled_incoming | PARTIAL | Same R+I path as live; archival UI retired |
| queue_abandonment_rate | MISSING | R+I native ABANDONMENT_RATE |
| **service_level_lt_30_seconds** | MISSING | R+I with **threshold_value = 30** separate key — **not** live `service_level_20`; **not** TRUE_SLA |
| outbound_calls_answered | PARTIAL | R+I connection/handled outbound — window rules differ |
| available_voice_agents_current | PARTIAL | **S** current snapshot |
| campaign_reach_rate | PARTIAL | **C** — CONNECTED/SEND_ATTEMPTS semantics ≠ recipients |
| abandoned trend / heatmap | PARTIAL | R+I interval facts; no monthly TOTAL envelope yet |

---

## E) What remains Derived / CTR-only after stubs (even post–Phase 3 land)

Do **not** promote these to MATCH via envelope facts alone:

1. **primary_not_answered**, **non_primary_abandoned**, outbound **remainder** — registry Derived arithmetic.
2. Warehouse **TRUE_SLA** / `INT_CONNECT_SERVICE_LEVEL_*` — permanently separate from Amazon SL20/SL30.
3. CTR taxonomy columns on `FCT_QUEUE_CONSOLIDATED_*` (`CONTACTS_ANSWERED_INBOUND`, `CONTACTS_SHORT_ABANDONED_INBOUND`, `CONTACTS_TRANSFER_TRANSFER`, `TOTAL_INBOUND`, etc.).
4. **FCT_OUTBOUND_CAMPAIGN_HOURLY** centerwide Derived (no `campaign_id`).
5. Agent **status-duration** idle proxies on `FCT_CONNECT_AGENT_STATUS_DAILY`.
6. Any abandoned/queued **reconstructed** abandonment rate.
7. QA **unweighted** scores vs weighted contract.

---

## F) Stub → Phase 1 MISSING count (live inbound)

| Stub | Live inbound MISSING it primarily unlocks |
|---|---|
| 01 + 02 + 05 | incoming_queue_transfer, abandonment_rate, max_queue_wait, held_contacts, queue_transferred_out |
| 05 (Derived cols only) | Documents primary_not_answered, non_primary_abandoned — does not fabricate MATCH |
| 03 | (archival) available_voice_agents_current; live AGENTS_AVAILABLE consumers |
| 04 | outbound campaign_progress (+ hardens campaign_* PARTIALs) |

**MATCH today:** still **0**. Stubs do not change Phase 1 scorecard until Phase 3 create + ingest + validation.
