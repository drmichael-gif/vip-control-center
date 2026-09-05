#!/usr/bin/env python3
"""Pull verified direct-outbound and campaign reference data for August 2026.

The two populations remain separate: direct OUTBOUND rows are contact legs while
campaign rows are campaign-scoped interval metrics.
"""
import json
import os
import subprocess

INSTANCE_ID = "00000000-0000-0000-0000-000000000000"
ACCOUNT_ID = "000000000000"
START = "2026-08-12T04:00:00Z"
END = "2026-08-16T04:00:00Z"
REGION = "us-east-1"
RESOURCE_ARN = f"arn:aws:connect:{REGION}:{ACCOUNT_ID}:instance/{INSTANCE_ID}"

env = os.environ.copy()
for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE"):
    env.pop(key, None)
env["AWS_PROFILE"] = "vip-connect"


def aws(*args):
    process = subprocess.run(
        ["aws", *args, "--region", REGION, "--output", "json"],
        env=env,
        text=True,
        capture_output=True,
    )
    if process.returncode:
        raise RuntimeError(process.stderr.strip())
    return json.loads(process.stdout)


queues = aws(
    "connect", "list-queues", "--instance-id", INSTANCE_ID,
    "--queue-types", "STANDARD", "--max-results", "100",
)
queue_ids = [queue["Id"] for queue in queues["QueueSummaryList"]]
top_filters = [
    {"FilterKey": "QUEUE", "FilterValues": queue_ids},
    {"FilterKey": "CHANNEL", "FilterValues": ["VOICE"]},
]


def pull(name, metric_filters=None):
    metric = {"Name": name}
    if metric_filters:
        metric["MetricFilters"] = [
            {"MetricFilterKey": key, "MetricFilterValues": values}
            for key, values in metric_filters.items()
        ]
    response = aws(
        "connect", "get-metric-data-v2",
        "--resource-arn", RESOURCE_ARN,
        "--start-time", START,
        "--end-time", END,
        "--interval", json.dumps({"TimeZone": "America/New_York", "IntervalPeriod": "TOTAL"}),
        "--filters", json.dumps(top_filters),
        "--metrics", json.dumps([metric]),
    )
    results = response.get("MetricResults", [])
    collections = results[0].get("Collections", []) if results else []
    return collections[0].get("Value", 0) if collections else 0


outbound = {"INITIATION_METHOD": ["OUTBOUND"]}
created = pull("CONTACTS_CREATED", outbound)
handled = pull("CONTACTS_HANDLED", outbound)

campaigns = aws(
    "connectcampaignsv2", "list-campaigns",
    "--filters", json.dumps({"instanceIdFilter": {"value": INSTANCE_ID, "operator": "Eq"}}),
)
verified_campaign = next(
    campaign for campaign in campaigns.get("campaignSummaryList", [])
    if campaign.get("name") == "NY-NL-1-1032-v2-08-27"
)
campaign_arn = verified_campaign["arn"]
campaign_response = aws(
    "connect", "get-metric-data-v2",
    "--resource-arn", RESOURCE_ARN,
    "--start-time", "2026-08-27T04:00:00Z",
    "--end-time", "2026-08-29T04:00:00Z",
    "--interval", json.dumps({"TimeZone": "America/New_York", "IntervalPeriod": "TOTAL"}),
    "--filters", json.dumps([{"FilterKey": "CAMPAIGN", "FilterValues": [campaign_arn]}]),
    "--metrics", json.dumps([{"Name": name} for name in (
        "CAMPAIGN_SEND_ATTEMPTS", "CAMPAIGN_CONTACTS_CONNECTED",
        "RECIPIENTS_TARGETED", "CAMPAIGN_PROGRESS_RATE",
    )]),
)
campaign_metrics = {
    item["Metric"]["Name"]: item.get("Value", 0)
    for result in campaign_response.get("MetricResults", [])
    for item in result.get("Collections", [])
}
campaign_metrics["campaign_connection_rate"] = round(
    campaign_metrics["CAMPAIGN_CONTACTS_CONNECTED"]
    / campaign_metrics["CAMPAIGN_SEND_ATTEMPTS"] * 100, 1
)

data = {
    "request": {
        "instance_id": INSTANCE_ID,
        "start_utc": START,
        "end_utc": END,
        "timezone": "America/New_York",
        "channel": "VOICE",
        "initiation_method": "OUTBOUND",
        "queue_ids": queue_ids,
    },
    "outbound_population": {
        "Outbound_Call_Legs_Created": created,
        "Outbound_Calls_Answered": handled,
        "Outbound_Calls_Not_Answered": created - handled,
    },
    "disconnect_reason": {
        reason: pull(
            "CONTACTS_HANDLED",
            {"INITIATION_METHOD": ["OUTBOUND"], "DISCONNECT_REASON": [reason]},
        )
        for reason in (
            "CUSTOMER_DISCONNECT", "AGENT_DISCONNECT",
            "THIRD_PARTY_DISCONNECT", "OTHER",
        )
    },
    "hold_and_transfer": {
        "Outbound_Calls_Put_On_Hold": pull("CONTACTS_PUT_ON_HOLD", outbound),
        "Outbound_Hold_Abandons": pull("CONTACTS_HOLD_ABANDONS", outbound),
        "Outbound_Calls_Transferred_Out": pull("CONTACTS_TRANSFERRED_OUT", outbound),
    },
    "agent_time": {
        "Average_Outbound_Interaction_Seconds": pull("AVG_INTERACTION_TIME", outbound),
        "Average_Outbound_After_Contact_Work_Seconds": pull("AVG_AFTER_CONTACT_WORK_TIME", outbound),
        "Total_Outbound_Agent_Connecting_Seconds": pull("SUM_CONNECTING_TIME_AGENT", outbound),
        "Outbound_Calls_With_Connected_Time": pull("CONTACTS_HANDLED_CONNECTED_TO_AGENT_TIME", outbound),
    },
    "campaign_api": {
        "status": "api_verified",
        "campaign_id": verified_campaign["id"],
        "campaign_name": verified_campaign["name"],
        "window": "2026-08-27/2026-08-29 America/New_York",
        **campaign_metrics,
    },
}

print(json.dumps(data, indent=2, sort_keys=True))
