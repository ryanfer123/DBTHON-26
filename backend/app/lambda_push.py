"""Internet-facing delivery adapter; no database login, HTTP URL or payload logging."""

import json
import os
from typing import Any

import boto3
from botocore.config import Config

from app.core.config import Settings
from app.workflows.browser_push import send_push

client = boto3.client(
    "lambda",
    config=Config(
        connect_timeout=3,
        read_timeout=10,
        retries={"total_max_attempts": 1, "mode": "standard"},
    ),
)


def invoke_worker(payload: dict[str, Any]) -> dict[str, Any]:
    response = client.invoke(
        FunctionName=os.environ["PUSH_WORKER_ARN"],
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode(),
    )
    if response.get("FunctionError"):
        # Worker errors must not echo database fields/capabilities into relay logs.
        raise RuntimeError("Push worker operation failed")
    with response["Payload"] as stream:
        result: dict[str, Any] = json.loads(stream.read())
    return result


def handle(event: dict[str, Any], context: Any) -> dict[str, int]:
    settings = Settings()
    counts = {"push_accepted": 0, "push_failed": 0}
    if not settings.push_delivery_enabled or not settings.push_private_key:
        return counts
    jobs = invoke_worker({"operation": "lease_push"}).get("jobs", [])
    for job in jobs:
        if context.get_remaining_time_in_millis() < 15000:
            # Unfinished leases time out as unknown, without duplicate sends.
            break
        outcome = send_push(job, settings)
        invoke_worker(
            {
                "operation": "finish_push",
                "job": {
                    "delivery_id": job["delivery_id"],
                    "lease_token": job["lease_token"],
                },
                "outcome": outcome,
            }
        )
        counts["push_accepted" if outcome == "Accepted" else "push_failed"] += 1
    return counts
