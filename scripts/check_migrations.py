"""Enforce that Alembic executes the authoritative SQL rather than duplicating it."""

import ast
from pathlib import Path

root = Path(__file__).resolve().parents[1]
used = set()
for revision in sorted((root / "backend/alembic/versions").glob("*.py")):
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
    if not paths or any(not (root / path).is_file() for path in paths):
        raise SystemExit(
            f"{revision.name}: upgrade must load authoritative SQL files"
        )
    if len(paths) != len(set(paths)):
        raise SystemExit(f"{revision.name}: duplicate SQL path in upgrade")
    if len(paths) > 1 and revision.stem != "0007_community_tools":
        raise SystemExit(f"{revision.name}: multiple SQL files need an explicit bridge")
    duplicates = used.intersection(paths)
    if duplicates:
        raise SystemExit(f"{revision.name}: SQL already has a loader: {sorted(duplicates)}")
    used.update(paths)
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
expected = {
    path.relative_to(root).as_posix()
    for path in (root / "database").glob("0*.sql")
}
if used != expected:
    raise SystemExit("Each numbered SQL migration must have exactly one Alembic loader")
print(f"PASS: {len(used)} authoritative SQL scripts, no duplicate upgrade SQL.")
