#!/usr/bin/env python3
"""Validate converted battery data and all cross-record invariants."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "battery"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> None:
    vehicles = load("vehicleMaster.json")
    users = load("mockUsers.json")
    sessions = load("mockChargingSessions.json")
    images = load("vehicleImages.json")
    errors: list[str] = []

    if len(vehicles) != 20:
        errors.append(f"vehicle count: {len(vehicles)} != 20")
    if len(users) != 1250:
        errors.append(f"user count: {len(users)} != 1250")
    if len(sessions) != 10000:
        errors.append(f"session count: {len(sessions)} != 10000")

    vehicle_ids = {vehicle["vehicleId"] for vehicle in vehicles}
    image_vehicle_ids = {image["vehicleId"] for image in images}
    if image_vehicle_ids != vehicle_ids:
        errors.append("vehicle image mappings do not match vehicle master")
    for image in images:
        image_file = ROOT / "public" / image["imagePath"].removeprefix("./")
        if not image_file.exists():
            errors.append(f"vehicle image missing: {image_file.name}")
    user_vehicles = {user["userId"]: user["vehicleId"] for user in users}
    if len(user_vehicles) != len(users):
        errors.append("duplicate userId")
    if any(vehicle_id not in vehicle_ids for vehicle_id in user_vehicles.values()):
        errors.append("user has unknown vehicle")

    by_user: dict[str, list[dict]] = defaultdict(list)
    invalid_order = unknown_user = unknown_vehicle = mismatch = 0
    for session in sessions:
        user_id, vehicle_id = session["userId"], session["vehicleId"]
        if user_id not in user_vehicles:
            unknown_user += 1
        if vehicle_id not in vehicle_ids:
            unknown_vehicle += 1
        if user_id in user_vehicles and user_vehicles[user_id] != vehicle_id:
            mismatch += 1
        started = datetime.fromisoformat(session["startedAt"])
        ended = datetime.fromisoformat(session["endedAt"])
        unplugged = datetime.fromisoformat(session["unpluggedAt"])
        if not started < ended <= unplugged:
            invalid_order += 1
        by_user[user_id].append(session)

    overlap = 0
    for records in by_user.values():
        records.sort(key=lambda row: row["startedAt"])
        for previous, current in zip(records, records[1:]):
            if datetime.fromisoformat(current["startedAt"]) < datetime.fromisoformat(previous["unpluggedAt"]):
                overlap += 1

    checks = {
        "unknown users": unknown_user,
        "unknown vehicles": unknown_vehicle,
        "user/vehicle mismatches": mismatch,
        "invalid time order": invalid_order,
        "overlapping user sessions": overlap,
    }
    errors.extend(f"{name}: {count}" for name, count in checks.items() if count)
    if errors:
        raise SystemExit("Validation failed:\n- " + "\n- ".join(errors))
    print(json.dumps({
        "vehicles": len(vehicles),
        "users": len(users),
        "sessions": len(sessions),
        "vehicleImageMappings": len(images),
        "oneVehiclePerUser": True,
        "unknownUsers": 0,
        "unknownVehicles": 0,
        "invalidTimeOrder": 0,
        "overlappingSessions": 0,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
