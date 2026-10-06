"""Enforce that Alembic executes the authoritative SQL rather than duplicating it."""

import ast
from pathlib import Path

root = Path(__file__).resolve().parents[1]
used = set()
for revision in sorted((root / "apps/api/alembic/versions").glob("*.py")):
    tree = ast.parse(revision.read_text())
    upgrade = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "upgrade"
    )
    paths = [
        node.value
        for node in ast.walk(upgrade)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and node.value.startswith("database/")
        and node.value.endswith(".sql")
    ]
    if len(paths) != 1 or not (root / paths[0]).is_file():
        raise SystemExit(
            f"{revision.name}: upgrade must load one authoritative SQL file"
        )
    if paths[0] in used:
        raise SystemExit(f"{revision.name}: SQL file already has an Alembic loader")
    used.add(paths[0])
    calls = [node for node in ast.walk(upgrade) if isinstance(node, ast.Call)]
    if not any(
        isinstance(node.func, ast.Attribute) and node.func.attr == "read_text"
        for node in calls
    ):
        raise SystemExit(f"{revision.name}: SQL must be loaded from disk")
    if any(
        isinstance(node.func, ast.Attribute)
        and node.func.attr == "execute"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
        for node in calls
    ):
        raise SystemExit(
            f"{revision.name}: inline upgrade SQL would duplicate the authoritative file"
        )
expected = {str(path.relative_to(root)) for path in (root / "database").glob("0*.sql")}
if used != expected:
    raise SystemExit("Each numbered SQL migration must have exactly one Alembic loader")
print(f"PASS: {len(used)} authoritative SQL migrations, no duplicate upgrade SQL.")
