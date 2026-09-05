# Call-center metric governance playbook

Public-release gate: commit only parameterized mappings, code and empty sanitized data placeholders. Never commit names, user/resource IDs, individual performance, raw API responses or credentials. The public renderer must keep every dictionary accessible while showing withheld data as unavailable, not zero or verified. Run `scripts/verify-public-release.cjs` before publishing. Keep private live-data fixtures outside the public checkout; credentials remain in the existing AWS provider, unchanged. See `PUBLICATION.md`.

Last updated: 2026-09-04

Navigation entry: use the main Call Center Operations card, not a top-level audit tab. Its handler opens the current inbound dashboard directly and bypasses the retired generic operations pane. Keep all six internal dashboard/dictionary choices and source links functional without a parent-tab dependency.

## Current agent performance contract and verification lessons

The agent dashboard and dictionary now share `data/agent-operations-registry.json` and real API evidence in `data/agent-operations-snapshot.json`. Fifteen native metrics were queried at TOTAL, DAY, AGENT TOTAL and AGENT DAY grains. Fourteen have team values; schedule adherence has no rows. Do not retain the old mock profile, invented targets or evaluation-coverage math as active controls. The centerwide dashboard/dictionary pair is retired; only inbound, outbound and agent pairs remain.

Director questions: Who is carrying voice workload? Which routing attempts are not answered, including/excluding customer abandons? How do interaction, hold and wrap-up change over time? How is all-channel activity distributed? What evidence exists for scheduling and quality? What is each named agent's native value? Current agent state answers a separate point-in-time question.

Rules learned and enforced:

1. `ListQueues` STANDARD enumeration and an Assistant QUEUE_TYPE filter are not proven equivalent. Our controlled queue list produces 5,262 handled contacts while Assistant produces 5,264 for Aug 12–15 ET. The native DAY and AGENT sums independently reconcile to 5,262. Retain the discrepancy; never force a result to match by adding two contacts or asserting an unproven historical-deleted-queue cause.
2. Routing-profile activity metrics have a different supported scope from voice queue metrics. Preserve both scopes and exact IDs; do not mix them into a funnel or a single additive total.
3. The observed V2 occupancy value is a ratio while the Assistant tool displays percentage-scale occupancy with a different population. Explicit `*100` presentation conversion is approved only with raw evidence and native contact/(contact+idle) validation at the same scope/agent/interval. Treat it as a derived display conversion. Do not auto-rescale every number under 1 or treat the Assistant's 15.773% as verification of our 15.278%.
4. Prefer native team and agent rates/averages. No average-of-averages, offer denominators from handled-plus-missed, additive AHT components with different denominators, or evaluated-contact coverage from evaluation counts.
5. Missing adherence data stays unavailable. Mixed-form evaluation scores lack fair-comparison context and are not ranked. Empty native values, zero and failures are distinct.
6. Assistant matches are scoped to the specific comparison: five team metrics matched, two rounded; two discrepancies remain. Neither matching a total nor successful AGENT grouping independently verifies each agent or day. Grouping was tested directly through V2 when the Assistant's interface questioned it.
7. Agent names use instance + User.Id, never name joins. First/last names are current directory attributes. Current GetCurrentUserData state/slots are a separately dated snapshot; omit customer Contacts arrays and never infer Offline/zero from a missing row/key. No refresh loop or real-time SLA exists in this local prototype.
8. Use the same searchable/expandable dictionary format and exact-source focus links across all three domains. Agent date filters select either the full native TOTAL or one native DAY. Trends retain their explicitly labeled four-day history. Do not offer a custom multi-day native-average filter without a corresponding API query.
9. Update all three contracts, `docs/agent-operations-snowflake.sql`, and tests when changing an agent metric or filter. Warehouse grain includes full scope, metric specification, interval and dimensions; late records replace only the same complete key, with immutable raw evidence retained. Deploy role-limited manager views before sharing identities.

Run `node scripts/verify-agent-operations.cjs` and, with jsdom available, `node scripts/verify-agent-ui.cjs`. Also retain inbound/outbound regression checks. The SQL and semantic mapping are proposed implementation artifacts, not proof a production Snowflake pipeline exists.

## Current outbound verification and graph contract

The outbound dashboard and current dictionary consume `data/outbound-operations-registry.json` and the same raw-backed snapshot. `scripts/verify-outbound-api.py` performs fresh read-only requests: 13 OUTBOUND-only metrics at Aug 12–15 ET, four campaign metrics separately at Aug 27–28. `scripts/verify-outbound-charts.cjs` checks acquisition and all chart mappings. Native DAY/HOUR/QUEUE rows support the new graphs; never allocate period totals into fake trends/heat maps. Date controls filter loaded complete days only. Missing does not mean zero; averages cannot be averaged; queue ranking and campaign scope cannot silently follow unsupported date filters.

Assistant-matched values form the highlighted evidence core, but the badge requires an independently queried matching value and matching documented business scope. The initial prompt must not supply the expected number. The current five full-window matches are handled outbound and the four campaign totals. Successful filtered API results remain usable with Amazon-documentation/API verification when the Assistant's own tool lacks the required metric filter. Preserve and display that limitation; its metadata is not authoritative proof of API incapability. A matching total does not verify a daily/queue breakdown or reveal the Assistant's exact queue-ID request.

The independent follow-up also returned handled daily values 898, 859, 851 and 39 for August 12–15. Record these separately under `daily_matches` and compare each plotted date/value before granting a daily-series badge. This does not verify the created line beside it or any hourly/queue breakdown.

Do not equate handled outbound with a human answer; voicemail/endpoint classification needs separate evidence. Hold disconnect includes agent and customer, transfer-out is not necessarily after answer, connection-time handled differs from disconnect-time handled, and connecting time is agent activity-driven. Campaign connected has answering-machine-detection-dependent eligibility; campaign progress is recipient progress, not connection rate. CREATED-minus-HANDLED remains a provisional remainder, not a production customer-not-answered outcome. The old 120 campaign abandonment example and unsourced targets are removed from the current dictionary and excluded from the evidence-driven charts. Do not remove limitation notices while refreshing verification.

All updated graph/metric definitions are mirrored in the detailed Snowflake contract and `current_outbound_contract` in the machine-readable contract. The user requested final-form cleanup: remove superseded outbound tables and the old-reference disclosure from the page, not current caveats or API evidence. Match the inbound dictionary's topic navigation, search, expandable rows, technical disclosures and downloads. Chart source links must reveal the current definition even when a different topic/search is selected. Do not re-inject the old shared definition cards or fall back to mock metrics on load errors.

## Current inbound operating contract

`data/inbound-operations-registry.json` governs the rebuilt Inbound Dashboard and Inbound Data Dictionary. It supersedes earlier inline inbound definitions and the historical fixed-card descriptions later in this document. Both views read one registry and one saved or freshly queried API snapshot. The new local server (`scripts/inbound_operations.py --serve 4318`) can refresh dates and queue scope; this capability replaces the earlier pending-only date controls. Historical comparisons always exclude today. No current Snowflake connection or warehouse equality is asserted.

September 4 live validation retrieved all 27 native measures in the new view. Preserve request/response evidence and nulls. Two initially requested primary-only metrics failed their initiation filter: AHT and average hold time. Use their successful all-voice metrics with explicit labels instead of inventing primary values. API response metric filters include `Negate=false` even if the request omits it: normalize that default when joining results to registry entries, never accidentally discard filtered series.

The returned hourly series is sparse: 55 hourly buckets for a 96-hour window. Its counts sum to the matching TOTAL for primary created, primary handled, primary abandoned, all abandoned, and queued. Missing hours remain missing in charts; do not synthesize zeros. A sum check and a completeness check are distinct. Do not join across a missing hour or fabricate monthly history. Native reporting-hour activity is not automatically an arrival-hour staffing forecast.

The live Connect Assistant remains a cross-check, not an overriding authority. Its tool could not apply metric-level initiation filters even though the API accepted them. It repeated API counts supplied by us in a follow-up; those repetitions are not independent verification. It matched several all-voice totals, but did not expose a queue-ID envelope. Use the status **Value matched**, not a claim that the full envelope was proven identical. Record definition conflicts, especially SERVICE_LEVEL's queue-removal numerator and the contact-record timestamp basis. Do not carry a verification status into a new date or queue selection.

**Derived calculation gate:** The 763 created-minus-handled remainder stays provisional while the assistant disputes the cohort interpretation. The official historical guide describes disconnect-date selection for contact-record-driven metrics, but arithmetic alone cannot prove that every record belongs to the intended unanswered-caller population. Do not describe the remainder as a unique caller count, initiation-date cohort, or callback list. Primary abandonment + non-primary abandonment is a valid subset-complement arithmetic presentation when both use the same native abandoned metric and identical envelope. Never describe the non-primary complement as exclusively transferred calls.

**UX acceptance:** User-facing metric names explain the operating question; stable SQL-compatible IDs and native Amazon fields are visible in the linked dictionary. Avoid arbitrary red severity, universal staffing targets, decorative error-number badges, giant engineering tables and overlapping connectors. Keep API request JSON, response JSON, Snowflake SQL and data tests inside metric disclosures. Dashboard links must open and focus the exact definition. All date/queue changes must re-query before labels or numbers change. Exports preserve provenance. Responsive layouts must contain wide heatmaps and queue tables in scroll regions.

**More graphs, same definitions:** Director questions now have side-by-side daily demand/answer lines, a daily primary/non-primary abandonment stack, native daily service-level/abandonment-rate lines, and a top-six queue abandonment ranking. Reuse existing native DAY and queue-grouped TOTAL evidence. Do not interpret demand and handled lines as a verified contact cohort, add the two service percentages, or present top-six queues as exhaustive. Only the already-governed same-scope abandonment complement is stacked. Preserve gaps and distinguish zero from missing; reject duplicate daily native rows. Every legend links to its definition and daily exact-value disclosures are available. Run `node scripts/verify-inbound-charts.cjs` along with the existing evidence tests.

This is the durable handoff for both application developers and the future Snowflake implementation. It records how this repository turns a call-center director's question into a governed Amazon Connect metric that can be reproduced by an API pull and then rebuilt or validated in Snowflake.

This playbook is the process and decision record. The row-level implementation contracts remain:

- `data/amazon-connect-metric-contract.json` — machine-readable source of truth for exact mappings, formulas, grains, filters, tests, and UI flow connections.
- `docs/amazon-connect-snowflake-contract.md` — detailed human-readable Amazon Connect and Snowflake implementation contract.
- `index.html` — current visual expression of those contracts.

## Product concept: action dashboards paired with verified data dictionaries

The centerwide pair is **Call Center Metrics → Call Center Metrics Dictionary**. It is the Call Center Operations landing view and contains only the highest-impact metrics from the inbound, outbound, and agent domains. It does not create a fourth metric grain. Each card preserves the reporting window and grain of its governed source, and its source link lands on the matching centerwide dictionary row.

The centerwide page uses three visible verification states:

- **API + Assistant verified** — the reproducible Amazon API request and the captured Connect Assistant answer use an identical envelope and return the same value.
- **API verified · Assistant pending** — the Amazon identifier and live result were reproduced, but the same-envelope Assistant question has not yet been captured.
- **Mock · access pending** — the required API action or source stream is blocked. No production value is published and the mock may not enter Snowflake production facts.

As of 2026-08-29, the completed Aug 1–26 ET inbound values were reproduced again from live `GetMetricDataV2` using all standard queues and `CHANNEL=VOICE`. Contacts incoming = 17,844 and Contacts handled incoming = 11,205 are API-verified with explicit `INITIATION_METHOD` metric filters. A same-window Assistant prompt returned broader all-VOICE totals of 106,034 and 33,149 because its interface did not apply those metric filters; they are therefore documented as scope-different, not equal. Contacts abandoned = 6,904, native abandonment rate = 27.5608782435%, and `SERVICE_LEVEL` with a strict less-than-30-second threshold = 59.4491017964% matched the Assistant at display precision. For Aug 1–15 ET, outbound answered = 8,980 matched the Assistant; the live API accepted `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME` with `INITIATION_METHOD=OUTBOUND` and rejected the Assistant-proposed `CONTACTS_HANDLED_OUTBOUND` identifier. For the director's current-capacity card, native `GetCurrentMetricData: AGENTS_AVAILABLE` with `CHANNEL=VOICE` returned 8 at `2026-08-29T19:13:19.031Z` and matched the Assistant. A separate `GetCurrentUserData` snapshot returned 17 users with 13 status labels equal to `Available`; this remains diagnostic context because status availability and open voice capacity are different measures.

Campaign access was re-tested successfully on 2026-08-29. `connectcampaignsv2:ListCampaigns` enumerated the managed campaign `NY-NL-1-1032-v2-08-27`, and campaign-scoped `GetMetricDataV2` returned 44 send attempts, 7 connected campaign contacts, 85 recipients targeted, and 100% campaign progress for Aug 27–28 ET. The published campaign connection rate is therefore 7 / 44 = 15.9%; it is explicitly attempt-based, not recipient-based.

The three reference views are named **Inbound Data Dictionary**, **Outbound Data Dictionary**, and **Agent Data Dictionary**. They are not the director dashboards themselves. Each dictionary defines the data that its respective dashboard is allowed to use, explains whether every value is Amazon-provided or derived, exposes its exact source and calculation, and records verification against both Connect Assistant and a reproducible Amazon API request.

The domain action views are **Inbound Dashboard**, **Outbound Dashboard**, and **Agent Performance Dashboard**; the centerwide action view is **Call Center Metrics**. Navigation presents each action view beside its corresponding dictionary so the operating question and its proof remain one click apart. Every dashboard metric exposes an owner, an exception condition, a recommended next action, and a source control that lands on a focused dictionary definition.

Dashboard source links must land on a definition that visibly states the exact Amazon field, plain-English meaning, Amazon-provided or Derived classification, formula, Connect Assistant verification status, reproducible API verification status, and reconciliation-table lineage. A metric must enter a dashboard through its governed dictionary contract; dashboard code must not invent a parallel definition.

The Inbound Dashboard and Inbound Data Dictionary now enforce that rule through one shared metric registry. Each registry entry carries a stable semantic name, fixed reporting cohort, metric grain, exact Amazon acquisition or governed formula, Snowflake destination, reconciliation row, and required data-quality tests. Director tiles and detail cards contain only a reference to that registry entry. A visible date control is not permission to relabel a frozen snapshot: until a successful refresh loads the requested window, the UI must continue to state the verified August 12–15 ET envelope and identify the date selection as pending refresh.

## Non-negotiable goal

The dashboard must answer the questions a call-center director actually asks, while preserving the exact Amazon meaning of every number. For every governed metric, the following must agree:

1. The director's plain-English question and intended business population.
2. Amazon Connect Assistant's interpretation, terminology, filters, reporting window, and reported value.
3. A reproducible Amazon Connect API or approved record-level extraction using the same scope.
4. The Snowflake semantic result produced from the governed source and transformation.
5. The value and label displayed in the application.

The acceptance equation is:

```text
director meaning
  = Connect Assistant interpretation
  = API request meaning
  = Snowflake semantic meaning
  = dashboard meaning

Connect Assistant value
  = reproducible API value
  = Snowflake value
  = dashboard value
```

If the meanings or values do not match, the metric is not verified. Record the discrepancy; do not rename, re-scope, or arithmetically adjust one result merely to make the numbers agree.

## Authority and evidence hierarchy

Use the following order when sources disagree:

1. A successful, saved Amazon API request and response using a published, supported contract.
2. Current official Amazon Connect API reference and metric-definition documentation.
3. Governed exported contact records or approved Connect data-lake tables using documented field semantics.
4. Connect Assistant as a required terminology and expected-result cross-check.
5. Dashboard copy, mock data, prior screenshots, or undocumented legacy logic.

Connect Assistant is required for alignment, but it is not executable authority. It can use a friendly report label that is not a valid API identifier. A known example is **Contacts handled incoming**: the assistant-facing label maps to `GetMetricDataV2: CONTACTS_HANDLED` with `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)`. A live API request rejected `CONTACTS_HANDLED_INCOMING` as an invalid metric name.

The same rule applies when the Assistant says it could not enforce a filter or proposes a convenient metric identifier. On 2026-08-29 it returned broader all-VOICE created/handled totals because its query interface did not apply the requested `INITIATION_METHOD` filter, even though the live `GetMetricDataV2` API accepts that metric filter. It also proposed `CONTACTS_HANDLED_OUTBOUND`; the live API rejected that name while accepting `CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME` and `CONTACTS_HANDLED` with `INITIATION_METHOD=OUTBOUND`, both of which returned the Assistant's 8,980 value for the same Aug 1–15 ET envelope. Record the Assistant result, but govern the executable API contract.

When Assistant and a successful official API request conflict, keep both pieces of evidence, mark the discrepancy, and govern the published API behavior until the discrepancy is resolved with Amazon.

## Required workflow for every metric

### Step 1 — Freeze the director question

Write one question with an explicit population and time basis. Avoid ambiguous business labels such as “missed,” “incoming,” “answered,” or “abandoned” without qualifying them.

Examples:

- “How many original external inbound voice contact legs were created during the completed reporting period?”
- “How many queued voice contacts disconnected before agent connection?”
- “How many original inbound calls were not handled between 8:00 AM inclusive and 10:00 PM exclusive in America/New_York?”

### Step 2 — Ask Connect Assistant using the same envelope

Capture:

- Exact prompt.
- Assistant display label and explanation.
- Reported value and unit.
- Start and end time, including whether the end is exclusive.
- Time zone.
- Queue/routing-profile scope.
- Channel.
- Initiation method, disconnect reason, threshold, and any other filters it says it used.
- Whether the value is a count, rate, average, maximum, current snapshot, or derived result.

Do not compare a dashboard month to a rolling period, a calendar day to a completed-contact period, all queues to standard queues, or Eastern time to UTC.

### Step 3 — Map the assistant answer to an exact Amazon contract

Prefer a native Amazon metric when it has the same meaning, population, grain, time basis, and filter support. Record:

- API or source: `GetMetricDataV2`, `GetCurrentMetricData`, contact records, agent events, campaign data, or approved data-lake source.
- Exact metric identifier or record fields.
- Statistic and unit.
- Filters and their exact API shape.
- Threshold object and comparison.
- Start/end timestamps and event-attribution basis.
- Grain.
- Exclusions.
- Request payload or reproducible extractor command.

Label a displayed result `AMAZON_PROVIDED` only when Amazon returns that exact displayed value without custom arithmetic, custom cohort composition, normalization, or classification. A metric made from Amazon fields is still `DERIVED` if this application performs the calculation.

### Step 4 — Run and retain a reproducible API check

Store the request envelope and raw response. The validation must prove both request acceptance and result agreement with Assistant. A request that merely succeeds is not proof that the business meaning matches.

For historical metrics, preserve at least:

```text
instance_id
start_time_utc
end_time_utc
time_zone
interval_period
queue_ids or queue_scope_hash
channel
metric_name
metric_filters
threshold
retrieved_at_utc
raw_response
```

For current metrics, persist Amazon's `DataSnapshotTime` and never compare a current snapshot to a historical period metric.

### Step 5 — Define the Snowflake implementation before publishing

Every metric must state:

- Raw source object and immutable ingestion key.
- Curated model.
- Semantic target and column name.
- Grain and primary key.
- Required joins and lineage.
- Deduplication and late-arrival behavior.
- Time-zone and office-hours derivation.
- Exact SQL or governed formula.
- Numerator and denominator for rates.
- Tests and reconciliation controls.
- Refresh cadence and idempotent merge rule.

### Step 6 — Apply the three-way value gate

For the identical request envelope, verify:

```text
assistant_value = api_value = snowflake_value
```

Then verify the dashboard reads the same governed Snowflake row or approved frozen API fixture. Store the request-envelope hash with the result so a coincidental numeric match across different scopes cannot pass.

### Step 7 — Connect the visual flow only when the data flows

Draw a parent-to-child connector only when the downstream parent is the exact upstream metric carried forward with the same:

- Reporting window.
- Instance.
- Channel.
- Queue scope.
- Filters.
- Event-time basis.
- Grain.

Use a labeled diagnostic relationship instead of a reconciliation arrow when metrics are related but not additive. Never use a connector merely because two labels sound related.

## Metric classification and grain rules

### Common grains

| Grain | Typical use | Must not be reconciled directly to |
|---|---|---|
| Contact leg | Created, handled, abandoned, transferred contact metrics | Root customer journeys or offer attempts |
| Root customer journey | End-to-end customer experience across transfer/callback legs | Native contact-leg counts without lineage resolution |
| Queue episode or queued contact leg | Queue entry, answer, abandon, wait duration | Unqueued contacts or agent-offer attempts |
| Agent-offer attempt | Agent non-response and offer acceptance | Unique callers or handled contact legs without distinct-contact conversion |
| Metric interval/request envelope | Native aggregates, averages, rates, and maxima | Raw contact rows without reproducing Amazon eligibility rules |
| Queue snapshot | Contacts currently waiting and oldest waiting age | Historical completed-period metrics |

Keep contact legs separate from journeys. Use `INSTANCE_ID + CONTACT_ID` as the contact-leg key and resolve parent/previous/next lineage separately.

### Additive versus non-additive metrics

- Counts may be summed only across disjoint intervals with identical definitions.
- Rates and percentages require their governed numerator and denominator or a compatible native aggregate.
- Averages must not be simple-averaged across intervals.
- Maxima must not be added or averaged.
- Cumulative threshold counts must not be added. Exclusive bands require adjacent-threshold subtraction or one record-level `CASE` assignment.
- Reconciliation children must be mutually exclusive and collectively exhaustive relative to the stated parent.

### Interval grain is part of the request key

A metric identifier alone does not identify a value. `Interval.IntervalPeriod` is part of the request key alongside the metric, filters, threshold, timezone, and window:

- `TOTAL` — one row for the whole window. Used by every published centerwide card today.
- `TOTAL` — one result for the requested window. Month-over-month trends use one `TOTAL` request per ET calendar month because Connect has no `P1M` enum.
- `HOUR` — exact hour cells for weekday/hour heat maps. Request in chunks shorter than three days and use `TimeZone=America/New_York` so buckets are local and DST-correct.
- `DAY` and `WEEK` — valid coarser historical intervals. `FIFTEEN_MIN` and `THIRTY_MIN` are valid finer intervals. `P1D` and `P1M` are not valid Connect interval enums.

The same metric at two grains produces **different warehouse rows** that coexist. Never let an `HOUR` pull upsert a `TOTAL` row or vice versa. Every dictionary row must state its historical request grain and Snowflake column in the `ANALYTICS_CONNECT.*` namespace.

### Shape verification and retention boundaries

The heat map must come from exact `HOUR` results and every 168-cell window must reconcile to its API total. The 12-month trend uses one `TOTAL` request per month. When the live API's retention boundary blocks older months, those points must be labelled provisional archive values and replaced from the Connect data lake or Snowflake; they must never be labelled API verified.

### Source links are a contract, not a convenience

Every KPI card, director-priority signal, chart, heat map, and action-guidance row must expose one governed control that performs all four steps: **switch the view, scroll the exact row into view, move focus to that row, and highlight it.** Focus movement is the accessibility half of the contract and is as required as the scroll. Implement it with `button[data-cc-jump-view][data-cc-jump-target]` driven by `ccJump()`; plain anchors are not acceptable because they neither switch the view nor manage focus. Enforced by `scripts/verify-ccm-source-links.mjs` (centerwide view) and `scripts/audit-call-center-ui.mjs` (all eight views), each at 1440×900 and 390×760.

Two responsive lessons worth not relearning: a grid whose child is a wide 24-column table needs `minmax(0,1fr)`, because bare `1fr` keeps an automatic min-content floor and widens the page; and the scrolled child should be `width:max-content` so its `overflow-x:auto` wrapper scrolls instead of the figure reporting an internal clip.

## Verified Amazon Connect lessons

### Inbound cohort

- `CONTACTS_CREATED` with `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)` is the governed native definition for incoming contact legs used by the Connect Assistant comparison.
- Original external inbound uses `CONTACTS_CREATED` with `INITIATION_METHOD=INBOUND`.
- **Contacts handled incoming** uses `CONTACTS_HANDLED` with `INITIATION_METHOD IN (INBOUND, TRANSFER, QUEUE_TRANSFER)`; `CONTACTS_HANDLED_INCOMING` is not a valid `GetMetricDataV2` metric identifier.
- Original inbound handled uses `CONTACTS_HANDLED` with `INITIATION_METHOD=INBOUND`.
- “Original inbound missed” is derived as created inbound minus handled inbound for an identical completed-period envelope. It is broader than queue abandonment.
- `CONTACTS_QUEUED` and `CONTACTS_ABANDONED` are native operational measures, but queued minus handled minus abandoned is not an approved exhaustive reconciliation.

### Abandonment and thresholds

- `CONTACTS_ABANDONED` is the native queue-abandon count.
- `ABANDONMENT_RATE`, `AVG_ABANDON_TIME`, `AVG_QUEUE_ANSWER_TIME`, and `MAX_QUEUED_TIME` are native non-additive metrics.
- `SUM_CONTACTS_ABANDONED_IN_X`, `SUM_CONTACTS_ANSWERED_IN_X`, and `SERVICE_LEVEL` use a threshold object such as `ThresholdValue=30` and `Comparison=LT`.
- `GetMetricDataV2` does not require a threshold unit field for these metrics; the metric definition supplies the seconds meaning.
- Threshold results are cumulative. Exclusive ranges such as 5 to under 15 seconds are derived.

### Handling and hold

- `AVG_HANDLE_TIME` includes interaction, applicable hold, after-contact work, and applicable agent pause time according to Amazon's rules.
- `AVG_INTERACTION_TIME` excludes hold and after-contact work.
- `AVG_HOLD_TIME` is customer hold after agent connection; queue wait is excluded.
- `AVG_AFTER_CONTACT_WORK_TIME` measures post-interaction wrap-up work.
- `CONTACTS_PUT_ON_HOLD` counts contacts with at least one hold.
- `CONTACTS_HOLD_ABANDONS` counts contacts that disconnected while on hold.

### Transfers

- `CONTACTS_TRANSFERRED_OUT` is the native parent transfer-out measure.
- `CONTACTS_TRANSFERRED_OUT_INTERNAL`, `CONTACTS_TRANSFERRED_OUT_EXTERNAL`, and `CONTACTS_TRANSFERRED_OUT_FROM_QUEUE` are useful diagnostics.
- Do not assume internal plus external exhausts the parent for every scope. The equality seen in one snapshot is not a universal API partition contract.
- Transfer metrics count contact legs/events, not necessarily unique callers. Use the lineage bridge to report customer journeys.

### Agent offers

- An agent offer is Amazon Connect routing a queued contact to an agent and giving the agent a chance to accept it. It is not merely the customer-facing announcement “transferring to an agent now.”
- `AGENT_NON_RESPONSE` is offer-attempt grain and can occur multiple times for one contact.
- `AGENT_ANSWER_RATE` is an offer-attempt KPI and must not be reconciled directly to unique callers.
- “Abandoned without an agent offer” and “abandoned after an unaccepted agent offer” are derived contact-level classifications that require agent-event/contact joins; they are not alternative names for `CONTACTS_ABANDONED`.

### Current queue state

- `GetCurrentMetricData: CONTACTS_IN_QUEUE`, `Unit=COUNT`, is a current queue snapshot.
- `GetCurrentMetricData: OLDEST_CONTACT_AGE`, `Unit=SECONDS`, is the age of the oldest contact currently waiting.
- Persist `DataSnapshotTime` as `observed_at_utc` and append snapshots by instance, queue, and observation time.

### Office hours

The governed office-hours window is `[08:00,22:00)` in `America/New_York`: 8:00 AM inclusive through 10:00 PM exclusive.

`GetMetricDataV2` cannot express one recurring disjoint daily office-hours window across a multi-day period. Office-hours totals are therefore derived even when every daily input is native. Issue one UTC-converted request per local ET date, then sum count metrics across non-overlapping daily windows. Do not simple-average daily rates, averages, percentages, or maxima.

### Outbound

Keep outbound separate from inbound by using its governed initiation/campaign scope. For ordinary outbound contact legs, use native metrics with `INITIATION_METHOD=OUTBOUND` when supported. Automated outbound campaigns may require campaign, segment, or delivery data beyond the standard contact-leg metrics. Do not assume every outbound workflow shares the same denominator or terminal outcomes; document the workflow and dialing mode before connecting tables.

## Snowflake target architecture

| Layer | Object | Grain and purpose |
|---|---|---|
| Raw | `RAW_CONNECT.CONTACT_RECORD` | One source version of a Connect contact record; retain raw JSON and ingestion metadata. |
| Raw | `RAW_CONNECT.AGENT_EVENT` | One routing/agent event for offer-attempt analysis. |
| Raw | `RAW_CONNECT.METRIC_RESULT` | One native API result per interval, metric, and filter envelope. |
| Curated | `ANALYTICS_CONNECT.FCT_CONTACT_LEG` | One `INSTANCE_ID + CONTACT_ID`; typed timestamps, fields, and durations. |
| Curated | `ANALYTICS_CONNECT.FCT_AGENT_OFFER_ATTEMPT` | One offer attempt with outcome and contact key. |
| Curated | `ANALYTICS_CONNECT.BRIDGE_CONTACT_LINEAGE` | One parent-child relationship across transfers and callbacks. |
| Curated | `ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL` | One governed native metric result per request-envelope key. |
| Snapshot | `ANALYTICS_CONNECT.SNAPSHOT_QUEUE_CURRENT` | Queue + Amazon `DataSnapshotTime`; current count and oldest-age observations. |
| Semantic | `MART_CALL_CENTER.MONTHLY_INBOUND_AUDIT` | Month + queue + channel + office-hours bucket; additive audit controls. |
| Semantic | `MART_CALL_CENTER.MONTHLY_INBOUND_KPI` | Month + queue + KPI; governed non-additive director metrics. |

Recommended native-metric primary key:

```text
instance_id
+ start_time_utc
+ end_time_utc
+ queue_scope_hash
+ channel
+ metric_name
+ metric_filters_hash
+ threshold_hash
```

All loads must be idempotent. Retain source update time, ingestion time, payload hash, request envelope, raw response, and batch ID. Reprocess an approved rolling late-arrival window because contact records can change after initial delivery.

## Required tests

At minimum, enforce:

- Assistant/API/Snowflake/dashboard request-envelope hash equality.
- Assistant/API/Snowflake/dashboard value equality once a metric is verified.
- Native parent/component equality only for documented exhaustive filter partitions.
- No negative derived remainder.
- Derived parent = sum of mutually exclusive children.
- Exactly one exclusive classification per parent record.
- Numerator and denominator have identical scope for every rate.
- No simple averaging of rates or averages.
- No addition of cumulative thresholds.
- Every Amazon-provided row contains no application arithmetic.
- Every derived row lists all inputs, formula, grain, time basis, and exclusions.
- Current metrics include Amazon `DataSnapshotTime`.
- Office-hours requests cover exactly 14 local hours per date without overlap and use `America/New_York` DST conversion.
- Connector arrows point only to identical carry-forwards; diagnostics are visibly labeled non-additive.
- Interval-grain rows coexist: `TOTAL`, `WEEK`, `DAY`, `HOUR`, `THIRTY_MIN`, and `FIFTEEN_MIN` for one metric and filter set never upsert one another.
- Heat-map cells sum exactly to their API window total; trend points identify API versus provisional archive provenance.
- Every dashboard control that claims a definition lands on a real dictionary row, in view, focused, and highlighted, at both audited viewports.
- No view has horizontal document or block overflow beyond 2px at 1440×900 or 390×760.

## Required per-metric record

Every new or changed metric must add or update one machine-readable entry containing this information:

```yaml
id: stable_semantic_id
director_question: exact plain-English question
assistant_verification:
  prompt: exact prompt
  label: assistant label
  definition: assistant explanation
  value: reported value
  verified_at: timestamp
  request_envelope_hash: hash
classification: AMAZON_PROVIDED | DERIVED
amazon:
  api_or_source: exact API/stream/table
  metric_or_fields: exact identifiers
  statistic: SUM | AVG | MAX | snapshot
  filters: exact filter object
  threshold: exact threshold object
  start_time_utc: timestamp
  end_time_utc: timestamp
  timezone: America/New_York
  event_time: initiation | enqueue | connection | completion/disconnect | observed_at
  grain: exact grain
  interval: TOTAL | WEEK | DAY | HOUR | THIRTY_MIN | FIFTEEN_MIN | snapshot
  historical_request_grain: the interval grain that must be requested to reproduce this value
  acquired: true | false
  exclusions: explicit exclusions
  formula: required when derived
provenance:                # required for any visual with mixed history sources
  api_verified_points: exact months/windows reproduced from Connect
  provisional_archive_points: values awaiting durable history replacement
snowflake:
  raw_source: object
  curated_source: object
  semantic_target: object.column
  grain: exact grain
  primary_key: key
  joins: required joins
  sql: exact transformation
  tests: required tests
  refresh: cadence, watermark, late-arrival, and MERGE rule
display:
  label: user-facing label
  source_badge: AMAZON_PROVIDED | DERIVED
  flow_parent: exact upstream row or null
```

## Definition of done

A call-center metric, table, chart, filter, or connector is complete only when:

1. The director question is explicit.
2. Connect Assistant has been asked using the same period and scope.
3. The assistant response has been saved or summarized in the contract.
4. The official identifier and request shape have been checked.
5. A reproducible API request succeeds.
6. Assistant and API meanings and values agree, or a documented discrepancy remains visibly unresolved.
7. The Snowflake source, target, SQL, grain, keys, tests, and refresh rules are complete.
8. The machine-readable JSON, detailed Snowflake contract, this playbook, and the UI agree.
9. Automated validation passes.

Future work must update this file whenever it discovers a new source contradiction, scope rule, grain rule, mapping correction, or Snowflake requirement. Do not let critical knowledge live only in a chat transcript.
