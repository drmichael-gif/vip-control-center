# Amazon Connect → Snowflake metric contract

This is the implementation contract behind the Call Center display. It exists so the UI can move from representative values to live Amazon Connect data without changing metric meaning.

The required end-to-end verification and maintenance workflow is defined in [`call-center-metric-governance-playbook.md`](call-center-metric-governance-playbook.md). Every metric change must compare the director question, Connect Assistant interpretation and value, reproducible Amazon API result, Snowflake semantic result, and dashboard display using an identical request envelope.

## Dashboard-to-dictionary presentation contract

The Call Center Operations UI consists of four action/verification pairs: **Call Center Metrics → Call Center Metrics Dictionary**, **Inbound Dashboard → Inbound Data Dictionary**, **Outbound Dashboard → Outbound Data Dictionary**, and **Agent Performance Dashboard → Agent Data Dictionary**. Each dashboard metric must provide an operational owner, exception condition, next action, and a source control that lands on the corresponding dictionary definition. That definition must display the exact source field, business meaning, Amazon-provided or Derived classification, formula, Connect Assistant verification, reproducible API verification, and the reconciliation table that carries the governed value. Classification is rendered as basic text rather than an icon or decorative badge.

### Paired Inbound Dashboard contract — Aug 12–15, 2026 ET

The Inbound Dashboard and Inbound Data Dictionary read the same governed metric registry. A dashboard tile is not allowed to define a value independently. The fixed verification envelope is all enumerated standard queues, `CHANNEL=VOICE`, `America/New_York`, `IntervalPeriod=TOTAL`, with an inclusive local-date window of August 12–15 and an API end time of August 16 at 12:00 AM ET. Date controls in the prototype communicate the intended request; they do not relabel the verified snapshot until a successful refresh replaces the registry values.

| Semantic metric | Display value | Classification | Exact Amazon acquisition or formula | Snowflake target | Required controls |
|---|---:|---|---|---|---|
| `original_inbound_created` | 2,452 | Amazon provided | `CONTACTS_CREATED`; `INITIATION_METHOD=INBOUND` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.ORIGINAL_INBOUND_CREATED` | Nonnegative; equals the Table 1A inbound component; request-envelope hash matches raw API result |
| `original_inbound_handled` | 1,689 | Amazon provided | `CONTACTS_HANDLED`; `INITIATION_METHOD=INBOUND` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.ORIGINAL_INBOUND_HANDLED` | `handled <= created`; equals Table 1B answered row |
| `original_inbound_missed` | 763 | Derived control | `original_inbound_created - original_inbound_handled` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.ORIGINAL_INBOUND_MISSED` | `2,452 - 1,689 = 763`; children reconcile exactly to created; never present this as an Amazon-named metric |
| `contacts_abandoned` | 984 | Amazon provided | `CONTACTS_ABANDONED`; no initiation-method filter | `MART_CALL_CENTER.FCT_INBOUND_DAILY.CONTACTS_ABANDONED` | Equals native all-origin queue-abandon parent; callbacks excluded by Amazon definition |
| `original_inbound_contacts_abandoned` | 612 | Amazon provided | `CONTACTS_ABANDONED`; `INITIATION_METHOD=INBOUND` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.ORIGINAL_INBOUND_CONTACTS_ABANDONED` | `<= contacts_abandoned`; equals Table 1C native portion |
| `non_primary_contacts_abandoned` | 372 | Derived control | `contacts_abandoned - original_inbound_contacts_abandoned` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.NON_PRIMARY_CONTACTS_ABANDONED` | `984 - 612 = 372`; preserve as a residual control unless native origin components are queried individually |
| `original_inbound_answer_rate` | 68.9% | Derived KPI | `original_inbound_handled / original_inbound_created * 100` | `MART_CALL_CENTER.FCT_INBOUND_DAILY.ORIGINAL_INBOUND_ANSWER_RATE` | Recalculate from stored numerator and denominator; do not average percentages across intervals |
| `queue_abandonment_rate` | 26.2% | Amazon provided | Native `ABANDONMENT_RATE`; all standard queues; voice | `MART_CALL_CENTER.FCT_INBOUND_DAILY.QUEUE_ABANDONMENT_RATE` | Preserve Amazon's native result and request envelope; do not silently substitute `984 / 3,752` even when it rounds identically |

The warehouse must preserve two grains rather than flatten them: Amazon interval results in `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL`, and the director-ready daily/period projection in `MART_CALL_CENTER.FCT_INBOUND_DAILY`. The semantic projection carries `window_start_utc`, `window_end_utc`, `timezone`, `queue_scope_hash`, `channel`, `metric_filters_hash`, `source_classification`, `source_fact`, `formula_version`, and `refreshed_at_utc` for every value.

### Centerwide Call Center Metrics contract

The centerwide view is a projection of governed domain metrics, not a new fact table. It may display metrics from different grains or windows only when every card keeps its own window and grain visible. It must never add them together. The paired dictionary contains the exact request envelope and Snowflake target for each displayed card.

| Display metric | Verification on 2026-08-29 | Amazon acquisition | Snowflake target and required control |
|---|---|---|---|
| Contacts abandoned | API + Assistant verified: 6,904 for completed Aug 1–26 ET days | `GetMetricDataV2: CONTACTS_ABANDONED`; all standard queues; `CHANNEL=VOICE`; `IntervalPeriod=TOTAL`; ET; end exclusive | `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL`; request-envelope hash and value must equal Assistant, API, warehouse, and dashboard |
| Contacts incoming | API verified: 17,844; Assistant comparison not equivalent because it did not apply the initiation-method filter and returned 106,034 all-VOICE legs | `CONTACTS_CREATED`; `INITIATION_METHOD IN (INBOUND,TRANSFER,QUEUE_TRANSFER)` | Store parent and component filter sets separately; test 16,071 + 1,773 + 0 = 17,844; persist the Assistant scope flag rather than asserting equality |
| Contacts handled incoming | API verified: 11,205; Assistant comparison not equivalent because it did not apply the initiation-method filter and returned 33,149 all-VOICE legs | `CONTACTS_HANDLED`; same initiation-method set | Store parent and components separately; test 10,067 + 1,138 + 0 = 11,205; persist the Assistant scope flag rather than asserting equality |
| Queue abandonment rate | API + Assistant verified: 27.5608782435% API / 27.56% Assistant | Native `ABANDONMENT_RATE`; same queue/channel/window envelope | Preserve native percentage and its request envelope; do not replace it with silent UI arithmetic |
| Service level under 30 seconds | API + Assistant verified: 59.4491017964% API / 59.45% Assistant | Native `SERVICE_LEVEL` with `Threshold=[{Comparison:'LT',ThresholdValue:30}]` | Include threshold hash in the native-metric primary key; never mix `<30` with `<=30` |
| Outbound calls answered | API + Assistant value verified: 8,980 for Aug 1–15 ET | `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME`; `INITIATION_METHOD=OUTBOUND`; voice. Assistant returned the same value but proposed `CONTACTS_HANDLED_OUTBOUND`, which the live API rejected. | Preserve the API-accepted identifier, direct outbound contact-leg grain, and Assistant label discrepancy; prohibit combination with campaign-recipient or delivery-attempt grain |
| Available voice agents | API + Assistant verified: 8 at `2026-08-29T19:13:19.031Z` | Native `GetCurrentMetricData: AGENTS_AVAILABLE`; `CHANNEL=VOICE`; all standard queues | `ANALYTICS_CONNECT.FCT_CONNECT_CURRENT_METRIC_SNAPSHOT`; key by instance, metric, filter hash, snapshot time. Keep the separate `GetCurrentUserData` status-label snapshot (13 of 17 at 3:00 PM) as diagnostic context; do not substitute it for open voice capacity. |
| Campaign connection rate | API verified: 7 connected / 44 send attempts = 15.9% for managed campaign `NY-NL-1-1032-v2-08-27`, Aug 27–28 ET | `connectcampaignsv2:ListCampaigns`; campaign-scoped `GetMetricDataV2` with `CAMPAIGN_CONTACTS_CONNECTED` and `CAMPAIGN_SEND_ATTEMPTS` | `ANALYTICS_CONNECT.FCT_CAMPAIGN_METRIC_INTERVAL`; test connected ≤ attempts and displayed rate = connected / attempts |

#### Historical request grain per centerwide card

The dictionary publishes the valid Connect interval grain and the concrete Snowflake target for every centerwide card. The valid `GetMetricDataV2` interval enums are `FIFTEEN_MIN`, `THIRTY_MIN`, `HOUR`, `DAY`, `WEEK`, and `TOTAL`; `P1M` and `P1D` are not API values.

| Display metric | Historical request grain | Snowflake column | Additive across intervals |
|---|---|---|---|
| Contacts abandoned | `TOTAL`, 2026-08-01/2026-08-27 ET; month points use one `TOTAL` request per month and hour-of-week uses `HOUR` | `FCT_CONNECT_METRIC_INTERVAL.CONTACTS_ABANDONED` | Yes |
| Contacts incoming | `TOTAL`, same window; the three initiation methods are applied inside the metric filter, not after aggregation | `CONTACTS_INCOMING` | Yes |
| Contacts handled incoming | `TOTAL`, same window, same initiation-method filter as the created parent | `CONTACTS_HANDLED_INCOMING` | Yes |
| Queue abandonment rate | `TOTAL`, same window; a rate is **not** additive, so store the native value with its window and carry numerator/denominator to re-derive | `QUEUE_ABANDONMENT_RATE` | No |
| Service level under 30 seconds | `TOTAL`, same window; the `LT 30` threshold is part of the request key, so a different threshold is a different column rather than a re-aggregation | `SERVICE_LEVEL_LT_30_SECONDS` | No |
| Outbound calls answered | `TOTAL`, 2026-08-01/2026-08-16 ET — a **different** window from the inbound cards; never added to Aug 1–26 values | `OUTBOUND_CALLS_ANSWERED` | Yes |
| Available voice agents | Point-in-time snapshot, not an interval. `GetCurrentMetricData` has no interval grain; the snapshot timestamp *is* the grain and snapshots must never be summed | `FCT_CONNECT_CURRENT_METRIC_SNAPSHOT.AGENTS_AVAILABLE` | No |
| Campaign connection rate | `TOTAL`, Aug 27–28 ET, at managed-campaign scope | `FCT_CAMPAIGN_METRIC_INTERVAL.CAMPAIGN_CONNECTION_RATE` | No |

#### Shape analytics: live interval data with an explicit archive boundary

The heat map uses exact Amazon `HOUR` results. The trend uses exact per-month `TOTAL` results for Jun–Aug 2026; the older nine values remain provisional until the durable Connect data-lake or Snowflake archive is available.

| Visual | Classification | Required historical request grain | Amazon acquisition | Snowflake target and control |
|---|---|---|---|---|
| Contacts abandoned · 12-month trend (Sep 2025 – Aug 2026 ET) | Derived presentation — Jun–Aug API verified; Sep–May provisional archive | One `IntervalPeriod=TOTAL` request per ET month. The live API returned Jun 10,889; Jul 11,864; Aug 6,904, and rejected the older range at its recent-history boundary. | `CONTACTS_ABANDONED`; all standard queues; `CHANNEL=VOICE`; ET | `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL` at `(instance_id, queue_id, channel, window_start_ts, interval_period='TOTAL')`. Replace provisional points from the durable archive. |
| Contacts abandoned · 24-hour Mon–Sun heat map (1 week / 2 weeks / 1 month) | Derived aggregation — API verified | `IntervalPeriod=HOUR`, `TimeZone=America/New_York`, in two-day chunks because hourly requests must cover under three days | Same metric and filters; exact totals are 1,805, 3,740, and 6,904 | Same fact at hourly grain; `GROUP BY DAY_OF_WEEK, HOUR_OF_DAY` in ET. Tests: all 168 cells sum to the window total and local-hour bucketing is DST-correct. |

The credential-free extraction artifact is `data/call-center-metrics-history-2026-06_2026-08.json`; the reproducible pull is `scripts/pull-call-center-metrics-history.py`. Cells remain queued contact legs at disconnect time and are never mixed with routing-attempt grain.

Every centerwide card, the director-priority strip, both shape visuals, and every action-guidance row expose a governed source control that switches to the Call Center Metrics Dictionary, scrolls the exact row into view, moves focus to it, and flashes it. This is enforced by `scripts/verify-ccm-source-links.mjs` at 1440×900 and 390×760.

The centerwide page is allowed to read from several semantic objects but should normally materialize as a governed view such as `MART_CALL_CENTER.VW_CENTERWIDE_METRIC_LATEST`. Recommended columns are `metric_id`, `metric_value`, `metric_unit`, `window_start_utc`, `window_end_utc`, `observed_at_utc`, `timezone`, `grain`, `verification_state`, `request_envelope_hash`, `source_fact`, and `refreshed_at_utc`. This view must expose the latest successful value per metric contract; it must not coerce all rows to one common grain or common period.

## Required documentation for every displayed metric

Every metric must have two complete mappings:

### 1. Amazon Connect acquisition mapping

- Classification: `AMAZON_PROVIDED` or `DERIVED`.
- API or source: usually `GetMetricDataV2`, exported contact records, agent-event data, or an approved Connect data-lake table.
- Exact metric identifier or record fields.
- Statistic, metric filters, thresholds, channel, queues, and routing scope.
- Reporting timestamp: initiation, enqueue, connected-to-agent, disconnect, or event timestamp.
- Grain: contact leg, root customer journey, agent-offer attempt, queue interval, or aggregate period.
- Required joins and exclusions, including callback and test/simulated contacts.
- Exact formula for derived values.

### 2. Snowflake analytics mapping

- Raw source table and immutable ingestion key.
- Curated model and semantic metric name.
- Target grain and primary key.
- Required joins and deduplication rule.
- Time-zone conversion and office-hours classification.
- SQL transformation or aggregation logic.
- Data-quality and reconciliation tests.
- Incremental refresh watermark and late-arriving-record policy.

## Recommended Snowflake layers

| Layer | Recommended object | Grain | Purpose |
|---|---|---|---|
| Raw | `RAW_CONNECT.CONTACT_RECORD` | One version of a Connect contact record | Lossless ingestion; retain source JSON and ingestion metadata. |
| Raw | `RAW_CONNECT.AGENT_EVENT` | One agent/routing event | Offer-attempt and agent non-response analysis. |
| Raw | `RAW_CONNECT.METRIC_RESULT` | One API metric result per interval/filter set | Preserve direct `GetMetricDataV2` results and request parameters. |
| Curated | `ANALYTICS_CONNECT.FCT_CONTACT_LEG` | One `INSTANCE_ID + CONTACT_ID` | Typed contact fields and duration measures. |
| Curated | `ANALYTICS_CONNECT.FCT_AGENT_OFFER_ATTEMPT` | One offer attempt | Accepted, non-response, caller-abandoned-during-offer, and error outcomes. |
| Curated | `ANALYTICS_CONNECT.BRIDGE_CONTACT_LINEAGE` | One parent-child relationship | Root journey, previous/next contact, callback, and transfer lineage. |
| Curated | `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL` | One metric/filter/interval | Native Amazon metrics used for reporting and validation. |
| Semantic | `MART_CALL_CENTER.MONTHLY_INBOUND_AUDIT` | Month + queue + channel + office-hours bucket | Reconciled monthly audit populations. |
| Semantic | `MART_CALL_CENTER.MONTHLY_INBOUND_KPI` | Month + queue + KPI | Non-additive director KPIs and their source classification. |

## Core modeling rules

1. Use `INSTANCE_ID + CONTACT_ID` as the contact-leg key. Do not assume `CONTACT_ID` is globally unique across instances.
2. Keep contact legs separate from root journeys. Resolve `INITIAL_CONTACT_ID`, `PREVIOUS_CONTACT_ID`, and `NEXT_CONTACT_ID` in the lineage bridge.
3. Store all raw timestamps in UTC. Derive `REPORTING_DATE_ET` and `OFFICE_HOURS_BUCKET` using `America/New_York`. Current office hours are 08:00–22:00 ET.
4. The monthly inbound audit cohort is based on `InitiationTimestamp`, unless the metric explicitly states another event-time basis.
5. Preserve direct API results as received. Recalculate native metrics from contact records only as a validation control, not as a silent replacement.
6. Use attempt-grain facts for agent offers. Never compare `AGENT_NON_RESPONSE` attempts directly to distinct callers without an explicit distinct-contact bridge.
7. Reconciliation child categories must be mutually exclusive and collectively exhaustive. Add a zero-balance test for every parent/children table.
8. Loads must be idempotent. Merge by immutable business key and retain source update timestamp, ingestion timestamp, payload hash, and batch ID.
9. Reprocess a rolling late-arrival window because Connect contact records can be updated after initial delivery.
10. Store the exact API request filters and thresholds alongside metric results for audit reproducibility.

## Current inbound-call mappings

### Native-only director display policy

#### Connect assistant-compatible acquisition contract

The dashboard's leading inbound control table must use the same historical-metric request envelope as Connect assistant rather than attempting to infer assistant values from `SearchContacts`. The canonical extractor is `scripts/pull-connect-assistant-inbound.py`; its frozen August 12–15 output is `data/amazon-connect-assistant-inbound-2026-08-12_15.json`. The inclusive August 1–26 comparison is saved as `data/amazon-connect-assistant-inbound-2026-08-01_26.json`.

`GetMetricDataV2.EndTime` is exclusive. To reproduce an inclusive August 1–26 ET report, request `2026-08-01T04:00:00Z` through `2026-08-27T04:00:00Z`. That request returns Contacts incoming 17,844; Contacts handled incoming 11,205; Contacts queued 25,050; Contacts abandoned 6,904; and Contacts transferred out from queue 0. The exact reproducible command is:

```bash
python3 scripts/pull-connect-assistant-inbound.py \
  --start 2026-08-01T04:00:00Z \
  --end 2026-08-27T04:00:00Z \
  --output data/amazon-connect-assistant-inbound-2026-08-01_26.json
```

The request envelope is: instance `vipmedicalgroup`; all `STANDARD` queue IDs enumerated at extraction time; `CHANNEL=VOICE`; `TimeZone=America/New_York`; `IntervalPeriod=TOTAL`; start `2026-08-12T04:00:00Z`; end `2026-08-16T04:00:00Z`. These are complete ET calendar days. Unless the metric explicitly uses an event-time variant, `GetMetricDataV2` assigns these contact-record-driven metrics when the contact completes/disconnects.

| Connect assistant display label | Exact V2 request | Value | Snowflake semantic mapping |
|---|---|---:|---|
| Contacts incoming | `CONTACTS_CREATED`; `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)` | 2,694 | `SUM(metric_value)` for the exact request-envelope key; validate against 2,452 inbound + 242 transfer + 0 queue transfer. |
| Contacts handled incoming | `CONTACTS_HANDLED`; `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)` | 1,849 | `SUM(metric_value)` for the exact key; validate against 1,689 inbound + 160 transfer + 0 queue transfer. |
| Contacts queued | `CONTACTS_QUEUED` | 3,752 | Preserve as its own native queue/contact-leg measure. A contact is counted when a queue enqueue timestamp is present. |
| Contacts abandoned | `CONTACTS_ABANDONED` | 984 | Preserve as its own native measure; validate only with Amazon's contact-record inclusion/exclusion rules. |
| Contacts transferred out from queue | `CONTACTS_TRANSFERRED_OUT_FROM_QUEUE` | 0 | Preserve as its own native measure for the same request envelope. |

#### Connect Assistant director metric dictionary

The Inbound Data Dictionary includes a governed question-to-metric mapping for the Inbound Call Dashboard. Its machine-readable source of truth is `inbound_native_only_display.connect_assistant_metric_dictionary` in `data/amazon-connect-metric-contract.json`. Use the question text below when comparing the dashboard with Connect Assistant; do not allow conversational synonyms to change the metric population.

All historical native rows use `GetMetricDataV2`, `CHANNEL=VOICE`, the versioned queue scope, and the request's completed-period event-time attribution unless a row states otherwise. Store every request envelope and response in `RAW_CONNECT.METRIC_RESULT`, then merge to `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL` using the governed request-envelope key.

Connect Assistant was used as a terminology cross-check on 2026-08-29. It confirmed that multiple values in one `MetricFilterValues` array are OR-evaluated, that an `INITIATION_METHOD` metric filter can coexist with explicit queue IDs and `CHANNEL=VOICE`, the queue/threshold identifiers below, and the non-additive aggregation rules. It also incorrectly claimed that `CONTACTS_HANDLED_INCOMING` was a standalone V2 metric. A live `GetMetricDataV2` request returned `InvalidRequestException: Invalid metric name: CONTACTS_HANDLED_INCOMING`; therefore the governed contract remains `CONTACTS_HANDLED` with `INITIATION_METHOD=INBOUND,TRANSFER,QUEUE_TRANSFER`. Assistant prose is not authoritative when it conflicts with the published API and a reproducible request.

Live contract checks also accepted the full historical metric-name batch used by the dictionary, the threshold metrics with `Threshold=[{Comparison:LT,ThresholdValue:x}]`, and the current queue metrics `CONTACTS_IN_QUEUE` (`COUNT`) plus `OLDEST_CONTACT_AGE` (`SECONDS`). `GetMetricDataV2` has no threshold unit field; the metric definition supplies the seconds interpretation. These checks validate request shape and identifier support, not the business correctness of combining metrics with different grains.

| Director question / semantic metric | Classification | Exact Amazon acquisition | Snowflake implementation and required control |
|---|---|---|---|
| Incoming contacts / `contacts_incoming` | Amazon provided | `CONTACTS_CREATED`; `INITIATION_METHOD IN (INBOUND,TRANSFER,QUEUE_TRANSFER)` | Sum exact-envelope rows; initiation components must equal the parent. |
| Original external inbound / `original_inbound_created` | Amazon provided | `CONTACTS_CREATED`; `INITIATION_METHOD=INBOUND` | Preserve the filtered native row; validate `InitiationMethod` at contact-leg grain. |
| Entered queue / `contacts_queued` | Amazon provided | `CONTACTS_QUEUED` | Validate `QueueInfo.EnqueueTimestamp`; do not force equality with Contacts incoming. |
| Handled incoming / `contacts_handled_incoming` | Amazon provided | `CONTACTS_HANDLED`; `INITIATION_METHOD IN (INBOUND,TRANSFER,QUEUE_TRANSFER)` | Sum exact-envelope rows; initiation components must equal the parent. |
| Original inbound handled / `original_inbound_handled` | Amazon provided | `CONTACTS_HANDLED`; `INITIATION_METHOD=INBOUND` | Validate `Agent.ConnectedToAgentTimestamp` on the contact leg. |
| Original inbound missed / `original_inbound_missed` | Derived | `CONTACTS_CREATED(INBOUND) - CONTACTS_HANDLED(INBOUND)` with identical scope and completed-period time basis | Persist both inputs; assert nonnegative and `handled + missed = created`. This is broader than queue abandonment. |
| Original inbound answer rate / `original_inbound_answer_rate` | Derived | `CONTACTS_HANDLED(INBOUND) / NULLIF(CONTACTS_CREATED(INBOUND),0)` | Store numerator and denominator; assert identical scope and value in `[0,1]`. |
| Queue abandons / `contacts_abandoned` | Amazon provided | `CONTACTS_ABANDONED` | Validate Amazon's queued-callback, connection, next-contact, and transfer exclusions. |
| Queue abandonment rate / `queue_abandonment_rate` | Amazon provided | `ABANDONMENT_RATE` | Preserve the native non-additive result; never simple-average interval percentages. |
| Under-5-second abandons / `contacts_abandoned_lt_5s` | Amazon provided | `SUM_CONTACTS_ABANDONED_IN_X`; threshold 5, comparison `LT` | Threshold and comparison are part of the primary key; value must not exceed total abandons. |
| Exclusive abandon wait band / `abandon_wait_band` | Derived | Adjacent cumulative thresholds or one `CASE` over `QueueInfo.Duration` | Exactly one band per abandoned contact; bands must sum to the parent. |
| Average abandon time / `avg_abandon_time_seconds` | Amazon provided | `AVG_ABANDON_TIME` | Preserve native average; validate abandoned queue duration; never simple-average intervals. |
| Average queue answer time / `avg_queue_answer_time_seconds` | Amazon provided | `AVG_QUEUE_ANSWER_TIME` | Preserve native average; validate handled queue duration. |
| 30-second service level / `service_level_30s` | Amazon provided | `SERVICE_LEVEL`; threshold 30 plus versioned short-abandon treatment | Threshold and short-abandon configuration are required dimensions. |
| Answered under 30 seconds / `contacts_answered_lt_30s` | Amazon provided | `SUM_CONTACTS_ANSWERED_IN_X`; threshold 30, comparison `LT` | Preserve cumulative count; never add multiple cumulative thresholds. |
| Maximum completed queue wait / `max_queued_time_seconds` | Amazon provided | `MAX_QUEUED_TIME` | Preserve native maximum and retain the longest contact key for record-level validation. |
| Average handle time / `avg_handle_time_seconds` | Amazon provided | `AVG_HANDLE_TIME` | Validate native component fields with Amazon's inclusion rules; never simple-average intervals. |
| Average interaction time / `avg_interaction_time_seconds` | Amazon provided | `AVG_INTERACTION_TIME` | Validate `AgentInteractionDuration`; it excludes hold and after-contact work. |
| Average hold time / `avg_hold_time_seconds` | Amazon provided | `AVG_HOLD_TIME` | Validate `CustomerHoldDuration` with Amazon's null/zero rules; queue wait is excluded. |
| Average after-contact work / `avg_after_contact_work_seconds` | Amazon provided | `AVG_AFTER_CONTACT_WORK_TIME` | Validate `AfterContactWorkDuration`. |
| Contacts put on hold / `contacts_put_on_hold` | Amazon provided | `CONTACTS_PUT_ON_HOLD` | Validate `Agent.NumberOfHolds IS NOT NULL`. |
| Contacts disconnected while on hold / `contacts_hold_disconnect` | Amazon provided | `CONTACTS_HOLD_ABANDONS` | Validate `PreDisconnectState='CONNECTED_ONHOLD'`. |
| Contacts transferred out / `contacts_transferred_out` | Amazon provided | `CONTACTS_TRANSFERRED_OUT`; related diagnostics include `CONTACTS_TRANSFERRED_OUT_INTERNAL`, `CONTACTS_TRANSFERRED_OUT_EXTERNAL`, and `CONTACTS_TRANSFERRED_OUT_FROM_QUEUE` | Preserve every result separately. Do not assume internal + external exhausts the parent because the parent can include transfer paths outside those agent-transfer diagnostics. |
| Agent offer answer rate / `agent_answer_rate` | Amazon provided | `AGENT_ANSWER_RATE` | Load to the offer-attempt mart; never reconcile this attempt-grain percentage directly to distinct contacts. |
| Agent non-response attempts / `agent_non_response_attempts` | Amazon provided | `AGENT_NON_RESPONSE` | Preserve contact and attempt keys in `FCT_AGENT_OFFER_ATTEMPT`; also calculate distinct affected contacts separately. |

Office hours are `08:00` inclusive through `22:00` exclusive in `America/New_York`. `GetMetricDataV2` does not express one disjoint recurring daily office-hours filter across a multi-day range. Therefore every office-hours count is **Derived**, even when each daily input is native:

| Office-hours question / semantic metric | Exact acquisition and formula | Snowflake implementation |
|---|---|---|
| Incoming calls / `contacts_incoming_office_hours` | For each ET date, query `CONTACTS_CREATED` with incoming initiation methods over the date's UTC-converted `[08:00,22:00)` window; sum daily counts. | Convert event time to `America/New_York`; include local hours 08–21; assert nonoverlapping 14-hour local windows. |
| Handled incoming / `contacts_handled_incoming_office_hours` | Sum daily-window `CONTACTS_HANDLED` with incoming initiation methods. | Preserve one exact-envelope row per local date and sum count rows only. |
| Original inbound missed / `original_inbound_missed_office_hours` | For each ET date, subtract daily `CONTACTS_HANDLED(INBOUND)` from daily `CONTACTS_CREATED(INBOUND)` over the same window; then sum daily remainders. | Assert each daily remainder is nonnegative and the two native inputs have the same scope. |
| Queue abandons / `contacts_abandoned_office_hours` | Sum one daily `CONTACTS_ABANDONED` result per ET date. | Sum native daily counts; never simple-average abandonment rates or durations. |

For non-additive averages, percentages, maxima, and rates, never average the daily/hourly displayed values. Request a compatible native aggregate where possible; otherwise calculate from the governed numerator/denominator or contact-level fact using Amazon's inclusion rules.

Real-time questions use a separate snapshot contract: `GetCurrentMetricData: CONTACTS_IN_QUEUE` with `Unit=COUNT` populates `SNAPSHOT_QUEUE_CURRENT.contacts_in_queue`, and `GetCurrentMetricData: OLDEST_CONTACT_AGE` with `Unit=SECONDS` populates `SNAPSHOT_QUEUE_CURRENT.oldest_contact_age_seconds`. Persist Amazon's `DataSnapshotTime` as `observed_at_utc`; both metrics use `instance_id + queue_id + observed_at_utc` as the snapshot key. Neither is interchangeable with the historical `MAX_QUEUED_TIME` measure.

“Total incoming calls entered a queue” is Connect assistant's conversational description of `CONTACTS_QUEUED`, not the API's separately named Contacts incoming metric. The UI therefore shows both names and identifiers. Do not calculate `queued − handled incoming − abandoned` as an audited residual: the measures are operationally related but are not a mutually exclusive and collectively exhaustive partition. Only the initiation-method component controls for `CONTACTS_CREATED` and `CONTACTS_HANDLED` are additive.

Snowflake must persist every collection from the API response with its exact request envelope in `RAW_CONNECT.METRIC_RESULT`, then merge idempotently to `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL`. Use the primary key `instance_id + start_time_utc + end_time_utc + queue_scope_hash + channel + metric_name + metric_filters_hash + threshold_hash`. Required tests are: component-to-parent equality for Contacts incoming and Contacts handled incoming; dashboard-to-warehouse request-envelope hash equality; and dashboard value equality with the latest successful warehouse row for that exact key.

The current Inbound Data Dictionary intentionally displays only values returned directly by Amazon Connect through `GetMetricDataV2`, including supported native metric filters and thresholds. A business-friendly label may accompany Amazon's metric name, but the exact native identifier and filter must remain visible below it.

Use a parent/children presentation only in these two cases:

1. **Native partition:** the same native metric is filtered by mutually exclusive Amazon dimensions that collectively cover the parent. The screen may show that the children reconcile to the parent, while Snowflake independently tests the equality.
2. **Native diagnostics:** Amazon metrics are operationally related but overlap, use different grains, or do not exhaust the parent. The screen must explicitly say they are not additive and must not display a fabricated zero tie-out.

The live August 12–15 native-only display uses these verified structures. The API interval is `2026-08-12T04:00:00Z` through `2026-08-16T04:00:00Z`, representing four complete ET calendar days:

| Display section | Native parent | Native children or diagnostics | Presentation rule |
|---|---|---|---|
| Incoming demand by origin | `CONTACTS_CREATED` filtered to `INBOUND, TRANSFER, QUEUE_TRANSFER` = 2,694 | `INBOUND` 2,452; `TRANSFER` 242; `QUEUE_TRANSFER` 0 | Native partition; children reconcile within this table. |
| Original inbound answer reconciliation | `CONTACTS_CREATED`, `INITIATION_METHOD=INBOUND` = 2,452 | `CONTACTS_HANDLED`, `INITIATION_METHOD=INBOUND` = 1,689; calculated not answered = 763 | Two-outcome arithmetic control using identical native scope. |
| Original inbound not-answered breakdown | Calculated not answered = 763 | Native `CONTACTS_ABANDONED`, `INITIATION_METHOD=INBOUND` = 612; calculated other not answered = 151 | Do not relabel the residual as abandonment. |
| Original inbound queue-abandon detail | `CONTACTS_ABANDONED`, `INITIATION_METHOD=INBOUND` = 612 | Table 1D defines exclusive `[0,5)`, `[5,10)`, `[10,15)`, `[15,20)`, and `[20,+∞)` contact-record bands; values remain unpublished pending reconciliation | The live threshold query rejects `INITIATION_METHOD`; derive the bands from `QueueInfo.Duration` only after the exact contact-record cohort reconciles to 612. |
| Queue demand and abandonment | `CONTACTS_QUEUED` = 3,752 | `CONTACTS_ABANDONED` 984; `CONTACTS_TRANSFERRED_OUT_FROM_QUEUE` 0 | Diagnostic, not an exhaustive partition. |
| Abandon timing | `CONTACTS_ABANDONED` = 984 | Cumulative under 5/10/15/20 seconds = 246/444/513/536; exclusive display bands = 246/198/69/23/448 | Adjacent cumulative thresholds are subtracted A−B; the five exclusive bands reconcile to 984. |
| Original inbound disconnect reason | `CONTACTS_HANDLED`, `INITIATION_METHOD=INBOUND` = 1,689 | `CUSTOMER_DISCONNECT` 1,256; `AGENT_DISCONNECT` 262; `THIRD_PARTY_DISCONNECT` 36; `OTHER` 135 | Native partition. |
| Inbound hold usage | `CONTACTS_HANDLED`, `INITIATION_METHOD=INBOUND` = 1,689 | `CONTACTS_PUT_ON_HOLD` 405 | Native diagnostic subset. |
| Inbound hold outcome | `CONTACTS_PUT_ON_HOLD`, `INITIATION_METHOD=INBOUND` = 405 | Native `CONTACTS_HOLD_ABANDONS` 42; arithmetic complement 363 | Mutually exclusive operational control: 42 + 363 = 405. The complement is not a separately named Amazon metric. |
| Hold-disconnect reason | `CONTACTS_HOLD_ABANDONS`, `INITIATION_METHOD=INBOUND` = 42 | `CUSTOMER_DISCONNECT` 17; `AGENT_DISCONNECT` 0; `OTHER` 25 | Native partition. |
| Agent routing | none | `AGENT_NON_RESPONSE` 435; `AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS` 49; `AGENT_ANSWER_RATE` 85.7564% | Attempt-grain diagnostics. |
| Queue experience | none | `ABANDONMENT_RATE` 26.2260%; `AVG_QUEUE_ANSWER_TIME` 154.29s; `AVG_ABANDON_TIME` 1,415.65s; `SERVICE_LEVEL` under 30s 66.6045%; cumulative answered under 5/15/30/60/120 = 10/1,622/1,928/2,065/2,248 | Non-additive director KPIs. |
| Answered-work efficiency | none | `AVG_HANDLE_TIME` 232.25s; `AVG_CONTACT_DURATION` 441.71s; `AVG_INTERACTION_TIME` 143.36s; `AVG_INTERACTION_AND_HOLD_TIME` 162.41s; `AVG_TALK_TIME` 123.82s; `AVG_NON_TALK_TIME` 25.98s; `PERCENT_TALK_TIME` 76.5224%; `PERCENT_NON_TALK_TIME` 16.0563%; `AVG_HOLD_TIME` 144.84s; `AVG_HOLDS` 0.1505; `AVG_AFTER_CONTACT_WORK_TIME` 69.84s; `AVG_RESOLUTION_TIME` 496.07s | Non-additive averages and percentages. |
| Transfer workload | `CONTACTS_TRANSFERRED_OUT` = 197 | `CONTACTS_TRANSFERRED_OUT_BY_AGENT` 197; internal 182; external 15 | The diagnostics happen to equal the parent in this snapshot, but they are not a guaranteed exhaustive API partition. Preserve each measure independently and do not enforce internal + external = parent without proving identical scope from contact records. |

The left-side flow arrows connect exact carry-forwards and related downstream diagnostics. Table 1A `CONTACTS_CREATED` + `INITIATION_METHOD=INBOUND` flows to the identical Table 1B parent; Table 1B's calculated not-answered control flows to the identical Table 1C parent; and Table 1C `CONTACTS_ABANDONED` + `INITIATION_METHOD=INBOUND` flows immediately into the matching origin row in Table 2. Table 2 contains the complete `984 = 612 + 372` origin partition, sends the 372 other-origin population to Table 2A, and sends its 984 abandonment population to Table 3's wait-band diagnostic. The answered branch carries Table 1B `CONTACTS_HANDLED` + `INITIATION_METHOD=INBOUND` into Tables 4 and 5; Table 5 carries its hold subset into Table 5A and its hold-disconnect subset into Table 5B. Exact carry-forwards must retain the same reporting window, instance, channel, queue scope, filters, and grain in `FCT_CONNECT_METRIC_INTERVAL`; related diagnostic arrows must be labeled and must not imply that non-additive metrics reconcile.

The queue-abandon origin control is embedded in Table 2: `984 total = 612 INBOUND + 372 other initiation methods`. Table 2A details the 372 using native additive filters: `82 TRANSFER + 288 API + 2 CALLBACK + 0 QUEUE_TRANSFER = 372`. Store `INITIATION_METHOD` on every metric row so Snowflake can reproduce both the two-way director view and the detailed native partition without changing grain.

Do not draw a connector from Table 1B's inbound-filtered abandonment component to Table 2's all-standard-queue abandonment total, or between incoming and handled transfer rows. Those measures are operationally related but do not have identical scope and values; an arrow would falsely communicate a reconciliation.

Snowflake must ingest the API response together with the exact request envelope: instance, UTC start/end, queue IDs or queue-scope version, channel, metric name, metric filters, threshold, comparison operator, statistic, API retrieval timestamp, and raw response payload. Store one result per request/filter set in `FCT_CONNECT_METRIC_INTERVAL`. Reconciliation tests may calculate a validation difference in the warehouse, but that difference is a control result—not a displayed Amazon metric.

The following former display rows are deliberately excluded because no exact native Amazon equivalent exists: exclusive abandon-duration bands, abandon before/after an agent offer at distinct-contact grain, contacts not put on hold, total routing attempts, short-abandon share, custom connection rate, queue-answer p90, and transfer-out rate. The product has explicitly authorized one calculated answer bridge: `CONTACTS_CREATED(INBOUND) - CONTACTS_HANDLED(INBOUND)`. Its residual after native inbound abandonment remains calculated and must be resolved from contact-record terminal paths before production use.

### August 2026 live validation note

For director-facing comparison with the Amazon Connect assistant, preserve a separate native handled-contact control for the completed-day window August 1–26, 2026 ET. The reproducible contract is `GetMetricDataV2: CONTACTS_HANDLED`, all standard queue IDs, all channels, completion-time interval `2026-08-01T04:00:00Z` through `2026-08-27T04:00:00Z`, and `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)`. It returns 11,205 voice contact legs: 10,067 `INBOUND`, 1,138 `TRANSFER`, and 0 `QUEUE_TRANSFER`. This is the API-equivalent of the assistant’s `CONTACTS_HANDLED_INCOMING` result. Store the three component queries and the roll-up control in `FCT_CONNECT_METRIC_INTERVAL`; do not relabel the 11,205 as unique callers or net-new inbound journeys.

The Connect assistant initially claimed that transfers were excluded. That description was incorrect even though its total was correct. Official metric semantics and the reproduced API result both show that transferred contact legs are included. Audit documentation and UI copy must follow the reproducible API contract rather than the assistant’s earlier prose.

The partial month-to-date snapshot in `data/amazon-connect-live-inbound-2026-08.json` validates Table 1 at contact grain using `SearchContacts`, `INITIATION_TIMESTAMP`, `CHANNEL=VOICE`, and `INITIATION_METHOD=INBOUND`. Connected contacts require an existing `CONNECTED_TO_AGENT_TIMESTAMP`; not connected is the nonnegative difference from the identical parent cohort. Office hours are derived by summing daily initiation-time windows `[08:00,22:00)` in `America/New_York`; non-office hours are the full-period cohort minus that office-hours cohort. The UI must show Snowflake and variance as pending until an independent warehouse query is available; it must not copy the Connect API value into the Snowflake column.

Do not replace this cohort with the completion-timed `GetMetricDataV2` handled-contact result. `GetMetricDataV2` accepts `INITIATION_METHOD` as a metric filter, but the native metric is attributed when the contact completes and the assistant-compatible definition includes transfer legs. Preserve both datasets with explicit grain and event-time columns until contact-record storage and Snowflake are available to build and test controlled bridges. Production ingestion must land `SearchContacts` request metadata and results idempotently, keyed by `instance_id + contact_id`, and recompute the reporting snapshot after late-arriving contacts settle.

| Display metric | Classification | Amazon Connect mapping | Snowflake implementation |
|---|---|---|---|
| Contacts handled incoming | Amazon provided | `GetMetricDataV2: CONTACTS_HANDLED`, filter `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)`; completion-time metric. | Load each initiation-method component to `FCT_CONNECT_METRIC_INTERVAL`, retain queue/channel/filter JSON, and assert the components sum to the assistant-compatible total. |
| Total eligible inbound calls | Derived | Distinct contact records where `Channel=VOICE`, `InitiationMethod=INBOUND`, initiation is in period, and approved test exclusions pass. | Count distinct contact-leg keys from `FCT_CONTACT_LEG`; persist the approved eligibility flag and exclusion reason. |
| Connected to an agent | Amazon provided | `GetMetricDataV2: CONTACTS_HANDLED`, filter `INITIATION_METHOD=INBOUND`. Use the connected-time version only for an explicitly connection-timestamp cohort. | Load native result to `FCT_CONNECT_METRIC_INTERVAL`; validate against non-null `ConnectedToAgentTimestamp` in `FCT_CONTACT_LEG`. |
| Not connected to an agent | Derived | Eligible inbound minus `CONTACTS_HANDLED` on the same initiation cohort. | `eligible_inbound_count - connected_count`; assert nonnegative and reconcile to total eligible inbound. |
| Contacts abandoned in queue | Amazon provided | `GetMetricDataV2: CONTACTS_ABANDONED`. | Preserve native result; validate against approved abandoned-in-queue rule and callback exclusion. |
| Abandoned without an agent offer | Derived | Distinct abandoned contacts with no related agent-offer event. | Anti-join abandoned contact legs to `FCT_AGENT_OFFER_ATTEMPT` by instance/contact ID. |
| Abandoned after an agent offer was not accepted | Derived | Distinct abandoned contacts with at least one offer attempt and no accepted connection. | Semi-join to attempts, group to distinct contact, require no accepted attempt. Keep attempt count separately. |
| Abandon duration bands | Derived | `QueueInfo.Duration` using exclusive bounds: `[0,5)`, `[5,15)`, `[15,30)`, `[30,60)`, `[60,120)`, `[120,+∞)` seconds. | Use one `CASE` expression on `QUEUE_DURATION_MS`; test exactly one band per parent contact and band sum equals parent. |
| Customer disconnect | Amazon provided | `CONTACTS_HANDLED` filtered with `DISCONNECT_REASON=CUSTOMER_DISCONNECT`. | Load native result and validate against `DISCONNECT_REASON` on handled contact legs. |
| Agent disconnect | Amazon provided | `CONTACTS_HANDLED` filtered with `DISCONNECT_REASON=AGENT_DISCONNECT`. | Load native result and validate against `DISCONNECT_REASON` on handled contact legs. |
| Transfer / next contact leg | Derived for reconciliation | Lineage/terminal classification. `CONTACTS_TRANSFERRED_OUT` is a native independent validation metric but may not produce the same mutually exclusive terminal partition. | Resolve successor legs in `BRIDGE_CONTACT_LINEAGE`; assign exactly one terminal category per handled contact. Compare transfer count to native metric as a control. |
| Contacts put on hold | Amazon provided | `CONTACTS_PUT_ON_HOLD`. | Preserve native result; validate with hold count/duration fields in contact-leg fact. |
| Contacts disconnected while on hold | Amazon provided | `CONTACTS_HOLD_ABANDONS`. | Preserve native result; validate `PreDisconnectState=CONNECTED_ONHOLD`. |
| Customer hold disconnect | Amazon provided | `CONTACTS_ON_HOLD_CUSTOMER_DISCONNECT`. | Native result plus contact-record validation. |
| Agent hold disconnect | Amazon provided | `CONTACTS_ON_HOLD_AGENT_DISCONNECT`. | Native result plus contact-record validation. |
| Did not disconnect while on hold | Derived | `CONTACTS_PUT_ON_HOLD - CONTACTS_HOLD_ABANDONS`. This does not prove successful completion. | Subtract same-scope native populations; assert nonnegative. |
| Total agent offer attempts | Derived | Sum `AgentConnectionAttempts`, reconciled at attempt grain. | Use `FCT_AGENT_OFFER_ATTEMPT`; compare count to summed contact-record attempt count. |
| Agent non-response attempts — caller remained | Amazon provided | `AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS`; attempt grain. | Load native attempt result and validate against attempt fact. |
| Agent non-response attempts — caller abandoned | Derived | `AGENT_NON_RESPONSE - AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS`; attempt grain. | Same-scope subtraction; separately calculate distinct affected contacts. |
| Queue abandonment rate | Amazon provided | `ABANDONMENT_RATE`. | Preserve API result; do not recreate unless validating the native value. |
| Contacts queued | Amazon provided | `CONTACTS_QUEUED`; a contact is counted when `QueueInfo.EnqueueTimestamp` is present. | Preserve native result; validate from enqueue timestamp and use as the queue-demand parent for Tables 2–3. |
| Short-abandon share | Derived | `SUM_CONTACTS_ABANDONED_IN_X` with threshold 5 seconds divided by `CONTACTS_ABANDONED`. | Divide same-period/same-filter native counts with `NULLIF(denominator,0)`. |
| Service level — 30 seconds | Amazon provided | `SERVICE_LEVEL` with 30-second threshold and approved short-abandon configuration. | Store threshold and request settings as dimensions; never compare service levels with different settings as the same KPI. |
| Average queue answer time | Amazon provided | `AVG_QUEUE_ANSWER_TIME`. | Preserve native result; validate from handled `QueueInfo.Duration`. |
| 90th-percentile queue answer time | Derived | Percentile of handled `QueueInfo.Duration`. | `PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY QUEUE_DURATION_MS)` on handled legs. |
| Maximum queued time | Amazon provided | `MAX_QUEUED_TIME`; includes handled, abandoned, and other queued outcomes. | Preserve native result and store the longest-duration contact key separately for drill-through validation. |
| Average queue abandon time | Amazon provided | `AVG_ABANDON_TIME`. | Preserve native result; validate from abandoned queue durations. |
| Average handle time | Amazon provided | `AVG_HANDLE_TIME`. | Preserve native result; validation includes interaction, hold, ACW, and applicable pause duration. |
| Average agent interaction time | Amazon provided | `AVG_INTERACTION_TIME`; excludes hold, ACW, and pause. | Preserve native result; validate from `AgentInteractionDuration` for connected contacts. Do not assume independently averaged components add exactly to AHT. |
| Average customer hold time | Amazon provided | `AVG_HOLD_TIME`; excludes queue wait. | Preserve native result; validate from `CustomerHoldDuration` using Amazon’s null/zero inclusion rules. |
| Average holds per contact | Amazon provided | `AVG_HOLDS`; averages `NumberOfHolds` with zero for contacts without holds. | Preserve native result; validate from `Agent.NumberOfHolds` and connect to the Table 5 hold population. |
| Average after-contact work time | Amazon provided | `AVG_AFTER_CONTACT_WORK_TIME`. | Preserve native result; validate from `AfterContactWorkDuration` using Amazon’s inclusion rules. |
| Transfer-out rate | Derived | `CONTACTS_TRANSFERRED_OUT / CONTACTS_HANDLED`. | Divide identical filter/time scopes with `NULLIF`; preserve numerator and denominator. |
| Agent answer rate | Amazon provided | `AGENT_ANSWER_RATE`; accepted contacts divided by total routing attempts. | Preserve native result at agent-offer grain and validate against `FCT_AGENT_OFFER_ATTEMPT`; connects to Table 6. |

## Outbound voice mappings

Outbound Tables 1–3 use a shared `Channel=VOICE` campaign cohort. Table 3 then assigns every telephony delivery attempt to exactly one configured delivery mode. Agent-assisted voice and automated voice remain separate downstream cohorts because their expected outcomes differ: agent-assisted live answers should reach an agent, while automated live answers should complete the automated experience unless the flow explicitly requests an agent transfer. Campaign-execution metrics use the API/event timestamp basis documented by Amazon; contact outcomes use a contact cohort explicitly anchored to `InitiationTimestamp`. Preview and digital channels remain outside this flow.

| Display metric | Classification | Amazon Connect mapping | Snowflake implementation and flow connection |
|---|---|---|---|
| Recipients targeted | Amazon provided | `RECIPIENTS_TARGETED`; customer-segment campaigns only. | Load native result to `FCT_CONNECT_METRIC_INTERVAL`; use `FCT_CAMPAIGN_RECIPIENT` at campaign execution + recipient grain for validation. Table 1 parent. |
| Recipients attempted | Amazon provided | `RECIPIENTS_ATTEMPTED`; approximate distinct recipients for segment campaigns. | Preserve native result and separately validate an exact warehouse distinct count. Table 1 child; do not silently substitute send-attempt grain. |
| Recipients excluded before send | Derived distinct population | Distinct recipient keys with an approved exclusion event/reason. `CAMPAIGN_SEND_EXCLUSIONS` remains a native attempt/event control. | Assign one reason per excluded recipient in `FCT_CAMPAIGN_RECIPIENT`; Table 1A children sum to this parent. |
| Recipients pending at cutoff | Derived | Targeted minus exact attempted recipients minus excluded recipients at the same campaign-execution snapshot. | Materialize snapshot cutoff and status; assert nonnegative. Table 1 children reconcile to targeted. |
| Campaign send attempts | Amazon provided | `CAMPAIGN_SEND_ATTEMPTS`. | Load native result; validate distinct accepted send events in `FCT_CAMPAIGN_DELIVERY_ATTEMPT`. Connects Tables 1–2. |
| Campaign send exclusions | Amazon provided | `CAMPAIGN_SEND_EXCLUSIONS`, with reason detail from outbound campaign events. This is an event/attempt control and is not silently treated as a distinct-recipient count. | Persist the native result independently. Compare it with Table 1A only after proving one exclusion event per excluded recipient for the selected campaign execution; otherwise report both grains separately. |
| Delivery attempts | Amazon provided | `DELIVERY_ATTEMPTS`, filtered to `connect:Telephony`; request and store delivery mode where supported. | Persist shared native total and mode-filtered results; validate one latest/final telephony outcome per `delivery_attempt_id`. Connects Tables 2–3. |
| Voice delivery mode | Amazon provided filter + warehouse control | Mode-filtered `DELIVERY_ATTEMPTS` for agent-assisted and automated voice. | Persist `delivery_mode` on `FCT_CAMPAIGN_DELIVERY_ATTEMPT`; assert exactly one mode and agent-assisted + automated = total voice delivery attempts. Table 3 is the required fork. |
| Answering Machine Detection (AMD) disposition | Derived except native totals/rates | `AnsweringMachineDetectionStatus` on the contact record; `DELIVERY_ATTEMPT_DISPOSITION_RATE` is a native percentage control. | Assign exactly one accepted AMD enumeration per outbound contact leg and preserve delivery mode. Tables 4A and 4B each reconcile independently. |
| Human answered by mode | Amazon provided | `HUMAN_ANSWERED`; answering machine detection (AMD) must be enabled and the request must preserve delivery mode. | Load native mode-filtered values; validate `ANSWERING_MACHINE_DETECTION_STATUS='HUMAN_ANSWERED'`. Connects 4A→5A and 4B→5B. |
| Campaign contacts connected | Amazon provided | `CAMPAIGN_CONTACTS_CONNECTED`; eligible system-connected live-customer population, not the same as agent connection. | Persist separately from `CONNECTED_TO_AGENT`; validate using connected-to-system and Answering Machine Detection (AMD) fields. Use as denominator for native abandonment-after-X rates. |
| Connected to campaign agent | Amazon provided with contact validation | `CONNECTED_TO_AGENT` contact event / campaign-filtered handled metric; validate `Agent.ConnectedToAgentTimestamp`. | Store at contact-leg grain and keep direct agent-assisted connections separate from automated transfer connections. Connects 5A to 7A, 8A, and 9A. |
| Agent-assisted campaign contact abandoned before agent | Derived total | Distinct agent-assisted human-answered contact legs with system connection, no agent connection, and customer disconnect. Native `CAMPAIGN_CONTACTS_ABANDONED_AFTER_X*` metrics cover explicit thresholds, not the unthresholded total. | One mutually exclusive Table 5A outcome; store mode, timing origin, and threshold separately. Table 6A parent and director trend. |
| Automated flow completed | Derived | Automated live-answer contact reaches the approved terminal success event for the versioned contact flow. | Store `flow_id`, `flow_version`, and terminal outcome in `FCT_CONTACT_LEG`; Table 5B children partition automated human answers. |
| Automated agent transfer requested | Derived | Automated live-answer contact enters the approved agent-transfer branch. | Persist the transfer-request event and linked contact/queue identifiers. Carries Table 5B into Table 6B. |
| Automated transfer outcome | Derived with native timestamp validation | Transfer request partitions into `Agent.ConnectedToAgentTimestamp` present, customer disconnect before agent, or approved transfer/flow failure. | One mutually exclusive outcome per requested transfer in Table 6B; never classify automated contacts with no transfer request as agent abandons. |
| Campaign-abandon duration bands | Derived | Exclusive bands over `ConnectedToAgentTimestamp - ConnectedToSystemTimestamp` when connected, or `DisconnectTimestamp - ConnectedToSystemTimestamp` for abandoned calls. Native cumulative validation: `CAMPAIGN_CONTACTS_ABANDONED_AFTER_X_FROM_SYSTEM_CONNECTION`. | One `CASE` at contact grain for `[0,5)`, `[5,15)`, `[15,30)`, `[30,60)`, `[60,120)`, `[120,+∞)`; sum equals Table 5 parent. Do not substitute greeting-start/end timing without renaming the metric. |
| Outbound disconnect reason | Amazon provided where filtered native metric matches | Campaign-filtered `CONTACTS_HANDLED` by `DISCONNECT_REASON`; transfer/other terminal categories remain derived to keep the partition exclusive. | Preserve native customer/agent disconnect results and validate one terminal classification per connected leg in Table 6. |
| Outbound hold populations | Derived counts plus native KPI validation | `Agent.NumberOfHolds`, `Agent.CustomerHoldDuration`; native `AVG_HOLDS` and `AVG_HOLD_TIME`. | Table 7 classifies each connected contact as zero/one/multiple holds. Store counts and duration on `FCT_CONTACT_LEG`; validate native averages using Amazon inclusion rules. |
| Campaign agent-offer activity | Mixed | Accepted connections plus `AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS`; caller-abandoned attempts are `AGENT_NON_RESPONSE - AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS`. | Use `FCT_AGENT_OFFER_ATTEMPT`, never contact grain. Accepted attempts equal Table 4 connected contacts; Table 8 attempts reconcile independently. |
| Campaign progress rate | Amazon provided | `CAMPAIGN_PROGRESS_RATE`; segment campaigns only. | Preserve request filters and native result. Connects to Table 1 but is non-additive. |
| Average dials per minute | Amazon provided | `AVG_DIALS_PER_MINUTE`. | Preserve native result by period/campaign; connects to Table 2 pacing. |
| Human-answer rate | Derived | `HUMAN_ANSWERED / DELIVERY_ATTEMPTS` with identical campaign, channel, mode, and time filters. | Divide same-scope native counts using `NULLIF`; connects Tables 2–3. |
| Live-answer agent-connection rate | Derived | Distinct agent-connected human answers / `HUMAN_ANSWERED`. | Same contact cohort and time basis; connects to Table 4. |
| Human-answer abandonment rate | Derived | Distinct unthresholded abandoned-before-agent / `HUMAN_ANSWERED`. | Same contact cohort; store numerator and denominator. Primary director leakage KPI. |
| Average wait after customer connection | Amazon provided | `AVG_WAIT_TIME_AFTER_CUSTOMER_CONNECTION`. | Preserve native result and validate from outbound campaign timestamps. Connects Tables 4–5. |
| Campaign abandons after 2 seconds | Amazon provided | `CAMPAIGN_CONTACTS_ABANDONED_AFTER_X_FROM_SYSTEM_CONNECTION`, threshold `2`. | Store threshold=2 and timing origin=system connection with result; never compare to greeting-based variants as the same KPI. |
| Outbound average handle/hold time | Amazon provided | `AVG_HANDLE_TIME`, `AVG_HOLD_TIME`, filtered to campaign cohort. | Preserve native results; validate using contact records. Connects Tables 6–7. |
| Outbound agent answer rate | Amazon provided | `AGENT_ANSWER_RATE`, filtered to campaign where supported by the request. | Preserve native result at offer-attempt grain; validate Table 8 accepted / total attempts. |

### Additional outbound Snowflake objects

### Live direct-outbound reference (Aug 12–15, 2026 ET)

The current AWS role can query direct outbound voice contact legs through `GetMetricDataV2`. These results use all standard queues, `CHANNEL=VOICE`, and `INITIATION_METHOD=OUTBOUND`. They are separate from outbound-campaign recipient and delivery-event metrics.

| Display metric | Amazon acquisition | Aug 12–15 | Snowflake implementation |
|---|---|---:|---|
| `Outbound_Call_Legs_Created` | `CONTACTS_CREATED`; `INITIATION_METHOD=OUTBOUND` | 2,822 | Store the native aggregate in `FCT_CONNECT_METRIC_INTERVAL`; validate against contact legs whose initiation method is `OUTBOUND`. |
| `Outbound_Calls_Answered` | `CONTACTS_HANDLED`; `INITIATION_METHOD=OUTBOUND` | 2,647 | Same filter and completed reporting window; validate a connected-agent timestamp on the outbound contact leg. |
| `Outbound_Calls_Not_Answered` | `CONTACTS_CREATED(OUTBOUND) - CONTACTS_HANDLED(OUTBOUND)` | 175 | Governed arithmetic control between two compatible native metrics. Amazon does not expose this remainder under one native metric name. |
| Answered disconnect reasons | `CONTACTS_HANDLED`; `INITIATION_METHOD=OUTBOUND`; one `DISCONNECT_REASON` filter per row | 741 customer; 1,897 agent; 4 third party; 5 other | Preserve native filtered requests and validate the contact-record disconnect reason. The four rows reconcile to 2,647. |
| `Outbound_Calls_Put_On_Hold` | `CONTACTS_PUT_ON_HOLD`; `INITIATION_METHOD=OUTBOUND` | 54 | Preserve the native result and validate contact-record hold episodes. |
| `Outbound_Hold_Abandons` | `CONTACTS_HOLD_ABANDONS`; `INITIATION_METHOD=OUTBOUND` | 9 | Preserve the native result and validate customer disconnect while on hold. |
| `Outbound_Calls_Transferred_Out` | `CONTACTS_TRANSFERRED_OUT`; `INITIATION_METHOD=OUTBOUND` | 10 | Preserve the native result and validate transfer lineage from the outbound contact leg. |
| `Average_Outbound_Interaction_Time` | `AVG_INTERACTION_TIME`; `INITIATION_METHOD=OUTBOUND` | 94.168 seconds | Store native average plus compatible numerator/denominator when available. |
| `Average_Outbound_After_Contact_Work_Time` | `AVG_AFTER_CONTACT_WORK_TIME`; `INITIATION_METHOD=OUTBOUND` | 73.768 seconds | Validate from `AfterContactWorkDuration`; do not add independently averaged components. |
| `Total_Outbound_Agent_Connecting_Time` | `SUM_CONNECTING_TIME_AGENT`; `INITIATION_METHOD=OUTBOUND` | 52,233.682 seconds | Native agent connecting workload; keep total-seconds unit explicit. |
| `Outbound_Calls_With_Connected_Time` | `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME`; `INITIATION_METHOD=OUTBOUND` | 2,647 | Native count of handled outbound contacts with connected-time measurement. |

Campaign administration and campaign-scoped metrics are now accessible. Live validation on 2026-08-29 enumerated campaign `NY-NL-1-1032-v2-08-27` and returned 44 send attempts, 7 connected campaign contacts, 85 recipients targeted, and 100% campaign progress for Aug 27–28 ET. Preserve campaign metric grain and never add these values to direct outbound contact-leg totals.

| Object | Grain / key | Required purpose |
|---|---|---|
| `ANALYTICS_CONNECT.FCT_CAMPAIGN_RECIPIENT` | `INSTANCE_ID + CAMPAIGN_ID + CAMPAIGN_EXECUTION_TIMESTAMP + RECIPIENT_KEY` | Targeting, eligibility, exclusion, consent/suppression, recipient timezone. |
| `ANALYTICS_CONNECT.FCT_CAMPAIGN_DELIVERY_ATTEMPT` | `INSTANCE_ID + DELIVERY_ATTEMPT_ID` | Send, retry, final disposition, channel, delivery mode, linked campaign contact. Delivery mode is mandatory for voice. |
| `ANALYTICS_CONNECT.FCT_AUTOMATED_VOICE_OUTCOME` | `INSTANCE_ID + CONTACT_ID + FLOW_VERSION` | Automated-flow success, customer disconnect, transfer request, transfer result, and approved failure taxonomy. |
| `MART_CALL_CENTER.MONTHLY_OUTBOUND_AUDIT` | Month + campaign + mode + recipient-local office-hours bucket + metric | All additive parent/child reconciliations and API/Snowflake variance. |
| `MART_CALL_CENTER.MONTHLY_OUTBOUND_KPI` | Month + campaign + KPI + threshold/timing origin | Non-additive rates, averages, and duration thresholds. |

## Agent Data Dictionary mappings

The Agent Data Dictionary deliberately separates four incompatible grains used by the agent dashboard: current point-in-time agent snapshots, historical agent-time intervals, contact legs, and routing attempts. Evaluation and schedule data add their own submitted-evaluation and schedule-interval grains. A visual connector means “feeds or validates the next analysis,” not “these values may be added,” unless the table explicitly displays a zero-balance roll-up.

| Display metric | Classification | Amazon Connect acquisition | Snowflake implementation |
|---|---|---|---|
| Online agents | Amazon provided | `GetCurrentMetricData: AGENTS_ONLINE`; point-in-time queue/routing-profile filter set. | Preserve the request/result in `FCT_CONNECT_METRIC_INTERVAL`; validate distinct latest `AgentARN` whose `AgentStatus.Type != OFFLINE`. |
| Available agents | Amazon provided | `GetCurrentMetricData: AGENTS_AVAILABLE`. | Preserve native result and validate the canonical latest-state classification. Do not infer availability from online minus on-contact because native current states overlap. |
| Exclusive current agent state | Derived | Latest `AgentEvent.CurrentAgentSnapshot` per `AgentARN`; classify exactly one of ready, actively handling, ACW-only, custom/unavailable, or error/missed-blocked. | `FCT_AGENT_STATE_INTERVAL` keyed by instance, agent, interval start. Test one state per online agent at snapshot time and roll-up equals `AGENTS_ONLINE`. |
| Online time | Amazon provided | `GetMetricDataV2: SUM_ONLINE_TIME_AGENT`; seconds, agent activity grain, cannot be grouped/filtered by queue. | Preserve native metric. Validate sum of typed agent-statistic `onlineTime/1000`; group only by supported agent/hierarchy dimensions. |
| Agent contact time | Amazon provided | `SUM_CONTACT_TIME_AGENT`. | Preserve native metric and validate against agent-statistic contact time. It excludes contact time while the agent is in custom/Offline status under Amazon's definition. |
| Agent idle time | Amazon provided | `SUM_IDLE_TIME_AGENT`; includes routing time and error-state duration. | Preserve native result; validate `idleTime/1000`. Do not add error time again in the online-time reconciliation. |
| Custom-status time | Amazon provided | `SUM_NON_PRODUCTIVE_TIME_AGENT`; Amazon's label means custom CCP status, not necessarily unproductive work. | Preserve native result and map raw status ARN/name to an approved business reason dimension. |
| Error status time | Amazon provided | `SUM_ERROR_STATUS_TIME_AGENT`; diagnostic duration subset. | Preserve as a non-additive diagnostic. Validate error contact intervals and prohibit inclusion as an additional child of online time. |
| Contacts handled and channel children | Amazon provided | `GetMetricDataV2: CONTACTS_HANDLED`, filtered separately by `CHANNEL=VOICE|CHAT|TASK|EMAIL`; disconnect-time contact cohort. | Preserve each request/filter set; validate non-null `Agent.ConnectedToAgentTimestamp` on `FCT_CONTACT_LEG`. Enabled channel children must be exhaustive. |
| Total routing attempts | Derived | Accepted offer attempts plus `AGENT_NON_RESPONSE`; attempt grain. | `FCT_AGENT_OFFER_ATTEMPT` key `INSTANCE_ID + CONTACT_ID + ATTEMPT_ORDINAL`; test accepted + non-response = all attempts and never join to contacts without explicit aggregation. |
| Agent non-response attempts | Amazon provided | `GetMetricDataV2: AGENT_NON_RESPONSE`; one contact can count multiple times. | Preserve native result and validate against offer events. Separately use `AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS` for a voice-only responsiveness control where needed. |
| Average handle time | Amazon provided | `AVG_HANDLE_TIME`; interaction + hold + ACW + applicable task pause. | Preserve native result. Validate from contact-record durations using Amazon null/zero rules; never sum separately averaged components. |
| Average interaction / hold / ACW / holds | Amazon provided | `AVG_INTERACTION_TIME`, `AVG_HOLD_TIME`, `AVG_AFTER_CONTACT_WORK_TIME`, `AVG_HOLDS`. | Preserve each native result and exact filters; validate from `AgentInteractionDuration`, `CustomerHoldDuration`, `AfterContactWorkDuration`, and `NumberOfHolds`. |
| Occupancy | Amazon provided | `AGENT_OCCUPANCY`, statistic `AVG`; contact time / (contact + idle), does not account for concurrency. | Preserve numerator/denominator scope and native value. Compare only within compatible channel/hierarchy cohorts. |
| Agent answer rate | Amazon provided | `AGENT_ANSWER_RATE`, statistic `AVG`; accepted routing attempts / all routing attempts. | Preserve native result and validate against `FCT_AGENT_OFFER_ATTEMPT`; rate must be 0–100 and use attempt grain. |
| Scheduled / adherent / non-adherent time | Amazon provided, optional | `AGENT_SCHEDULED_TIME`, `AGENT_ADHERENT_TIME`, `AGENT_NON_ADHERENT_TIME`; only where Forecasting & Scheduling and published schedules are available. | `FCT_AGENT_SCHEDULE_INTERVAL` keyed by instance, agent, schedule interval start and schedule version. Test adherent + non-adherent = scheduled; allow Amazon recalculation for schedule changes. |
| Schedule adherence | Amazon provided, optional | `AGENT_SCHEDULE_ADHERENCE`; statistic and supported group/filter set stored with result. | Preserve native percentage; validate adherent / scheduled using the same published schedule version and adherence configuration. |
| Availability gap by interval | Derived | Required staffing minus exclusive ready-for-routing agent count, floored at zero. Required staffing comes from Connect scheduling only when available. | `GREATEST(required_agents - available_agents,0)` at interval + queue/demand-group grain; store local timezone and interval. Do not substitute `AGENTS_ONLINE` for available agents. |
| Evaluations performed | Amazon provided | `EVALUATIONS_PERFORMED`; submitted evaluations, calibration excluded, submitted-evaluation timestamp; required agent/queue/routing/hierarchy filter. | Preserve native result and evaluation form/version. Validate distinct submitted non-calibration evaluation IDs. |
| Average weighted evaluation score | Amazon provided | `AVG_WEIGHTED_EVALUATION_SCORE`; evaluation form version weights, calibration excluded. | Preserve native value by form/version and group. Never compare agents using incompatible form versions without normalization. |
| Evaluation coverage | Derived | Distinct evaluated eligible `ContactId` / distinct eligible handled `ContactId`. | Join evaluation fact to `FCT_CONTACT_LEG`; store numerator, denominator and eligibility policy; return null for zero denominator. |
| Customer disconnected while on hold | Amazon provided | `CONTACTS_ON_HOLD_CUSTOMER_DISCONNECT`. | Preserve native result and validate `PreDisconnectState=CONNECTED_ONHOLD` plus customer disconnect reason. |
| Transfer-out rate | Derived | `CONTACTS_TRANSFERRED_OUT / CONTACTS_HANDLED` with identical scope and cohort. | Store numerator and denominator in semantic output; distinguish all transfers from `CONTACTS_TRANSFERRED_OUT_BY_AGENT` if coaching agent behavior. |

### Agent Snowflake objects

| Object | Grain / primary key | Implementation purpose |
|---|---|---|
| `RAW_CONNECT.AGENT_EVENT` | `INSTANCE_ARN + EVENT_ID` | Lossless Kinesis payload for LOGIN, LOGOUT, STATE_CHANGE, HEART_BEAT; retain payload hash and ingestion metadata. |
| `ANALYTICS_CONNECT.FCT_AGENT_STATE_INTERVAL` | `INSTANCE_ID + AGENT_ARN + INTERVAL_START_TS` | Ordered, non-overlapping canonical state intervals with raw status and contact-state context. |
| `ANALYTICS_CONNECT.FCT_AGENT_OFFER_ATTEMPT` | `INSTANCE_ID + CONTACT_ID + ATTEMPT_ORDINAL` | Accepted and non-response routing outcomes at attempt grain. |
| `ANALYTICS_CONNECT.FCT_AGENT_SCHEDULE_INTERVAL` | `INSTANCE_ID + AGENT_ARN + SCHEDULE_INTERVAL_START_TS + SCHEDULE_VERSION` | Optional published schedule, adherent and non-adherent intervals. |
| `ANALYTICS_CONNECT.FCT_CONTACT_EVALUATION` | `INSTANCE_ID + EVALUATION_ID` | Submitted evaluation, calibration flag, form/version, score and linked contact. |
| `MART_CALL_CENTER.AGENT_DAILY_PERFORMANCE` | `REPORT_DATE + INSTANCE_ID + AGENT_ARN + CHANNEL + QUEUE_ID` | Permissioned scorecard with native metrics, numerators/denominators and source versions. |

Agent-event ingestion is append-only and idempotent by `EventId`. Rebuild state intervals for a rolling late-arrival window and use `EventTimestamp`, not ingestion time, for ordering. HEART_BEAT events arrive every 120 seconds when no other event occurs and can continue after logout; canonical interval logic must treat an explicit LOGOUT/OFFLINE state as authoritative. Current snapshot values need a capture timestamp and freshness SLA. Evaluation and schedule facts need their own late-change policies because submitted evaluations and edited schedules can update prior periods.

## Required automated tests

- Unique contact-leg key and unique offer-attempt key.
- Accepted enumerations for channel, initiation method, disconnect reason, and terminal classification.
- No negative durations; timestamp ordering checks.
- One root journey per mapped contact leg; zero duplicate, orphan, unresolved-next, or multiple-root exceptions.
- Parent total equals the sum of its mutually exclusive child rows.
- Full period equals office-hours plus non-office-hours for every additive population.
- Connect API value equals Snowflake validation value where both use identical grain, timestamp, and filters.
- No divide-by-zero; rates return null when the denominator is zero.
- Metric-contract tests fail when a displayed metric lacks either its Amazon acquisition mapping or Snowflake mapping.
- Shared outbound voice rows contain only telephony campaign attempts; preview and digital modes are rejected.
- Every voice delivery attempt has exactly one delivery mode; agent-assisted + automated = shared voice delivery attempts.
- One final delivery disposition per attempt and one AMD disposition per outbound contact leg within each mode.
- Agent-assisted human answered equals connected-to-agent + abandoned-before-agent + approved other pre-agent exits.
- Automated human answered equals automated completion + transfer requested + pre-completion customer disconnect + approved flow/system error.
- Automated transfer requested equals transfer connected + transfer abandoned + approved transfer/flow failure.
- Every abandonment duration record has one timing origin and exactly one exclusive band.
- Accepted campaign offers equal distinct connected campaign contact legs while all offer totals remain at attempt grain.
- Interval grain is part of the metric request key: `TOTAL`, `WEEK`, `DAY`, `HOUR`, `THIRTY_MIN`, and `FIFTEEN_MIN` rows for the same metric and filter set coexist and never upsert one another.
- Non-additive metrics (rates, thresholds, current-state snapshots) are stored with their own window and are never re-aggregated across intervals.
- A visual with partial API history must label exact API points and provisional archive points separately; API-verified heat-map cells must reconcile exactly to their window total.
