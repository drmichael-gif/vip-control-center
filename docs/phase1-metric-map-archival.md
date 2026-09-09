# Phase 1 archival centerwide(10) map — Joe package addendum

Live map remains primary (0/45/17). Archival UI retired; map for Joe only.

## OOBD (archival addendum)
- Outcome: archival 10 mapped — 0 MATCH / 7 PARTIAL / 3 MISSING (service_level_lt_30, queue_abandonment_rate, and treating SL as MISSING vs TRUE_SLA).
- Owner: Call Center Warehouse map; Dashboard Joe package; Snowflake implementation.
- Blocker: same — no ANALYTICS_CONNECT envelope facts.
- Next: do not bind archival LT30 or ABANDONMENT_RATE to CORE; keep separate from live service_level_20.

| id | status | closest | gap |
|---|---|---|---|
| `contacts_abandoned` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.CONTACTS_ABANDONED` | No TOTAL envelope; UI retired |
| `contacts_incoming` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.CONTACTS_CREATED` | Creation-time attribution in contract; warehouse report unfiltered + no 3-method parent |
| `contacts_handled_incoming` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.CONTACTS_HANDLED_INBOUND` | Inbound-only column ≠ 3-method parent |
| `queue_abandonment_rate` | **MISSING** | `—.—` | No ABANDONMENT_RATE |
| `service_level_lt_30_seconds` | **MISSING** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.SERVICE_LEVEL (=TRUE_SLA 20s)` | ≠ live service_level_20; ≠ Amazon LT30; Dashboard rule: do not map |
| `outbound_calls_answered` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.CONTACTS_HANDLED_OUTBOUND / OUTBOUND_CONNECTED` | Window Aug1–15 ≠ inbound Aug1–27; not connection-time metric |
| `available_voice_agents_current` | **PARTIAL** | `PRD_RAW_DB.AMAZON_CONNECT.BRANDED_CAMPAIGN_METRICS.AGENTS_AVAILABLE` | Not FCT_CONNECT_CURRENT_METRIC_SNAPSHOT; do not use status headcount |
| `campaign_reach_rate` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_OUTBOUND_CAMPAIGN_HOURLY.CONNECTED_TO_AGENT_REAL / TOTAL_ATTEMPTS / REAL_CONNECT_RATE_PCT` | Not recipients; not CAMPAIGN_CONTACTS_CONNECTED/SEND_ATTEMPTS envelope |
| `contacts_abandoned_trend_12m` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_DAILY|HOURLY.CONTACTS_ABANDONED` | Can sum days to month only if complete; no stored monthly TOTAL envelope; provisional archive months N/A in WH |
| `contacts_abandoned_heatmap_dow_hour` | **PARTIAL** | `PRD_ANALYTICS_DB.CORE_CONTACT_CENTER.FCT_QUEUE_CONSOLIDATED_METRICS_HOURLY.CONTACTS_ABANDONED` | Closest for DOW×hour; no envelope hash; DST caveats |

## Domain(42) stubs (Copilot notes only — not full remap)
| id | Copilot flag | warehouse note |
|---|---|---|
| `customer_disconnect` | MISSING_GRAIN | Needs disconnect-reason filtered HANDLED; not on live queue outbound partition |
| `agent_disconnect` | MISSING_GRAIN | Same |
| `average_customer_hold_time` | MISSING_GRAIN | AVG_HOLD_TIME exists on queue/agent but contract grain/filters may differ — treat as PARTIAL at best, Copilot labeled MISSING_GRAIN |
| `agent_quality_metrics` | MISSING_GRAIN | EVALUATIONS_PERFORMED/AVG_EVALUATION_SCORE exist but mixed-form; Copilot MISSING_GRAIN for package |
| `agent_schedule_adherence` | OPTIONAL | MISSING/unavailable — never zero |

Hard notes from Dashboard: contacts_incoming creation-time; service_level_lt_30 ≠ live service_level_20; outbound_calls_answered Aug1–15 ≠ inbound Aug1–27; available_voice_agents = current snapshot object; campaign_reach_rate = CONNECTED/SEND_ATTEMPTS not recipients.