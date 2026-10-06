"""Run the same-origin web/API package using the platform's HTTP port."""

import os

port = int(os.environ.get("PORT", "8000"))
if not 1 <= port <= 65535:
    raise SystemExit("PORT must be between 1 and 65535")
os.execvp(
    "uvicorn",
    [
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(port),
        "--no-access-log",
    ],
)
