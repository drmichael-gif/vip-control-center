#!/usr/bin/env python3
"""Pull the native inbound metrics used by Amazon Connect assistant.

This script intentionally mirrors the assistant's historical-metrics contract:
all standard queues, VOICE, complete ET calendar days, and contact-record metrics
at completion/disconnect time. It does not use SearchContacts or combine unique
original-contact cohorts with queue/contact-leg metrics.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_INSTANCE_ID = "6b3f17ba-68a4-472a-9b20-db1991507009"
DEFAULT_REGION = "us-east-1"
DEFAULT_PROFILE = "vip-connect"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instance-id", default=DEFAULT_INSTANCE_ID)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--profile", default=DEFAULT_PROFILE)
    parser.add_argument(
        "--start",
        default="2026-08-12T04:00:00Z",
        help="Inclusive UTC boundary passed to GetMetricDataV2 (ISO 8601).",
    )
    parser.add_argument(
        "--end",
        default="2026-08-16T04:00:00Z",
        help=(
            "Exclusive UTC boundary passed to GetMetricDataV2 (ISO 8601). "
            "For an inclusive ET through-date, use midnight ET on the following day."
        ),
    )
    parser.add_argument("--timezone", default="America/New_York")
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def aws(env: dict[str, str], region: str, *args: str) -> dict:
    raw = subprocess.check_output(
        ["aws", *args, "--region", region, "--output", "json"],
        env=env,
        stderr=subprocess.PIPE,
    )
    return json.loads(raw)


def metric(name: str, initiation_methods: list[str] | None = None) -> dict:
    item: dict = {"Name": name}
    if initiation_methods:
        item["MetricFilters"] = [
            {
                "MetricFilterKey": "INITIATION_METHOD",
                "MetricFilterValues": initiation_methods,
            }
        ]
    return item


def collection_key(collection: dict) -> str:
    metric_spec = collection["Metric"]
    filters = metric_spec.get("MetricFilters", [])
    methods: list[str] = []
    for item in filters:
        if item["MetricFilterKey"] == "INITIATION_METHOD":
            methods = item["MetricFilterValues"]
    suffix = ":" + ",".join(methods) if methods else ""
    return metric_spec["Name"] + suffix


def main() -> None:
    args = parse_args()
    env = os.environ.copy()
    for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        env.pop(key, None)
    env["AWS_PROFILE"] = args.profile

    instance = aws(env, args.region, "connect", "describe-instance", "--instance-id", args.instance_id)["Instance"]
    queues = aws(
        env,
        args.region,
        "connect",
        "list-queues",
        "--instance-id",
        args.instance_id,
        "--queue-types",
        "STANDARD",
        "--max-results",
        "100",
    )
    queue_ids = sorted(queue["Id"] for queue in queues["QueueSummaryList"])
    incoming_methods = ["INBOUND", "TRANSFER", "QUEUE_TRANSFER"]
    metric_specs = [
        metric("CONTACTS_CREATED", incoming_methods),
        metric("CONTACTS_CREATED", ["INBOUND"]),
        metric("CONTACTS_CREATED", ["TRANSFER"]),
        metric("CONTACTS_CREATED", ["QUEUE_TRANSFER"]),
        metric("CONTACTS_HANDLED", incoming_methods),
        metric("CONTACTS_HANDLED", ["INBOUND"]),
        metric("CONTACTS_HANDLED", ["TRANSFER"]),
        metric("CONTACTS_HANDLED", ["QUEUE_TRANSFER"]),
        metric("CONTACTS_QUEUED"),
        metric("CONTACTS_ABANDONED"),
        metric("CONTACTS_TRANSFERRED_OUT_FROM_QUEUE"),
    ]
    filters = [
        {"FilterKey": "QUEUE", "FilterValues": queue_ids},
        {"FilterKey": "CHANNEL", "FilterValues": ["VOICE"]},
    ]
    response = aws(
        env,
        args.region,
        "connect",
        "get-metric-data-v2",
        "--resource-arn",
        instance["Arn"],
        "--start-time",
        args.start,
        "--end-time",
        args.end,
        "--interval",
        json.dumps({"TimeZone": args.timezone, "IntervalPeriod": "TOTAL"}),
        "--filters",
        json.dumps(filters),
        "--metrics",
        json.dumps(metric_specs),
    )
    if response.get("Errors"):
        raise RuntimeError(json.dumps(response["Errors"], indent=2))
    results = response.get("MetricResults", [])
    if len(results) != 1:
        raise RuntimeError(f"Expected one TOTAL interval, received {len(results)}")
    values = {
        collection_key(collection): collection.get("Value", 0)
        for collection in results[0].get("Collections", [])
    }

    def value(name: str, methods: list[str] | None = None) -> int | float:
        key = name + (":" + ",".join(methods) if methods else "")
        result = values.get(key, 0)
        return int(result) if float(result).is_integer() else result

    created_components = {method: value("CONTACTS_CREATED", [method]) for method in incoming_methods}
    handled_components = {method: value("CONTACTS_HANDLED", [method]) for method in incoming_methods}
    contacts_incoming = value("CONTACTS_CREATED", incoming_methods)
    contacts_handled_incoming = value("CONTACTS_HANDLED", incoming_methods)
    snapshot = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_of_truth": "Amazon Connect GetMetricDataV2; assistant-compatible native historical metrics",
        "request_envelope": {
            "instance_alias": instance["InstanceAlias"],
            "instance_id": args.instance_id,
            "resource_arn": instance["Arn"],
            "region": args.region,
            "start_time_utc": args.start,
            "end_time_utc": args.end,
            "timezone": args.timezone,
            "interval": "TOTAL",
            "channel": "VOICE",
            "queue_scope": "all STANDARD queues enumerated at extraction time",
            "queue_ids": queue_ids,
            "metric_attribution": "contact completion/disconnect time unless the metric name explicitly states another event time",
            "grain": "one native aggregate per metric/filter set; underlying unit is a contact leg or queue episode, not a unique caller",
        },
        "assistant_report": {
            "contacts_incoming": {
                "display_label": "Contacts incoming",
                "amazon_metric": "CONTACTS_CREATED",
                "initiation_methods": incoming_methods,
                "value": contacts_incoming,
                "components": created_components,
                "control": sum(created_components.values()) - contacts_incoming,
            },
            "contacts_handled_incoming": {
                "display_label": "Contacts handled incoming",
                "amazon_metric": "CONTACTS_HANDLED",
                "initiation_methods": incoming_methods,
                "value": contacts_handled_incoming,
                "components": handled_components,
                "control": sum(handled_components.values()) - contacts_handled_incoming,
            },
            "contacts_queued": {
                "display_label": "Contacts queued",
                "amazon_metric": "CONTACTS_QUEUED",
                "value": value("CONTACTS_QUEUED"),
            },
            "contacts_abandoned": {
                "display_label": "Contacts abandoned",
                "amazon_metric": "CONTACTS_ABANDONED",
                "value": value("CONTACTS_ABANDONED"),
            },
            "contacts_transferred_out_from_queue": {
                "display_label": "Contacts transferred out from queue",
                "amazon_metric": "CONTACTS_TRANSFERRED_OUT_FROM_QUEUE",
                "value": value("CONTACTS_TRANSFERRED_OUT_FROM_QUEUE"),
            },
        },
        "display_rules": [
            "Use Amazon's report labels and native metric identifiers verbatim.",
            "Do not compare these completion-timed aggregates with a SearchContacts initiation-timestamp cohort.",
            "Do not add CONTACTS_QUEUED, CONTACTS_HANDLED, and CONTACTS_ABANDONED as though they were one exhaustive partition.",
            "Use the initiation-method component controls only where the children are mutually exclusive and match the parent request envelope.",
        ],
        "snowflake_mapping": {
            "raw_table": "RAW_CONNECT.METRIC_RESULT",
            "curated_table": "ANALYTICS_CONNECT.FCT_CONNECT_METRIC_INTERVAL",
            "primary_key": "instance_id + start_time_utc + end_time_utc + queue_scope_hash + channel + metric_name + metric_filters_hash + threshold_hash",
            "required_columns": [
                "instance_id",
                "start_time_utc",
                "end_time_utc",
                "timezone",
                "interval_period",
                "queue_ids",
                "channel",
                "metric_name",
                "metric_filters",
                "metric_value",
                "retrieved_at_utc",
                "raw_response",
            ],
            "tests": [
                "contacts_incoming equals the sum of INBOUND, TRANSFER, and QUEUE_TRANSFER CONTACTS_CREATED components",
                "contacts_handled_incoming equals the sum of INBOUND, TRANSFER, and QUEUE_TRANSFER CONTACTS_HANDLED components",
                "dashboard request-envelope hash equals warehouse request-envelope hash",
                "dashboard values equal the latest successful warehouse values for the same primary key",
            ],
        },
    }
    output = json.dumps(snapshot, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
