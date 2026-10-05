#!/usr/bin/env python3
"""Validate source integrity, handoff completeness and synthetic fixture semantics.

Standard library only. This does not execute or validate an application/database.
"""
from collections import Counter
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def unique(records: list[dict], key: str, label: str) -> dict:
    keys = [record[key] for record in records]
    require(len(keys) == len(set(keys)), f"Duplicate {label} IDs")
    return {record[key]: record for record in records}


def check_sources() -> None:
    manifest = read_json("docs/source/manifest.json")
    require(manifest["pdf_pages"] == 16, "Source page count changed")
    require(len(manifest["files"]) == 5, "Expected PDF, extraction and three diagram pages")
    for source in manifest["files"]:
        path = ROOT / source["path"]
        require(path.is_file(), f"Missing source: {source['path']}")
        if path.is_file():
            content = path.read_bytes()
            require(len(content) == source["bytes"], f"Source size mismatch: {source['path']}")
            require(hashlib.sha256(content).hexdigest() == source["sha256"],
                    f"Source hash mismatch: {source['path']}")
    text = (ROOT / "docs/source/brief-extracted.md").read_text()
    pages = re.findall(r"^## PDF page (\d+)$", text, re.M)
    require(pages == [str(n) for n in range(1, 17)], "Extraction must retain all physical pages in order")


def check_links_and_coverage() -> None:
    required = ["AGENTS.md", "README.md", "docs/STATUS.md", "docs/START_HERE.md",
                "docs/PROJECT_BRIEF.md", "docs/IMPLEMENTATION_PLAN.md", "docs/REQUIREMENTS.md",
                "docs/DATABASE.md", "docs/DOMAIN_RULES.md", "docs/API.md", "docs/UX.md",
                "docs/ARCHITECTURE.md", "docs/TESTING.md", "docs/DEVELOPMENT.md", "docs/DEMO.md",
                "docs/decisions/0001-prototype-design.md", "data/README.md", "compose.yaml"]
    for path in required:
        require((ROOT / path).is_file(), f"Missing handoff file: {path}")
    ignored = {".git", ".venv", "node_modules", "dist", "build", "artifacts", "tmp",
               "playwright-report", "test-results", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
    markdown = []
    for directory, children, files in os.walk(ROOT):
        children[:] = [name for name in children if name not in ignored]
        markdown.extend(Path(directory) / name for name in files if name.endswith(".md"))
    for path in markdown:
        if path.name == "brief-extracted.md":
            continue
        text = path.read_text(encoding="utf-8")
        # These handoff links use simple relative paths; external URLs are skipped.
        for link in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
            target = link.split("#", 1)[0]
            if not target or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                continue
            require((path.parent / unquote(target)).resolve().exists(),
                    f"Broken link in {path.relative_to(ROOT)}: {link}")
    requirements = read_json("docs/requirements.json")
    require([r["id"] for r in requirements["functional"]] == [f"FR{i:02}" for i in range(1, 11)],
            "Expected FR01-FR10 exactly once")
    require([r["id"] for r in requirements["nonfunctional"]] == [f"NFR{i:02}" for i in range(1, 7)],
            "Expected NFR01-NFR06 exactly once")
    plan = (ROOT / "docs/IMPLEMENTATION_PLAN.md").read_text()
    tests = (ROOT / "docs/TESTING.md").read_text()
    spec = (ROOT / "docs/REQUIREMENTS.md").read_text()
    for number in range(1, 13):
        require(bool(re.search(rf"\*\*P{number:02} -", plan)), f"Missing P{number:02} plan task")
        require(f"| T{number:02} |" in tests, f"Missing T{number:02} test family")
    allowed_status = {"not_implemented", "in_progress", "partial", "implemented"}
    for requirement in requirements["functional"] + requirements["nonfunctional"]:
        require(requirement["id"] in spec, f"Missing requirement prose: {requirement['id']}")
        require(requirement["status"] in allowed_status, f"Unknown status: {requirement['id']}")
        require((ROOT / requirement["spec"]).is_file(), f"Missing spec: {requirement['id']}")
    for requirement in requirements["functional"]:
        require(bool(requirement["tasks"] and requirement["tests"]), f"Unmapped {requirement['id']}")
        for task in requirement["tasks"]:
            require(bool(re.search(rf"\*\*{task} -", plan)), f"Unknown task {task}")
        for test in requirement["tests"]:
            require(f"| {test} |" in tests, f"Unknown test {test}")
    for name in ["01-problem-discovery", "02-innovation-proposal", "03-software-requirements",
                 "04-database-design", "05-application-prototype", "06-testing-validation",
                 "07-impact-trl", "08-expo-presentation"]:
        require((ROOT / f"docs/deliverables/{name}.md").is_file(), f"Missing course deliverable: {name}")


def check_fixtures() -> None:
    fixture = read_json("data/fixtures/demo.json")
    require(fixture["synthetic"] is True, "Fixture must be labelled synthetic")
    zones = unique(fixture["zones"], "zone_id", "zone")
    users = unique(fixture["users"], "user_id", "user")
    listings = unique(fixture["food_listings"], "listing_id", "listing")
    claims = unique(fixture["claims"], "claim_id", "claim")
    unique(fixture["ratings"], "rating_id", "rating")
    require(len(zones) == 4, "Demo needs four zones")
    for user in users.values():
        require(user["zone_id"] in zones, f"Invalid user zone: {user['user_id']}")
        require(user["email"].endswith(".invalid"), "Demo emails must not be real")
        require(-90 <= user["latitude"] <= 90 and -180 <= user["longitude"] <= 180,
                f"Invalid user coordinates: {user['user_id']}")
        require(set(user["roles"]) <= {"Donor", "Receiver", "Volunteer", "Admin"}, "Invalid role")
        if "Receiver" in user["roles"]:
            require(Decimal(user["capacity_kg"]) > 0, "Receiver requires positive capacity")
        require(not ({"password", "password_hash", "token"} & user.keys()), "Credentials in fixtures")
    for field in ["email", "phone"]:
        require(len({u[field] for u in users.values()}) == len(users), f"Duplicate demo {field}")
    for listing in listings.values():
        donor = users[listing["donor_id"]]
        require("Donor" in donor["roles"] and donor["zone_id"] == listing["zone_id"], "Invalid listing donor")
        require(Decimal(listing["quantity_kg"]) > 0, "Nonpositive demo quantity")
        require(listing["category"] in {"Veg", "NonVeg"}, "Invalid food category")
        require(listing["prepared_at_offset_min"] <= listing["expiry_window_start_offset_min"]
                < listing["expiry_window_end_offset_min"], "Invalid fixture safety window")
        require(listing["prepared_at_offset_min"] <= 0 and listing["created_at_offset_min"] <= 0,
                "Demo preparation/creation in future")
        require(-90 <= listing["pickup_lat"] <= 90 and -180 <= listing["pickup_long"] <= 180,
                "Invalid pickup coordinates")
        require(listing["status"] in {"Available", "Claimed", "PickedUp", "Delivered", "Expired", "Cancelled"},
                "Invalid listing state")
        if listing["status"] in {"Available", "Claimed", "PickedUp"}:
            require(listing["expiry_window_end_offset_min"] > 0, "Active fixture already expired")
    allocations = Counter()
    for claim in claims.values():
        listing = listings[claim["listing_id"]]
        receiver = users[claim["receiver_id"]]
        require("Receiver" in receiver["roles"] and receiver["verified_status"], "Invalid claim receiver")
        require(receiver["zone_id"] == listing["zone_id"] and receiver["user_id"] != listing["donor_id"],
                "Cross-zone/self claim")
        require(Decimal(receiver["capacity_kg"]) >= Decimal(listing["quantity_kg"]), "Claim exceeds capacity")
        require(listing["created_at_offset_min"] <= claim["claimed_at_offset_min"] < listing["expiry_window_end_offset_min"],
                "Invalid claim timestamp")
        if claim["status"] in {"Confirmed", "Completed"}:
            allocations[listing["listing_id"]] += 1
        require(claim["status"] in {"Confirmed", "Completed", "Cancelled", "Expired"}, "Invalid claim state")
        require((claim["status"] == "Completed") == (listing["status"] == "Delivered"), "Completion mismatch")
    require(all(count == 1 for count in allocations.values()), "Multiple fixture allocations")
    for listing in listings.values():
        if listing["status"] in {"Claimed", "PickedUp", "Delivered"}:
            require(allocations[listing["listing_id"]] == 1, "Allocated listing lacks claim")
    pickup_keys = set()
    active_pickups = Counter()
    picked_up_listings = set()
    delivered_listings = set()
    for pickup in fixture["pickups"]:
        key = (pickup["claim_id"], pickup["pickup_id"])
        require(key not in pickup_keys, "Duplicate composite pickup key")
        pickup_keys.add(key)
        claim = claims[pickup["claim_id"]]
        listing = listings[claim["listing_id"]]
        volunteer = users[pickup["volunteer_id"]]
        require("Volunteer" in volunteer["roles"] and volunteer["verified_status"], "Invalid volunteer")
        require(volunteer["zone_id"] == listing["zone_id"], "Cross-zone volunteer")
        require(volunteer["user_id"] not in {listing["donor_id"], claim["receiver_id"]}, "Participant volunteer")
        require(pickup["status"] in {"Scheduled", "PickedUp", "Delivered", "Missed", "Cancelled", "Failed"},
                "Invalid pickup status")
        if pickup["status"] in {"Scheduled", "PickedUp", "Delivered"}:
            active_pickups[claim["claim_id"]] += 1
        actual = pickup["actual_pickup_time_offset_min"]
        delivered = pickup["delivery_time_offset_min"]
        if actual is not None:
            require(claim["claimed_at_offset_min"] <= actual < listing["expiry_window_end_offset_min"],
                    "Invalid actual pickup timestamp")
            picked_up_listings.add(listing["listing_id"])
        if delivered is not None:
            require(actual is not None and actual <= delivered < listing["expiry_window_end_offset_min"],
                    "Invalid delivery timestamp")
            require(pickup["status"] == "Delivered", "Delivery time on undelivered attempt")
            delivered_listings.add(listing["listing_id"])
        require((pickup["status"] == "Delivered") == (delivered is not None), "Delivered attempt missing timestamp")
    require(all(count == 1 for count in active_pickups.values()), "Multiple live/delivered pickup attempts")
    directions = set()
    for rating in fixture["ratings"]:
        claim = claims[rating["claim_id"]]
        participants = {claim["receiver_id"], listings[claim["listing_id"]]["donor_id"]}
        require(claim["status"] == "Completed", "Rating before completed claim")
        require({rating["rater_id"], rating["target_user_id"]} == participants, "Ineligible rating")
        direction = (rating["claim_id"], rating["rater_id"], rating["target_user_id"])
        require(direction not in directions, "Duplicate rating direction")
        directions.add(direction)
        require(1 <= rating["score"] <= 5, "Invalid rating score")
    expected = fixture["expected_at_anchor"]
    def mass(ids):
        return sum((Decimal(listings[i]["quantity_kg"]) for i in ids if listings[i]["zone_id"] == 1), Decimal(0))
    require(mass(picked_up_listings) == Decimal(expected["zone_1_picked_up_kg"]), "Picked-up total mismatch")
    require(mass(delivered_listings) == Decimal(expected["zone_1_delivered_kg"]), "Delivered total mismatch")
    require(mass(delivered_listings) / Decimal("0.4") == Decimal(expected["zone_1_estimated_meals"]), "Meal estimate mismatch")
    require(expected["co2e_kg_per_kg"] is None, "Unsupported emissions factor in fixture")
    def visible_ids(user_id):
        user = users[user_id]
        # All same-zone fixture points are within the documented 5 km demo radius.
        candidates = [l for l in listings.values() if l["zone_id"] == user["zone_id"]
                      and l["status"] == "Available" and l["expiry_window_start_offset_min"] <= 0
                      < l["expiry_window_end_offset_min"] and Decimal(l["quantity_kg"]) <= Decimal(user["capacity_kg"])]
        return [l["listing_id"] for l in sorted(candidates, key=lambda l: (l["expiry_window_end_offset_min"], l["listing_id"]))]
    require(visible_ids(expected["primary_receiver_id"]) == expected["primary_receiver_visible_listing_ids_by_urgency"],
            "Primary receiver expectation mismatch")
    require(visible_ids(expected["insufficient_capacity_receiver_id"]) == expected["insufficient_capacity_receiver_visible_listing_ids"],
            "Small-capacity receiver expectation mismatch")


def main() -> int:
    for label, check in [("source integrity", check_sources), ("links and coverage", check_links_and_coverage),
                         ("fixture semantics", check_fixtures)]:
        try:
            check()
        except (OSError, KeyError, TypeError, ValueError) as exc:
            errors.append(f"{label}: {exc}")
    if errors:
        print("Handoff validation FAILED:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PASS: 16 source pages and hashes; relative links; 10 FRs/6 NFRs; 12 tasks/tests; 8 deliverables; synthetic fixture constraints and totals.")
    print("Application, database runtime, external notifications and pilot evidence are not validated by this check.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
