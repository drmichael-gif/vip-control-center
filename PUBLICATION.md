# Public mapping edition

This repository preserves the inbound, outbound and agent dashboard implementations,
metric registries, Amazon Connect field/filter definitions, disclosed formulas and
Snowflake/semantic-layer contracts. The public site intentionally withholds live data.

## Not included

- Real agent names, usernames, IDs and per-agent performance records.
- Current agent-state records, raw API response pages or deployment resource IDs.
- API keys, secret keys, session tokens, AWS credential files or local configuration.

Files named `*snapshot*`, `*verification*` and historical Connect extracts in `data/`
are explicit empty public placeholders. No zero or mock result is substituted.
Historical aggregate examples in source/contracts explain verification decisions;
they are not a current data feed or public verification evidence. This release also
replaces previously tracked raw extracts at the latest revision. It does not rewrite
older Git history; maintainers should separately review historical public exposure.

## Private implementation

1. Use a private deployment/checkout before collecting agent records.
2. Configure your AWS account/instance/region and an existing AWS profile outside
   source control. Do not paste access keys into JavaScript, JSON registries or Git.
3. The registry contains parameter placeholders. Supply real queue, routing-profile
   and campaign identifiers privately. The extraction scripts and API request shapes
   are retained as implementation references; run them only in the private checkout.
4. Preserve complete request/response evidence and native units privately. Replace
   public placeholders only in that private environment, then rerun the corresponding
   live-data validation suites before enabling charts. A sanitized placeholder is
   never evidence of API availability or equality.
5. Implement the documented warehouse keys, native aggregation rules and role-limited
   identity joins. Snowflake SQL is a contract, not an already deployed database.

For this public branch run `node scripts/verify-public-release.cjs`. The historical
validation suites require private fixtures and should not be made to pass by supplying
fake values. No credentials were rotated or modified to produce this release.
