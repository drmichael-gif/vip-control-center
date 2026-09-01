#!/usr/bin/env python3
"""Pull the live Amazon Connect history used by the Call Center Metrics dashboard.

The dashboard's 12-month trend is built from one TOTAL request per ET month
because GetMetricDataV2 does not expose a monthly interval.  The weekday/hour
heat map is built from HOUR requests in two-day chunks because Amazon limits
sub-day interval requests to ranges shorter than three days.

The script writes a credential-free JSON artifact.  Credentials are resolved
only through the named AWS CLI profile.
"""

from __future__ import annotations

import argparse
import calendar
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


DEFAULT_INSTANCE_ID = "6b3f17ba-68a4-472a-9b20-db1991507009"
DEFAULT_ACCOUNT_ID = "165505826690"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="vip-connect")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--instance-id", default=DEFAULT_INSTANCE_ID)
    parser.add_argument("--account-id", default=DEFAULT_ACCOUNT_ID)
    parser.add_argument("--timezone", default="America/New_York")
    parser.add_argument("--start-month", default="2026-06")
    parser.add_argument("--end-date", default="2026-08-27", help="Exclusive ET date")
    parser.add_argument(
        "--output",
        default="data/call-center-metrics-history-2026-06_2026-08.json",
    )
    return parser.parse_args()


def aws(env: dict[str, str], region: str, *args: str) -> dict:
    process = subprocess.run(
        ["aws", *args, "--region", region, "--output", "json", "--no-cli-pager"],
        env=env,
        text=True,
        capture_output=True,
    )
    if process.returncode:
        raise RuntimeError(process.stderr.strip())
    return json.loads(process.stdout or "{}")


def month_start(value: str, tz: ZoneInfo) -> datetime:
    year, month = (int(part) for part in value.split("-"))
    return datetime(year, month, 1, tzinfo=tz)


def next_month(value: datetime) -> datetime:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    return value.replace(year=year, month=month, day=1)


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def collection_value(response: dict) -> float:
    return sum(
        float(collection.get("Value") or 0)
        for result in response.get("MetricResults", [])
        for collection in result.get("Collections", [])
    )


def collection_points(response: dict) -> list[tuple[datetime, float]]:
    points: list[tuple[datetime, float]] = []
    for result in response.get("MetricResults", []):
        start = result.get("MetricInterval", {}).get("StartTime")
        if not start:
            continue
        value = sum(float(collection.get("Value") or 0) for collection in result.get("Collections", []))
        points.append((datetime.fromisoformat(start.replace("Z", "+00:00")), value))
    return points


def main() -> None:
    args = parse_args()
    tz = ZoneInfo(args.timezone)
    end_date = datetime.fromisoformat(args.end_date).replace(tzinfo=tz)

    env = os.environ.copy()
    for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE"):
        env.pop(key, None)
    env["AWS_PROFILE"] = args.profile

    queue_response = aws(
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
    queue_ids = sorted(queue["Id"] for queue in queue_response.get("QueueSummaryList", []))
    filters = [
        {"FilterKey": "QUEUE", "FilterValues": queue_ids},
        {"FilterKey": "CHANNEL", "FilterValues": ["VOICE"]},
    ]
    resource_arn = f"arn:aws:connect:{args.region}:{args.account_id}:instance/{args.instance_id}"

    def query(start: datetime, end: datetime, interval: str) -> dict:
        return aws(
            env,
            args.region,
            "connect",
            "get-metric-data-v2",
            "--resource-arn",
            resource_arn,
            "--start-time",
            iso_utc(start),
            "--end-time",
            iso_utc(end),
            "--interval",
            json.dumps({"TimeZone": args.timezone, "IntervalPeriod": interval}),
            "--filters",
            json.dumps(filters),
            "--metrics",
            json.dumps([{"Name": "CONTACTS_ABANDONED"}]),
        )

    trend: list[dict] = []
    cursor = month_start(args.start_month, tz)
    while cursor < end_date:
        window_end = min(next_month(cursor), end_date)
        response = query(cursor, window_end, "TOTAL")
        trend.append(
            {
                "month": cursor.strftime("%Y-%m"),
                "label": calendar.month_abbr[cursor.month],
                "start_et": cursor.isoformat(),
                "end_exclusive_et": window_end.isoformat(),
                "value": collection_value(response),
                "complete_month": window_end == next_month(cursor),
            }
        )
        cursor = next_month(cursor)

    heat_start = month_start(end_date.strftime("%Y-%m"), tz)
    hourly_points: list[tuple[datetime, float]] = []
    cursor = heat_start
    while cursor < end_date:
        chunk_end = min(cursor + timedelta(days=2), end_date)
        hourly_points.extend(collection_points(query(cursor, chunk_end, "HOUR")))
        cursor = chunk_end

    def grid_for(start: datetime) -> dict:
        grid = [[0.0 for _ in range(24)] for _ in range(7)]
        for timestamp, value in hourly_points:
            local = timestamp.astimezone(tz)
            if local < start:
                continue
            grid[local.weekday()][local.hour] += value
        return {"start_et": start.isoformat(), "values": grid, "total": sum(sum(row) for row in grid)}

    windows = {
        "1w": grid_for(end_date - timedelta(days=7)),
        "2w": grid_for(end_date - timedelta(days=14)),
        "1m": grid_for(heat_start),
    }
    heat_total = windows["1m"]["total"]
    expected_heat_total = trend[-1]["value"]
    if abs(heat_total - expected_heat_total) > 0.001:
        raise RuntimeError(
            f"Hourly heat-map total {heat_total} does not reconcile to current-month TOTAL {expected_heat_total}"
        )

    artifact = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Amazon Connect GetMetricDataV2",
        "status": "api_verified",
        "request_contract": {
            "profile": args.profile,
            "region": args.region,
            "instance_id": args.instance_id,
            "timezone": args.timezone,
            "channel": "VOICE",
            "queue_scope": "all STANDARD queues enumerated at extraction time",
            "queue_ids": queue_ids,
            "metric": "CONTACTS_ABANDONED",
            "api_history_limit": "GetMetricDataV2 requests cannot retrieve this metric beyond the recent three-month window; older months require the Connect data lake or Snowflake archive",
            "trend_interval": "TOTAL; one request per ET month because GetMetricDataV2 has no monthly interval",
            "heatmap_interval": "HOUR; two-day request chunks because sub-day intervals require ranges under three days",
            "end_time_semantics": "exclusive",
        },
        "trend": trend,
        "heatmap": {
            "start_et": heat_start.isoformat(),
            "end_exclusive_et": end_date.isoformat(),
            "weekday_order": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "hour_order": list(range(24)),
            "windows": windows,
            "total": heat_total,
            "reconciles_to_current_month_total": True,
        },
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "trend": trend, "heatmap_total": heat_total}, indent=2))


if __name__ == "__main__":
    main()
