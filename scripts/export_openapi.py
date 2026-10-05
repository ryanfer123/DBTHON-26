#!/usr/bin/env python3
"""Export the implemented API contract, or check the committed export is current."""
from importlib import import_module
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))
settings = import_module("app.core.config").Settings(
    _env_file=None, postgres_password=None, database_url=None
)
application = import_module("app.main").create_app(settings)
content = json.dumps(application.openapi(), indent=2, sort_keys=True) + "\n"
target = ROOT / "docs/openapi.json"
if "--check" in sys.argv:
    if not target.is_file() or target.read_text() != content:
        sys.exit("OpenAPI export is stale. Run make openapi and commit the result.")
    print("PASS: committed OpenAPI export matches implemented endpoints.")
else:
    target.write_text(content)
    print("Exported docs/openapi.json")
