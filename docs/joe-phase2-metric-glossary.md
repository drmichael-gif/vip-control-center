# Joe Phase 2 — Metric glossary (live registries + archival stubs)

Aligned to:
- `data/inbound-operations-registry.json` (29)
- `data/outbound-operations-registry.json` (18)
- `data/agent-operations-registry.json` (15)
- Archival centerwide 10 (retired UI; Joe package only)

Classification rule: label **Amazon** only when the displayed value is returned directly by an Amazon Connect metric with no arithmetic/cohort/custom classification. Otherwise **Derived**.

## Service level — keep three concepts separate

| Concept | Source | Threshold / formula | Status vs warehouse |
|---|---|---|---|
| Live inbound `service_level_20` | Amazon native `SERVICE_LEVEL` | threshold 20s | PARTIAL vs CORE `SERVICE_LEVEL` which is Derived TRUE_SLA |
| Derived TRUE_SLA 20s | Warehouse `INT_CONNECT_SERVICE_LEVEL_*` → FCT `SERVICE_LEVEL` | answered_within_20 / (offered − short_abandons_5s) | Not Amazon native; never silent-equate |
| Archival `service_level_lt_30_seconds` | Amazon LT30 (archival contract) | threshold 30s | **MISSING** — do not map to TRUE_SLA or live SL20 |

## Live domains

Use registry ids as glossary keys. Full field / filter / grain / meaning: read the three `*-operations-registry.json` files. Lineage + gap notes: `docs/joe-phase2-lineage.md`.

### Inbound groups (ids)
primary_incoming, primary_answered, primary_not_answered, incoming_total, incoming_transfer, incoming_queue_transfer, incoming_handled, abandoned_total, primary_abandoned, non_primary_abandoned, queued, abandonment_rate, service_level_20, answer_speed, abandon_wait, max_queue_wait, answered_under_20, abandoned_under_5, abandoned_under_20, handle_time, interaction_time, wrap_time, hold_time, held_contacts, hold_disconnects, non_response, agent_answer_rate, transferred_out, queue_transferred_out

### Outbound groups (id + semantic)
created [Outbound_Call_Legs_Created], handled [Outbound_Legs_Handled], remainder [Outbound_Created_Minus_Handled_Provisional], customer_disconnect, agent_disconnect, third_party_disconnect, other_disconnect, held, hold_disconnect, transfer, interaction, wrap, connecting [Outbound_Total_Agent_Connecting_Seconds], handled_connection [Outbound_Handled_At_Agent_Connection], campaign_sends, campaign_connected, campaign_targeted, campaign_progress

### Agent groups
handled, non_response, non_response_excluding_abandons, answer_rate, handle_time, interaction, hold, wrap, occupancy, online, contact_time, idle, non_productive, adherence, quality

## Archival centerwide stubs (10)
contacts_abandoned, contacts_incoming, contacts_handled_incoming, queue_abandonment_rate, service_level_lt_30_seconds, outbound_calls_answered, available_voice_agents_current, campaign_reach_rate, contacts_abandoned_trend_12m, contacts_abandoned_heatmap_dow_hour

## Envelope requirement
MATCH requires Amazon metric name + compatible grain + same classification + usable filters/envelope (`window_*_utc`, `queue_scope_hash`, `metric_filters_hash`, `source_classification`, `formula_version`). Until `ANALYTICS_CONNECT` lands those, expect near-zero MATCH.
