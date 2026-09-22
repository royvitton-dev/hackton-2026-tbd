"""Mutation tests: a green fixture alone cannot prove that a validator works."""
import copy
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/generate-charging-scenarios.py"
spec = importlib.util.spec_from_file_location("charging_scenarios", SCRIPT)
scenarios = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scenarios)


class ChargingScenarioValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vehicles = scenarios.load("vehicleMaster")
        cls.fixture = scenarios.generate(cls.vehicles)

    def subset(self):
        user = self.fixture["users"][0]
        return copy.deepcopy([user]), copy.deepcopy([s for s in self.fixture["sessions"] if s["userId"] == user["userId"]])

    def test_seed_reproducibility(self):
        self.assertEqual(self.fixture, scenarios.generate(self.vehicles))

    def test_all_new_and_combined_records(self):
        scenarios.validate(self.vehicles, self.fixture["users"], self.fixture["sessions"], strict=True)
        scenarios.validate(self.vehicles, scenarios.load("mockUsers") + self.fixture["users"],
                           scenarios.load("mockChargingSessions") + self.fixture["sessions"])

    def test_rejects_bad_links_times_energy_and_ledger(self):
        mutations = [
            ("unknown user/vehicle", lambda u, s: s[0].update(userId="UNKNOWN")),
            ("unknown user/vehicle", lambda u, s: s[0].update(vehicleId="UNKNOWN")),
            ("user/vehicle mismatch", lambda u, s: s[0].update(vehicleId=self.vehicles[1]["vehicleId"])),
            ("duplicate session id", lambda u, s: s[1].update(sessionId=s[0]["sessionId"])),
            ("duplicate vehicle/user id", lambda u, s: u.append(copy.deepcopy(u[0]))),
            ("invalid time order", lambda u, s: s[0].update(endedAt=s[0]["startedAt"])),
            ("invalid time order", lambda u, s: s[0].update(unpluggedAt=s[0]["startedAt"])),
            ("overlapping sessions", lambda u, s: s[1].update(startedAt=s[0]["startedAt"])),
            ("SOC/energy mismatch", lambda u, s: s[0].update(chargedKwh=s[0]["chargedKwh"] + 5)),
            ("invalid SOC", lambda u, s: s[0].update(mockTruthEndSocPct=101)),
            ("SOC continuity mismatch", lambda u, s: s[1].update(mockTruthStartSocPct=99)),
            ("driving energy/distance mismatch", lambda u, s: s[0].update(syntheticDistanceKm=-1)),
            ("odometer continuity mismatch", lambda u, s: s[1].update(syntheticOdometerKm=1)),
            ("charging power exceeds", lambda u, s: s[0].update(endedAt=scenarios.iso(scenarios.timestamp(s[0]["startedAt"]) + scenarios.timedelta(seconds=1)))),
            ("unknown charger type", lambda u, s: s[0].update(chargerType="UNKNOWN")),
        ]
        for error, mutate in mutations:
            with self.subTest(error=error):
                users, sessions = self.subset()
                mutate(users, sessions)
                with self.assertRaisesRegex(ValueError, error):
                    scenarios.validate(self.vehicles, users, sessions, strict=True)

    def test_pattern_coverage_and_non_charging_days(self):
        data = self.fixture
        self.assertEqual(len(data["users"]), 360)
        for pattern in scenarios.PATTERNS:
            users = [u for u in data["users"] if u["driverProfile"] == pattern]
            self.assertEqual(len(users), 40)
            self.assertEqual(len({u["vehicleId"] for u in users}), 20)
        report = scenarios.statistics_for(data["users"], data["sessions"], scenarios.DAYS)
        self.assertEqual(report["sevenConsecutiveAcOnlyDaysUsers"], 40)
        self.assertEqual(report["repeatedUltraDaysUsers"], 40)
        self.assertEqual(report["threeOrMore10to30MinuteUltraDays"], 40 * 40)
        self.assertGreater(report["mixedAcDcDays"], 1000)
        self.assertGreater(report["noChargeUserDays"], 8000)
        self.assertEqual(report["sessionsPerCalendarDay"]["min"], 0)
        self.assertEqual(report["sessionsPerCalendarDay"]["max"], 5)

    def test_night_charge_can_disconnect_after_last_calendar_day(self):
        users = [u for u in self.fixture["users"] if u["driverProfile"] == "DAILY_AC"]
        user = users[0]
        history = [s for s in self.fixture["sessions"] if s["userId"] == user["userId"]]
        self.assertEqual(len(history), 56)
        self.assertGreater(scenarios.timestamp(history[-1]["unpluggedAt"]), scenarios.START + scenarios.timedelta(days=56))
        scenarios.validate(self.vehicles, [user], history, strict=True)


if __name__ == "__main__":
    unittest.main()
