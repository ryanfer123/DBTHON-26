#!/usr/bin/env python3
"""Create local configuration without printing or committing credentials."""
from pathlib import Path
import os
import secrets

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / ".env"
if target.exists():
    print("Preserved existing .env; no configuration changed.")
else:
    content = (ROOT / ".env.example").read_text().replace(
        "POSTGRES_PASSWORD=\n", "POSTGRES_PASSWORD=" + secrets.token_urlsafe(32) + "\n"
    )
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(content)
    print("Created ignored .env with a random local database password (not printed).")
