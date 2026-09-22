#!/usr/bin/env python3
"""Deterministic, physically constrained TEST scenarios, not a population model.

Uses only checked-in vehicle specifications. Preserves the original workbook and
runtime JSON. Battery-side energy excludes charging losses; distance is synthetic
and MUST NOT be presented as measured efficiency, mileage or battery health.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data/battery"
OUTPUT = ROOT / "tests/fixtures/charging-scenarios.json"
REPORT = ROOT / "tests/fixtures/charging-scenarios-report.json"
KST = timezone(timedelta(hours=9))
START = datetime(2026, 7, 20, tzinfo=KST)
DAYS = 56
SEED = 20260922
VERSION = "CHARGING_SCENARIOS_V1"
PATTERNS = {
    "NIGHT_AC": "2~3일 간격 심야 완속",
    "DAILY_AC": "매일 완속",
    "WORK_AC": "평일 직장 완속",
    "MIXED_DAY": "같은 날 급속+완속",
    "WEEKEND_TRIP": "주말 장거리·평일 완속",
    "PUBLIC_DC": "공용 급속 중심",
    "SHORT_TOPUP": "짧은 소량 보충",
    "ULTRA_FLEET": "고사용량 경계: 평일 초급속 3~5회",
    "LOW_USE": "충전 없는 날이 많은 저빈도 이용",
}


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def timestamp(value):
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=KST)


def iso(value):
    return value.isoformat(timespec="seconds")


def schedule(pattern, variant, rng):
    """Calendar schedules include non-charging days; times are local Korea time."""
    events = []
    for day in range(DAYS):
        weekday = day % 7
        slots = []
        if pattern == "NIGHT_AC" and day % (2 + variant) == 0:
            slots = [(23, "AC_SLOW")]
        elif pattern == "DAILY_AC":
            slots = [(21, "AC_SLOW")]
        elif pattern == "WORK_AC" and weekday < 5 and rng.random() > .12:
            slots = [(9, "AC_SLOW")]
        elif pattern == "MIXED_DAY" and weekday < 5:
            slots = [(12, "DC_FAST"), (21, "AC_SLOW")] if weekday % 2 == variant else [(21, "AC_SLOW")]
        elif pattern == "WEEKEND_TRIP":
            if weekday == 4:
                slots = [(21, "AC_SLOW")]
            elif weekday in (5, 6):
                slots = [(10, "DC_FAST"), (16, "ULTRA_FAST" if variant else "DC_FAST")]
        elif pattern == "PUBLIC_DC" and day % (3 + variant) == 0:
            slots = [(18, "DC_FAST")]
        elif pattern == "SHORT_TOPUP" and rng.random() > .16:
            slots = [(12, "DC_FAST")]
            if variant and rng.random() > .35:
                slots.append((20, "AC_SLOW"))
        elif pattern == "ULTRA_FLEET" and weekday < 5:
            slots = [(7 + 3 * index, "ULTRA_FAST") for index in range(rng.randint(3, 5))]
        elif pattern == "LOW_USE" and day in ([3, 30] if variant == 0 else [1, 15, 32, 51]):
            slots = [(19, "AC_SLOW")]
        for hour, charger in slots:
            start = START + timedelta(days=day, hours=hour, minutes=rng.randint(-15, 15))
            events.append((start, charger))
    return sorted(events)


def generate(vehicles):
    users, sessions = [], []
    for pattern_index, (pattern, label) in enumerate(PATTERNS.items()):
        for vehicle_index, vehicle in enumerate(vehicles):
            for variant in range(2):
                rng = random.Random(SEED + pattern_index * 1000 + vehicle_index * 10 + variant)
                user_id = f"X{len(users) + 1:04d}"
                events = schedule(pattern, variant, rng)
                capacity = vehicle["batteryUsableKwh"]
                previous_soc = rng.uniform(65, 85)
                previous_unplug = START
                odometer = float(rng.randint(1000, 150000))
                users.append({
                    "userId": user_id, "vehicleId": vehicle["vehicleId"],
                    "driverProfile": pattern, "initialSocPct": round(previous_soc, 6),
                    "initialOdometerKm": odometer, "mockStartDate": iso(START),
                    "mockEndDate": iso(START + timedelta(days=DAYS)),
                    "plannedSessions": len(events), "profileNote": label,
                })
                previous_soc = users[-1]["initialSocPct"]
                for index, (started, charger) in enumerate(events):
                    # These distances only enforce energy continuity. Rated efficiency
                    # is a simulation assumption, never an independently measured input.
                    efficiency = round(vehicle["efficiencyKmPerKwh"] * rng.uniform(.75, 1.05), 6)
                    gap_hours = (started - previous_unplug).total_seconds() / 3600
                    if pattern in ("DAILY_AC", "WORK_AC", "MIXED_DAY"):
                        use_kwh = rng.uniform(6, 17)
                    elif pattern == "SHORT_TOPUP":
                        use_kwh = rng.uniform(1.8, 5)
                    elif pattern == "LOW_USE":
                        use_kwh = rng.uniform(8, 20)
                    elif pattern == "ULTRA_FLEET":
                        use_kwh = rng.uniform(14, 24)
                    else:
                        use_kwh = rng.uniform(22, 40)
                    # Max 70 km per hour of disconnected time; retains at least 8% SOC.
                    use_kwh = min(use_kwh, gap_hours * 70 / efficiency, (previous_soc - 8) / 100 * capacity)
                    start_soc = round(previous_soc - use_kwh / capacity * 100, 6)
                    target_soc = rng.uniform(72, 85)
                    # A separate within-pattern variation tests high-SOC dwell without
                    # asserting that all home/workplace charging ends at full charge.
                    if variant and index % 9 == 0 and charger == "AC_SLOW":
                        target_soc = rng.uniform(92, 98)
                    minimum_kwh = 2.0 if pattern == "SHORT_TOPUP" else 15.0 if pattern == "PUBLIC_DC" else 7.0 if charger != "AC_SLOW" else 4.0
                    wanted_kwh = max(minimum_kwh, (target_soc - start_soc) / 100 * capacity)
                    if pattern == "SHORT_TOPUP":
                        wanted_kwh = min(wanted_kwh, 5.0 if charger == "DC_FAST" else 2.2)
                    elif pattern == "MIXED_DAY" and charger == "DC_FAST":
                        wanted_kwh = min(wanted_kwh, rng.uniform(7, 13))
                    limit = min(vehicle["maxAcChargeKw"], 7) if charger == "AC_SLOW" else min(vehicle["maxDcChargeKw"], 350 if charger == "ULTRA_FAST" else 50)
                    power = limit * rng.uniform(.68, .94)
                    if pattern == "SHORT_TOPUP" and charger == "AC_SLOW":
                        power = limit * .94
                    # ULTRA_FAST describes the station, not a promise of car-side power.
                    if pattern == "ULTRA_FLEET":
                        desired_minutes = rng.randint(10, 30)
                        charged = min(wanted_kwh, power * desired_minutes / 60, (98 - start_soc) / 100 * capacity)
                        duration = desired_minutes * 60
                    else:
                        charged = min(wanted_kwh, (98 - start_soc) / 100 * capacity, power * 7)
                        minimum_seconds = 300 if pattern == "SHORT_TOPUP" else 600 if charger != "AC_SLOW" else 60
                        duration = max(minimum_seconds, math.ceil(charged / power * 3600))
                    charged = round(charged, 6)
                    end_soc = round(start_soc + charged / capacity * 100, 6)
                    ended = started + timedelta(seconds=duration)
                    if pattern == "WORK_AC":
                        unplugged = max(ended, started.replace(hour=17, minute=rng.randint(0, 30)))
                    elif charger == "AC_SLOW" and pattern not in ("SHORT_TOPUP", "LOW_USE"):
                        morning = (started + timedelta(days=1)).replace(hour=7, minute=rng.randint(0, 30))
                        unplugged = max(ended, morning)
                    else:
                        unplugged = ended + timedelta(minutes=rng.randint(0, 15))
                    consumed = round((previous_soc - start_soc) / 100 * capacity, 6)
                    distance = round(consumed * efficiency, 6)
                    odometer = round(odometer + distance, 6)
                    sessions.append({
                        "sessionId": f"XS{len(sessions) + 1:06d}", "userId": user_id,
                        "vehicleId": vehicle["vehicleId"], "chargedKwh": charged,
                        "startedAt": iso(started), "endedAt": iso(ended), "unpluggedAt": iso(unplugged),
                        "chargerType": charger, "paymentAmountKrw": round(charged * (250 if charger == "AC_SLOW" else 350)),
                        "stationType": "Workplace AC" if pattern == "WORK_AC" else "Home AC" if charger == "AC_SLOW" else "Highway DC" if pattern == "WEEKEND_TRIP" else "Public DC",
                        "taperDetected": "Y" if end_soc >= 90 else "N",
                        "userReportedStartSocPct": start_soc if index % 3 else None,
                        "userReportedEndSocPct": end_soc if index % 4 else None,
                        "mockTruthStartSocPct": start_soc, "mockTruthEndSocPct": end_soc,
                        "note": "합성 검증 데이터 · 실제 주행/효율 측정값 아님",
                        "syntheticDrivingKwh": consumed, "syntheticDistanceKm": distance,
                        "syntheticOdometerKm": odometer, "assumedEfficiencyKmPerKwh": efficiency,
                    })
                    previous_soc, previous_unplug = end_soc, unplugged
    return {"metadata": {
        "version": VERSION, "seed": SEED, "purpose": "validation-only; not representative of real users",
        "windowStart": iso(START), "windowEndExclusive": iso(START + timedelta(days=DAYS)),
        "latestDisconnectBound": iso(START + timedelta(days=DAYS, hours=12)),
        "calendarDays": DAYS, "timezone": "Asia/Seoul", "patterns": PATTERNS,
        "allocation": "20 vehicles × 2 variants per pattern; equal test coverage, not population weights",
        "energyBasis": "battery-side; no charge losses, temperature or independently measured driving efficiency",
        "originalFileSha256": {name: hashlib.sha256((DATA / name).read_bytes()).hexdigest() for name in
                               ["vehicleMaster.json", "mockUsers.json", "mockChargingSessions.json", "scoreRules.json"]},
    }, "users": users, "sessions": sessions}


def validate(vehicles, users, sessions, strict=False):
    """Fail on invalid data. Strict ledger checks apply only to the new scenarios."""
    by_vehicle = {row["vehicleId"]: row for row in vehicles}
    by_user = {row["userId"]: row for row in users}
    errors = []
    if len(by_vehicle) != len(vehicles) or len(by_user) != len(users):
        errors.append("duplicate vehicle/user id")
    if any(row["vehicleId"] not in by_vehicle for row in users):
        errors.append("unknown user vehicle")
    if len({row["sessionId"] for row in sessions}) != len(sessions):
        errors.append("duplicate session id")
    histories = defaultdict(list)
    for row in sessions:
        uid, vid = row["userId"], row["vehicleId"]
        if uid not in by_user or vid not in by_vehicle:
            errors.append("unknown user/vehicle")
            continue
        if by_user[uid]["vehicleId"] != vid:
            errors.append("user/vehicle mismatch")
        begin, end, unplug = (timestamp(row[key]) for key in ["startedAt", "endedAt", "unpluggedAt"])
        if not begin < end <= unplug:
            errors.append("invalid time order")
        if not math.isfinite(row["chargedKwh"]) or row["chargedKwh"] <= 0:
            errors.append("invalid charged energy")
        if row["chargerType"] not in ("AC_SLOW", "DC_FAST", "ULTRA_FAST"):
            errors.append("unknown charger type")
        histories[uid].append(row)
    for uid, history in histories.items():
        history.sort(key=lambda row: timestamp(row["startedAt"]))
        user = by_user[uid]
        vehicle = by_vehicle[user["vehicleId"]]
        capacity = vehicle["batteryUsableKwh"]
        previous_end = timestamp(user["mockStartDate"]) if strict else None
        previous_soc, previous_odometer = user["initialSocPct"], user["initialOdometerKm"]
        for row in history:
            begin, end, unplug = (timestamp(row[key]) for key in ["startedAt", "endedAt", "unpluggedAt"])
            if previous_end and begin < previous_end:
                errors.append("overlapping sessions")
            if strict:
                start_soc, end_soc = row["mockTruthStartSocPct"], row["mockTruthEndSocPct"]
                if not 0 <= start_soc < end_soc <= 100:
                    errors.append("invalid SOC")
                if abs(row["chargedKwh"] - (end_soc - start_soc) / 100 * capacity) > .00001:
                    errors.append("SOC/energy mismatch")
                duration = (end - begin).total_seconds() / 3600
                power_limit = min(vehicle["maxAcChargeKw"], 7) if row["chargerType"] == "AC_SLOW" else min(vehicle["maxDcChargeKw"], 350 if row["chargerType"] == "ULTRA_FAST" else 50)
                if duration <= 0 or row["chargedKwh"] / duration > power_limit + .00001:
                    errors.append("charging power exceeds vehicle/station limit")
                consumed, distance = row["syntheticDrivingKwh"], row["syntheticDistanceKm"]
                if consumed < 0 or abs((previous_soc - start_soc) / 100 * capacity - consumed) > .00001:
                    errors.append("SOC continuity mismatch")
                if distance < 0 or abs(distance - consumed * row["assumedEfficiencyKmPerKwh"]) > .00001:
                    errors.append("driving energy/distance mismatch")
                if abs(row["syntheticOdometerKm"] - previous_odometer - distance) > .00001:
                    errors.append("odometer continuity mismatch")
                if distance > (begin - previous_end).total_seconds() / 3600 * 70 + .00001:
                    errors.append("insufficient disconnected time for driving")
                # Calendar coverage is defined by connection day. A final-night
                # AC session may legitimately be disconnected the next morning.
                if not (START <= begin < START + timedelta(days=DAYS)
                        and begin < end <= unplug <= START + timedelta(days=DAYS, hours=12)):
                    errors.append("outside generation window")
                previous_soc, previous_odometer = end_soc, row["syntheticOdometerKm"]
            previous_end = unplug
        if strict and user["plannedSessions"] != len(history):
            errors.append("planned session count mismatch")
    if len(histories) != len(users):
        errors.append("user without sessions")
    if errors:
        raise ValueError(json.dumps(dict(Counter(errors)), ensure_ascii=False))


def distribution(values):
    return {"min": round(min(values), 3), "median": round(statistics.median(values), 3),
            "max": round(max(values), 3), "mean": round(statistics.mean(values), 3)}


def statistics_for(users, sessions, calendar_days=None):
    histories, daily = defaultdict(list), defaultdict(list)
    for row in sessions:
        histories[row["userId"]].append(row)
        daily[(row["userId"], timestamp(row["startedAt"]).date())].append(row)
    intervals = [(max(timestamp(r["endedAt"]) for r in history) - min(timestamp(r["startedAt"]) for r in history)).total_seconds() / 86400 for history in histories.values()]
    duration = lambda row: (timestamp(row["endedAt"]) - timestamp(row["startedAt"])).total_seconds() / 60
    streak_users = set()
    for uid, history in histories.items():
        day_types = defaultdict(set)
        for row in history:
            day_types[timestamp(row["startedAt"]).date()].add(row["chargerType"])
        for day in day_types:
            if all(day_types.get(day + timedelta(days=i)) == {"AC_SLOW"} for i in range(7)):
                streak_users.add(uid)
                break
    fleet_days = [(uid, day) for (uid, day), rows in daily.items()
                  if sum(row["chargerType"] == "ULTRA_FAST" and 10 <= duration(row) <= 30 for row in rows) >= 3]
    fleet_counts = Counter(uid for uid, _ in fleet_days)
    charging_stats = {}
    for charger in ("AC_SLOW", "DC_FAST", "ULTRA_FAST"):
        rows = [row for row in sessions if row["chargerType"] == charger]
        if rows:
            charging_stats[charger] = {"count": len(rows), "durationMinutes": distribution([duration(r) for r in rows]),
                                     "chargedKwh": distribution([r["chargedKwh"] for r in rows])}
    result = {
        "users": len(users), "sessions": len(sessions), "vehicles": len({u["vehicleId"] for u in users}),
        "sessionsPerUser": distribution([len(rows) for rows in histories.values()]),
        "sessionsPerChargingDay": distribution([len(rows) for rows in daily.values()]),
        "observationDays": distribution(intervals),
        "durationMinutes": distribution([duration(row) for row in sessions]),
        "chargedKwh": distribution([row["chargedKwh"] for row in sessions]),
        "idleMinutes": distribution([(timestamp(row["unpluggedAt"]) - timestamp(row["endedAt"])).total_seconds() / 60 for row in sessions]),
        "sevenConsecutiveAcOnlyDaysUsers": len(streak_users),
        "mixedAcDcDays": sum(any(r["chargerType"] == "AC_SLOW" for r in rows) and any(r["chargerType"] != "AC_SLOW" for r in rows) for rows in daily.values()),
        "threeOrMore10to30MinuteUltraDays": len(fleet_days),
        "repeatedUltraDaysUsers": sum(count >= 3 for count in fleet_counts.values()),
        "byCharger": charging_stats,
    }
    if calendar_days:
        result["noChargeUserDays"] = len(users) * calendar_days - len(daily)
        result["sessionsPerCalendarDay"] = distribution([len(rows) for rows in daily.values()] + [0] * result["noChargeUserDays"])
    return result


def encode_fixture(data):
    # One record per line keeps reviews practical without a many-MB single line.
    encode = lambda row: json.dumps(row, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return '{"metadata":' + encode(data["metadata"]) + ',\n"users":[\n' + ',\n'.join(map(encode, data["users"])) + '\n],\n"sessions":[\n' + ',\n'.join(map(encode, data["sessions"])) + '\n]}\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate and require byte-for-byte reproducibility without writing")
    args = parser.parse_args()
    vehicles, original_users, original_sessions = load("vehicleMaster"), load("mockUsers"), load("mockChargingSessions")
    data = generate(vehicles)
    validate(vehicles, original_users, original_sessions)
    validate(vehicles, data["users"], data["sessions"], strict=True)
    validate(vehicles, original_users + data["users"], original_sessions + data["sessions"])
    boundary_ids = {u["userId"] for u in data["users"] if u["driverProfile"] == "ULTRA_FLEET"}
    pattern_by_user = {u["userId"]: u["driverProfile"] for u in data["users"]}
    report = {"version": VERSION, "validationErrors": 0,
              "original": statistics_for(original_users, original_sessions),
              "extension": statistics_for(data["users"], data["sessions"], DAYS),
              "combined": statistics_for(original_users + data["users"], original_sessions + data["sessions"]),
              "extensionWithoutFleetBoundary": statistics_for([u for u in data["users"] if u["userId"] not in boundary_ids],
                                                               [r for r in data["sessions"] if r["userId"] not in boundary_ids], DAYS),
              "patterns": {pattern: statistics_for([u for u in data["users"] if u["driverProfile"] == pattern],
                            [r for r in data["sessions"] if pattern_by_user[r["userId"]] == pattern], DAYS)
                           for pattern in PATTERNS}}
    for path, content in [(OUTPUT, encode_fixture(data)), (REPORT, json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")]:
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Outdated generated fixture: {path}; run npm run generate:scenarios")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["validationErrors", "extension", "combined"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
