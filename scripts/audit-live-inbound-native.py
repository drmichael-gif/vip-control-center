#!/usr/bin/env python3
"""Reproduce the native-only Aug 12-15 Amazon Connect inbound display."""
import json
import os
import subprocess

INSTANCE_ID = "00000000-0000-0000-0000-000000000000"
ACCOUNT_ID = "000000000000"
START = "2026-08-12T04:00:00Z"
END = "2026-08-16T04:00:00Z"
RESOURCE_ARN = f"arn:aws:connect:us-east-1:{ACCOUNT_ID}:instance/{INSTANCE_ID}"
env = os.environ.copy()
for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE"):
    env.pop(key, None)
env["AWS_PROFILE"] = "vip-connect"


def aws(*args):
    raw = subprocess.check_output(
        ["aws", *args, "--region", "us-east-1", "--output", "json"],
        env=env,
        stderr=subprocess.PIPE,
    )
    return json.loads(raw)


queues = aws("connect", "list-queues", "--instance-id", INSTANCE_ID, "--queue-types", "STANDARD", "--max-results", "100")
queue_ids = [queue["Id"] for queue in queues["QueueSummaryList"]]
top_filters = [
    {"FilterKey": "QUEUE", "FilterValues": queue_ids},
    {"FilterKey": "CHANNEL", "FilterValues": ["VOICE"]},
]


def pull(name, metric_filters=None, threshold=None):
    metric = {"Name": name}
    if metric_filters:
        metric["MetricFilters"] = [
            {"MetricFilterKey": key, "MetricFilterValues": values}
            for key, values in metric_filters.items()
        ]
    if threshold:
        metric["Threshold"] = threshold
    response = aws(
        "connect", "get-metric-data-v2",
        "--resource-arn", RESOURCE_ARN,
        "--start-time", START, "--end-time", END,
        "--interval", json.dumps({"TimeZone": "America/New_York", "IntervalPeriod": "TOTAL"}),
        "--filters", json.dumps(top_filters),
        "--metrics", json.dumps([metric]),
    )
    results = response.get("MetricResults", [])
    collections = results[0].get("Collections", []) if results else []
    return collections[0].get("Value", 0) if collections else 0


def optional_pull(name, metric_filters=None, threshold=None):
    """Return an explicit availability result for optional director metrics."""
    try:
        return {"available": True, "value": pull(name, metric_filters, threshold)}
    except subprocess.CalledProcessError as exc:
        return {"available": False, "error": exc.stderr.decode("utf-8", errors="replace").strip()}


data = {
    "request": {"instance_id": INSTANCE_ID, "start_utc": START, "end_utc": END, "timezone": "America/New_York", "channel": "VOICE", "queue_ids": queue_ids},
    "contacts_handled_incoming": {
        "parent": pull("CONTACTS_HANDLED", {"INITIATION_METHOD": ["INBOUND", "TRANSFER", "QUEUE_TRANSFER"]}),
        "inbound": pull("CONTACTS_HANDLED", {"INITIATION_METHOD": ["INBOUND"]}),
        "transfer": pull("CONTACTS_HANDLED", {"INITIATION_METHOD": ["TRANSFER"]}),
        "queue_transfer": pull("CONTACTS_HANDLED", {"INITIATION_METHOD": ["QUEUE_TRANSFER"]}),
    },
    "queue": {
        "contacts_queued": pull("CONTACTS_QUEUED"),
        "contacts_abandoned": pull("CONTACTS_ABANDONED"),
        "contacts_abandoned_by_initiation_method": {
            method.lower(): pull("CONTACTS_ABANDONED", {"INITIATION_METHOD": [method]})
            for method in ("INBOUND", "TRANSFER", "API", "CALLBACK", "QUEUE_TRANSFER")
        },
        "contacts_transferred_out_from_queue": pull("CONTACTS_TRANSFERRED_OUT_FROM_QUEUE"),
        "abandoned_under_seconds": {
            str(seconds): pull("SUM_CONTACTS_ABANDONED_IN_X", threshold=[{"Comparison": "LT", "ThresholdValue": seconds}])
            for seconds in (5, 10, 15, 20, 30, 60, 120)
        },
    },
    "inbound_disconnect_reason": {
        reason: pull("CONTACTS_HANDLED", {"INITIATION_METHOD": ["INBOUND"], "DISCONNECT_REASON": [reason]})
        for reason in ("CUSTOMER_DISCONNECT", "AGENT_DISCONNECT", "THIRD_PARTY_DISCONNECT", "OTHER")
    },
    "inbound_hold": {
        "contacts_put_on_hold": pull("CONTACTS_PUT_ON_HOLD", {"INITIATION_METHOD": ["INBOUND"]}),
        "contacts_hold_abandons": pull("CONTACTS_HOLD_ABANDONS", {"INITIATION_METHOD": ["INBOUND"]}),
        "hold_abandons_by_disconnect_reason": {
            reason: pull("CONTACTS_HOLD_ABANDONS", {"INITIATION_METHOD": ["INBOUND"], "DISCONNECT_REASON": [reason]})
            for reason in ("CUSTOMER_DISCONNECT", "AGENT_DISCONNECT", "OTHER")
        },
    },
    "routing_diagnostics": {
        "agent_non_response": pull("AGENT_NON_RESPONSE"),
        "agent_non_response_without_customer_abandons": pull("AGENT_NON_RESPONSE_WITHOUT_CUSTOMER_ABANDONS"),
        "agent_answer_rate": pull("AGENT_ANSWER_RATE"),
    },
    "director_kpis": {
        "abandonment_rate": pull("ABANDONMENT_RATE"),
        "avg_queue_answer_time_seconds": pull("AVG_QUEUE_ANSWER_TIME"),
        "avg_queue_abandon_time_seconds": pull("AVG_ABANDON_TIME"),
        "service_level_30_seconds": pull("SERVICE_LEVEL", threshold=[{"Comparison": "LT", "ThresholdValue": 30}]),
        "contacts_answered_under_30_seconds": optional_pull("SUM_CONTACTS_ANSWERED_IN_X", threshold=[{"Comparison": "LT", "ThresholdValue": 30}]),
        "contacts_answered_under_seconds": {
            str(seconds): optional_pull("SUM_CONTACTS_ANSWERED_IN_X", threshold=[{"Comparison": "LT", "ThresholdValue": seconds}])
            for seconds in (5, 15, 30, 60, 120)
        },
        "max_queued_time_seconds": optional_pull("MAX_QUEUED_TIME"),
        "avg_handle_time_seconds": pull("AVG_HANDLE_TIME"),
        "avg_interaction_time_seconds": pull("AVG_INTERACTION_TIME"),
        "avg_hold_time_seconds": pull("AVG_HOLD_TIME"),
        "avg_holds": optional_pull("AVG_HOLDS"),
        "avg_after_contact_work_time_seconds": pull("AVG_AFTER_CONTACT_WORK_TIME"),
        "avg_resolution_time_seconds": pull("AVG_RESOLUTION_TIME"),
        "avg_talk_time_seconds": optional_pull("AVG_TALK_TIME"),
        "avg_non_talk_time_seconds": optional_pull("AVG_NON_TALK_TIME"),
        "talk_time_percent": optional_pull("PERCENT_TALK_TIME"),
        "non_talk_time_percent": optional_pull("PERCENT_NON_TALK_TIME"),
        "avg_customer_talk_time_seconds": optional_pull("AVG_TALK_TIME_CUSTOMER"),
        "avg_customer_hold_time_all_contacts_seconds": optional_pull("AVG_HOLD_TIME_ALL_CONTACTS"),
        # GetMetricDataV2 exposes this legacy report concept through
        # CONTACTS_HANDLED plus the native disconnect-reason filter.
        "contacts_agent_disconnected_first": optional_pull(
            "CONTACTS_HANDLED", {"DISCONNECT_REASON": ["AGENT_DISCONNECT"]}
        ),
        "contacts_transferred_out": optional_pull("CONTACTS_TRANSFERRED_OUT"),
        "contacts_transferred_out_internal": optional_pull("CONTACTS_TRANSFERRED_OUT_INTERNAL"),
        "contacts_transferred_out_external": optional_pull("CONTACTS_TRANSFERRED_OUT_EXTERNAL"),
        "contacts_transferred_out_by_agent": optional_pull("CONTACTS_TRANSFERRED_OUT_BY_AGENT"),
        "contacts_handled_connected_time": optional_pull("CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME", {"INITIATION_METHOD": ["INBOUND"]}),
        "contacts_queued_enqueue_time": optional_pull("CONTACTS_QUEUED_BY_ENQUEUE"),
        "contacts_incoming": optional_pull("CONTACTS_CREATED", {"INITIATION_METHOD": ["INBOUND", "TRANSFER", "QUEUE_TRANSFER"]}),
        "contacts_incoming_inbound": optional_pull("CONTACTS_CREATED", {"INITIATION_METHOD": ["INBOUND"]}),
        "contacts_incoming_transfer": optional_pull("CONTACTS_CREATED", {"INITIATION_METHOD": ["TRANSFER"]}),
        "contacts_incoming_queue_transfer": optional_pull("CONTACTS_CREATED", {"INITIATION_METHOD": ["QUEUE_TRANSFER"]}),
        "contacts_transferred_in": optional_pull("CONTACTS_CREATED", {"INITIATION_METHOD": ["TRANSFER", "QUEUE_TRANSFER"]}),
        # Callback handling is also a filtered V2 CONTACTS_HANDLED query;
        # CALLBACK_CONTACTS_HANDLED is a legacy report identifier.
        "callback_contacts_handled": optional_pull(
            "CONTACTS_HANDLED", {"INITIATION_METHOD": ["CALLBACK"]}
        ),
        "avg_contact_duration_seconds": optional_pull("AVG_CONTACT_DURATION"),
        "avg_interaction_and_hold_time_seconds": optional_pull("AVG_INTERACTION_AND_HOLD_TIME"),
        "agent_occupancy": optional_pull("AGENT_OCCUPANCY"),
        "contacts_handled_connected_to_agent_time": optional_pull("CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME"),
        "flows_started": optional_pull("FLOWS_STARTED"),
        "avg_flow_time_seconds": optional_pull("AVG_FLOW_TIME"),
        "max_flow_time_seconds": optional_pull("MAX_FLOW_TIME"),
    },
}

print(json.dumps(data, indent=2, sort_keys=True))
