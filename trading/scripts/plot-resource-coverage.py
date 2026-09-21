"""Plot frozen primary and supplementary resource evidence without joining gaps.

Usage: python scripts/plot-resource-coverage.py <primary-prefix.jsonl>
       <corrected-primary-analysis.json> <supplementary-analysis-directory>
All inputs and newly created output stay under trading/evidence.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import platform
import uuid

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = (ROOT / "evidence").resolve()
KST = timezone(timedelta(hours=9))
MIB = 1024 ** 2


def inside(value):
    result = Path(value).resolve()
    assert result.is_relative_to(EVIDENCE), f"Input must be within {EVIDENCE}"
    return result


def read_json(file):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def read_rows(file):
    data = file.read_bytes()
    assert data.endswith(b"\n"), "Use a frozen complete JSONL prefix"
    return [json.loads(line) for line in data.splitlines()]


def date(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(KST)


def same(left, right):
    assert math.isclose(left, right, rel_tol=1e-10, abs_tol=1e-9), (left, right)


def verify_cpu(intervals, samples, cores, engine_pid):
    by_time = {row["at"]: row for row in samples}
    engine_percent = []
    for window in intervals:
        before, after = by_time[window["from"]], by_time[window["to"]]
        seconds = (after["elapsed_ms"] - before["elapsed_ms"]) / 1000
        a = {row["Id"]: row for row in before["resources"]}
        b = {row["Id"]: row for row in after["resources"]}
        assert a.keys() == b.keys() and len(a) == 14
        for pid in a:
            assert a[pid]["ProcessName"] == b[pid]["ProcessName"]
            if "StartTimeUtc" in a[pid]:
                assert a[pid]["StartTimeUtc"] == b[pid]["StartTimeUtc"]
                assert a[pid]["role"] == b[pid]["role"]
        cpu = sum(b[pid]["CPU"] - a[pid]["CPU"] for pid in a)
        same(seconds, window["seconds"])
        same(cpu, window["cpu_seconds"])
        same(cpu / seconds / cores * 100, window["percent_total_capacity"])
        engine_percent.append((b[engine_pid]["CPU"] - a[engine_pid]["CPU"]) / seconds / cores * 100)
    return engine_percent


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("primary_prefix")
parser.add_argument("primary_analysis")
parser.add_argument("supplementary_directory")
args = parser.parse_args()
prefix_file, primary_file, supplement_dir = map(inside, [args.primary_prefix, args.primary_analysis, args.supplementary_directory])
supplement_file = inside(supplement_dir / "analysis.json")
supplement_prefix = inside(supplement_dir / "samples-prefix.jsonl")
primary, supplementary = read_json(primary_file), read_json(supplement_file)
old_rows, new_rows = read_rows(prefix_file), read_rows(supplement_prefix)
cores = primary["cpu_windows"]["logical_processors"]
assert cores == supplementary["parameters"]["logical_processors"]
expected = primary["memory_sample_validation"]["process_identity_baseline"]["processes"]
expected_names = sorted((row["pid"], row["process_name"]) for row in expected)
old_memory = [row for row in old_rows if isinstance(row.get("resources"), list)
              and sorted((item["Id"], item["ProcessName"]) for item in row["resources"]) == expected_names]
assert len(old_memory) == primary["memory_sample_validation"]["valid_samples"]
assert old_memory[-1]["at"] == primary["tracked_process_total_memory_windows"]["last"]["at"]
assert supplementary["coverage"]["all_samples_and_intervals_valid"] is True
assert supplementary["coverage"]["sample_count"] == len(new_rows)
assert len(supplementary["memory"]["full_groups_by_membership"]) == 1
engine_pid = next(row["pid"] for row in expected if row["process_name"] == "leave-engine")
assert {row["Id"] for row in supplementary["cpu"]["per_process"] if row["role"] == "engine"} == {engine_pid}
old_cpu = primary["cpu_windows"]["intervals"]
new_cpu = supplementary["cpu"]["full_group"]["intervals"]
old_engine_cpu = verify_cpu(old_cpu, old_rows, cores, engine_pid)
new_engine_cpu = verify_cpu(new_cpu, new_rows, cores, engine_pid)
same(sum(row["cpu_seconds"] for row in new_cpu) / sum(row["seconds"] for row in new_cpu) / cores * 100,
     supplementary["cpu"]["full_group"]["mean_percent_total_capacity"])
for row, reported in zip(new_rows, supplementary["memory"]["full_groups_by_membership"][0]["working_set_bytes"]["samples"], strict=True):
    assert sum(item["WorkingSet64"] for item in row["resources"]) == reported["bytes"]
for row, reported in zip(new_rows, supplementary["memory"]["full_groups_by_membership"][0]["private_bytes"]["samples"], strict=True):
    assert sum(item["PrivateMemorySize64"] for item in row["resources"]) == reported["bytes"]

gap_start, gap_end = date(old_memory[-1]["at"]), date(new_rows[0]["at"])
assert gap_end > gap_start
output = EVIDENCE / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + "-resource-coverage-plot-" + uuid.uuid4().hex[:8])
output.mkdir()
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
fig, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
fig.subplots_adjust(left=.09, right=.97, top=.89, bottom=.14, hspace=.30)
fig.suptitle("Leave Exchange | observed CPU and memory", x=.09, y=.97, ha="left", fontsize=20, fontweight="bold")
fig.text(.09, .929, "Local demo · 12 bots + engine + UI · resource collection remains in progress", color="#4b5563", fontsize=11)
total_color, engine_color, private_color = "#4463d6", "#0a8a77", "#a657bd"
for index, (windows, engine_values) in enumerate([(old_cpu, old_engine_cpu), (new_cpu, new_engine_cpu)]):
    times = [date(row["to"]) for row in windows]
    axes[0].plot(times, [row["percent_total_capacity"] for row in windows], color=total_color, lw=1.4, label="Tracked 14 total" if index == 0 else None)
    axes[0].plot(times, engine_values, color=engine_color, lw=1.2, label="Engine" if index == 0 else None)
for index, rows in enumerate([old_memory, new_rows]):
    times = [date(row["at"]) for row in rows]
    engine = [next(item for item in row["resources"] if item["Id"] == engine_pid) for row in rows]
    axes[1].plot(times, [item["WorkingSet64"] / MIB for item in engine], color=engine_color, lw=1.5, label="Working set" if index == 0 else None)
    axes[1].plot(times, [item["PrivateMemorySize64"] / MIB for item in engine], color=private_color, lw=1.5, label="Private commit" if index == 0 else None)
    axes[2].plot(times, [sum(item["WorkingSet64"] for item in row["resources"]) / MIB for row in rows], color=total_color, lw=1.5, label="Working-set sum" if index == 0 else None)
    axes[2].plot(times, [sum(item["PrivateMemorySize64"] for item in row["resources"]) / MIB for row in rows], color=private_color, lw=1.5, label="Private-commit sum" if index == 0 else None)
for ax, title, label in zip(axes, ["CPU · approximately 30-second interval means", "Engine memory", "Tracked 14-process memory"], [f"% of {cores} logical CPUs", "MiB", "MiB"], strict=True):
    ax.set_title(title, loc="left", fontsize=12, pad=10)
    ax.set_ylabel(label)
    ax.grid(axis="y", color="#e5e7eb", lw=.7)
    ax.axvspan(gap_start, gap_end, color="#ececec", zorder=-2)
    ax.legend(loc="upper left", frameon=False, ncol=2, fontsize=9)
    # Leave headroom for legends above the observed curves.
    ax.set_ylim(0, ax.get_ylim()[1] * 1.16)
gap_center = gap_start + (gap_end - gap_start) / 2
axes[0].text(gap_center, .93, "Resource gap\n21:44–22:18", transform=axes[0].get_xaxis_transform(), ha="center", va="top", fontsize=9, color="#666666")
axes[2].xaxis.set_major_locator(mdates.MinuteLocator(byminute=[0, 30], tz=KST))
axes[2].xaxis.set_major_formatter(mdates.DateFormatter("%H:%M", tz=KST))
axes[2].set_xlabel("2026-09-21 · Korea Standard Time (UTC+09:00)")
fig.text(.09, .072, "Lines stop at missing coverage; no interpolation or zero filling. UI changed from PID 17556 to 4220.\n"
         "Working-set sums may count shared pages twice. Private commit is not resident RAM.\n"
         "Sampled extrema are not instantaneous peaks. This is demo observation, not a quiet benchmark.", fontsize=9, color="#4b5563", va="top")
fig.savefig(output / "resource-coverage.png", dpi=170, facecolor="white")
fig.savefig(output / "resource-coverage.svg", facecolor="white")
sources = [prefix_file, primary_file, supplement_file, supplement_prefix]
verification = {
    "created_at": datetime.now(timezone.utc).isoformat(), "python": platform.python_version(), "matplotlib": matplotlib.__version__,
    "sources": [{"file": str(file.relative_to(ROOT)), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()} for file in sources],
    "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "cpu_intervals_independently_recalculated": len(old_cpu) + len(new_cpu),
    "primary_memory_samples": len(old_memory), "supplementary_memory_samples": len(new_rows),
    "gap_from": gap_start.isoformat(), "gap_to": gap_end.isoformat(),
    "gap_seconds": (gap_end - gap_start).total_seconds(), "logical_processors": cores,
    "limits": ["Two separately collected coverage periods; no missing readings reconstructed", "Primary legacy rows lack process start times; same-PID same-name reuse cannot be excluded", "Supplementary run still in progress"],
}
(output / "plot-verification.json").write_text(json.dumps(verification, indent=2), encoding="utf-8")
(output / "plot-source.py").write_bytes(Path(__file__).read_bytes())
print(json.dumps({"evidence": str(output), "verified_cpu_intervals": verification["cpu_intervals_independently_recalculated"], "gap_seconds": verification["gap_seconds"]}))
