"""Run native image-analysis regressions and save the actual result for reports."""
import json
from pathlib import Path
import unittest

root = Path(__file__).resolve().parents[1]
suite = unittest.defaultTestLoader.discover(str(root / "tests/python"))
result = unittest.TextTestRunner(verbosity=2).run(suite)
report = {"total": result.testsRun, "passed": result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped),
          "failed": len(result.failures) + len(result.errors), "skipped": len(result.skipped),
          "failures": [{"test": str(test), "detail": detail} for test, detail in result.failures + result.errors]}
(root / "reports").mkdir(exist_ok=True)
(root / "reports/vision.json").write_text(json.dumps(report, indent=2) + "\n")
raise SystemExit(0 if result.wasSuccessful() else 1)
