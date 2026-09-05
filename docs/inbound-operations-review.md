# Inbound operations redesign: verification and handoff

Reviewed September 4, 2026. Scope: inbound dashboard and inbound dictionary only. Existing outbound and agent views are unchanged.

## Open locally

Run `python3 scripts/inbound_operations.py --serve 4318` from the project directory, then open http://127.0.0.1:4318/ and choose Call Center Operations → Inbound Dashboard. The server binds to loopback and uses the configured local AWS profile; credentials are not sent to the browser. This is an on-demand historical operations dashboard, not a real-time wallboard or a deployed multi-user service.

## Verified

- 29 registry entries: 27 native API metrics and two explicitly disclosed subtractions.
- August 12–15, 2026 ET: all 27 native TOTAL requests returned values. Exact requests, filters, thresholds, responses and errors are retained in the snapshot.
- All applicable native method partitions and hourly/daily count reconciliations pass; queue-grouped counts reconcile to their native totals.
- 16 numeric values independently matched the Amazon Connect assistant. The assistant did not expose its complete request envelope; a numeric match is not labeled full semantic verification.
- Changed date filter to August 12: primary incoming 816, primary handled 610, provisional remainder 206, all queue abandons 291, primary abandons 163, non-primary complement 128. The dictionary immediately used that same selection.
- Drilled into the agents queue for August 12: primary incoming 534, primary remainder 109, primary and total queue abandons 101, non-primary complement 0.
- Selecting September 4 (the current ET day during this review) was rejected and preserved the previous dated values.
- Dashboard metric source links opened the matching dictionary definition. Assistant comparison badges changed to “Not compared for this selection” for other date/queue scopes.
- Native DAY service-level values render independently from native TOTAL. Threshold metadata normalizes 20 versus 20.0, and filter metadata normalizes the returned default Negate=false.
- Desktop 1440×1000 and narrow 390×844 layouts inspected. Narrow-screen page width stays within the viewport; wide heatmap and queue grid have local scrolling. Queue ranking has a bounded scroll area and sticky headings.

Automated check: `node scripts/verify-inbound-operations.mjs`. Also checked JavaScript syntax, Python compilation and `git diff --check`.

## Do not overstate verification

1. Primary created minus primary handled is mathematically 763 for August 12–15, but the assistant disputed the CREATED reporting-time interpretation. It remains a provisional reporting remainder, not a verified not-answered contact cohort or callback list. Production outcome semantics require contact-record reconciliation or authoritative clarification. The dictionary and SQL examples explicitly warn about this.
2. Amazon returned MAX_QUEUED_TIME=604790.878 seconds (nearly seven days) and AVG_ABANDON_TIME=1415.65456199187 seconds. The assistant independently returned approximately the same values. Investigate contact records/routing; the dashboard does not silently cap or replace these source outliers.
3. AVG_HANDLE_TIME and AVG_HOLD_TIME rejected the tested INBOUND metric filter. Their working pulls and visible labels use all eligible voice origins. The initial failed requests are retained in inbound-operations-initial-audit.json.
4. All-origin queue metrics can include non-primary origins beyond transfers; queue names containing “outbound” are not automatically excluded. Primary cards explicitly use INITIATION_METHOD=INBOUND.
5. Missing API values and omitted hourly buckets remain unavailable, not zero. Counts reconcile across returned buckets where tested. Rates and averages always use native requests, not averages of aggregates.
6. Snowflake DDL, semantic keys and mappings are supplied but have not been executed against Snowflake. The live source currently is Amazon Connect, not a verified Snowflake mirror.

## Governing artifacts

- data/inbound-operations-registry.json: current shared definitions and warehouse contract.
- data/inbound-operations-snapshot.json: verified baseline and raw API evidence.
- data/inbound-assistant-verification.json: assistant comparisons and limitations.
- docs/amazon-connect-snowflake-contract.md: current inbound contract superseding legacy inline inbound definitions.
- docs/inbound-operations-snowflake.sql: warehouse implementation scaffold.

The dashboard and dictionary both render from the same registry and selected API snapshot. No separate hard-coded dashboard figures were introduced.
