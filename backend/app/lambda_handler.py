"""AWS HTTPS adapter; reuse bounded pools across warm Lambda invocations."""

from typing import Any

from mangum import Mangum

from app.main import app

adapter = Mangum(app, lifespan="off")


def handle(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return adapter(event, context)
