# Data-contract requirement

Every new or changed metric, table row, chart, or filter in this repository must be documented in `docs/amazon-connect-snowflake-contract.md` and, when machine-readable mapping exists, in `data/amazon-connect-metric-contract.json`.

The durable operating and verification workflow is `docs/call-center-metric-governance-playbook.md`. Update that playbook whenever work changes the director-question vocabulary, Connect Assistant comparison procedure, Amazon API acquisition method, Snowflake architecture, validation gates, or a lesson that future developers must not relearn. A call-center metric change is not complete until the playbook, the detailed contract, and the machine-readable contract agree.

For every displayed metric, always maintain both of these implementation contracts:

1. **Amazon Connect acquisition mapping** — identify whether the value is Amazon-provided or derived; include the API/stream, exact metric identifier or contact-record fields, filters, timestamp/cohort rule, grain, statistic, thresholds, exclusions, and formula.
2. **Snowflake analytics mapping** — identify the source and target objects, target column or semantic metric, grain and primary key, joins, transformation SQL, dimensions, tests, and refresh/idempotency requirements needed to reproduce the display.

Do not label a metric “Amazon provided” merely because it uses Amazon data. Use that label only when the displayed value is returned directly by an Amazon Connect metric with no arithmetic, cohort composition, normalization, or custom classification. Otherwise label it “Derived.” Prefer a native Amazon metric whenever it has the same population, grain, time basis, and business meaning as the displayed measure.

All reconciliation children must be mutually exclusive and collectively exhaustive relative to their stated parent. Never mix contact grain with routing-attempt grain or initiation-time cohorts with event-time cohorts without stating and testing the conversion.
