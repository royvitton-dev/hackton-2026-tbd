"""Plot a completed engine-load run without modifying its source evidence.

Requires matplotlib. Set MPLCONFIGDIR to a directory within trading before use.
Usage: python scripts/plot-engine-load.py <engine-load-run-id>
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import uuid

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("run_id")
args = parser.parse_args()
source = (ROOT / "evidence" / args.run_id).resolve()
assert source.is_relative_to(ROOT / "evidence")
files = {name: source / name for name in
         ("summary.json", "metadata.json", "resource-samples.json", "events.json")}
summary, metadata, samples, events = [json.loads(files[name].read_text(encoding="utf-8"))
                                      for name in files]
assert summary["run_id"] == metadata["run_id"] == args.run_id
engine_pid = summary["engine_pid"]
logical_cpus = metadata["host"]["logical_processors"]
by_time = {sample["at"]: sample for sample in samples}
assert len(by_time) == len(samples), "Duplicate resource sample timestamps"
curves, statistics = [], []
for phase in summary["phases"]:
    points = []
    for interval in phase["resources"]["intervals"]:
        before, after = [by_time[interval[key]] for key in ("from", "to")]
        left, right = [next(row for row in sample["processes"]
                            if row["pid"] == engine_pid) for sample in (before, after)]
        seconds = (after["elapsed_ms"] - before["elapsed_ms"]) / 1000
        expected = (right["cpu_seconds"] - left["cpu_seconds"]) / seconds / logical_cpus * 100
        reported = next(row for row in interval["processes"]
                        if row["pid"] == engine_pid)["percent_total_capacity"]
        assert abs(expected - reported) < 1e-9
        points.append(((before["received_ms"] + after["received_ms"]) / 2000, reported))
    assert points, f"No valid engine CPU intervals for {phase['phase']}"
    curves.append(points)
    engine = next(row for row in phase["resources"]["by_process"] if row["role"] == "engine")
    statistics.append({"concurrency": phase["concurrency"],
                       "seconds": phase["elapsed_seconds"], "commands": phase["commands"],
                       "commands_per_second": phase["commands_per_second"],
                       "ack_p99_ms": phase["ack_latency_ms"]["p99"], **engine})

memory = []
for sample in samples:
    rows = [row for row in sample.get("processes", [])
            if isinstance(row, dict) and row.get("pid") == engine_pid]
    if len(rows) != 1:
        continue
    row = rows[0]
    if all(isinstance(row.get(key), (int, float)) and row[key] >= 0
           for key in ("working_set_bytes", "private_bytes")):
        memory.append((sample["received_ms"] / 1000, row["working_set_bytes"] / 2**20,
                       row["private_bytes"] / 2**20))
assert memory, "No valid engine memory samples"

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False})
fig, axes = plt.subplots(2, 1, figsize=(12, 7.2), sharex=True,
                         gridspec_kw={"height_ratios": [1, 1]})
fig.patch.set_facecolor("#f7f8fc")
for axis in axes:
    axis.set_facecolor("#ffffff")
    axis.grid(axis="y", color="#e4e7ef", linewidth=.7)
    axis.set_axisbelow(True)
for index, phase in enumerate(summary["phases"]):
    begin, end = phase["begin_ms"] / 1000, phase["end_ms"] / 1000
    for axis in axes:
        axis.axvspan(begin, end, color=["#edf4ff", "#eff8f3", "#fff4e9"][index % 3], zorder=0)
    axes[0].text((begin + end) / 2, 1.03,
                 f"{phase['concurrency']} concurrent | {phase['elapsed_seconds']:.1f}s",
                 transform=axes[0].get_xaxis_transform(), ha="center", fontsize=10,
                 color="#374151", fontweight="bold")
for points in curves:
    axes[0].plot(*zip(*points), color="#295ece", linewidth=1.5)
disconnects = [event for event in events
               if event.get("event") == "ws_closed" and not event.get("intentional")]
for event in disconnects:
    when = event["relative_ms"] / 1000
    for axis in axes:
        axis.axvline(when, color="#ab3939", linewidth=1.2, linestyle="--")
    axes[0].text(when + .5, .91, "WS disconnected\nSubsequent phase has no WS",
                 transform=axes[0].get_xaxis_transform(), fontsize=9,
                 color="#ab3939", va="top")
axes[0].set_ylabel("Engine CPU (% of host capacity)")
axes[0].set_ylim(0, max(1, max(y for curve in curves for _, y in curve) * 1.15))
times, working_set, private = zip(*memory)
axes[1].plot(times, working_set, color="#295ece", linewidth=1.7, label="Working set (resident)")
axes[1].plot(times, private, color="#ce7629", linewidth=1.7, label="Private bytes (committed)")
axes[1].set_ylabel("Engine memory (MiB)")
axes[1].set_xlabel("Elapsed seconds from harness start (sample receipt time)")
axes[1].set_ylim(bottom=0)
axes[1].legend(loc="upper left", frameon=False)
axes[1].set_xlim(0, max(times) + .5)
fig.suptitle("Rust engine load test: CPU and memory", x=.08, ha="left",
             fontsize=19, fontweight="bold", color="#17223b", y=.98)
fig.text(.08, .925,
         f"{logical_cpus} logical CPUs; ~500 ms interval averages; sampled memory | "
         "Live demo running on the same host", fontsize=10, color="#4b5563")
fig.text(.08, .025,
         f"Isolated release engine; durable order ACKs; WS disconnects: {len(disconnects)}. "
         "This is a short competing-load run, not a maximum-capacity or leak test.",
         fontsize=9, color="#4b5563")
fig.tight_layout(rect=(.02, .055, .99, .88), h_pad=2.4)
plot_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + "-engine-load-plot-" + uuid.uuid4().hex[:8]
output = ROOT / "evidence" / plot_id
output.mkdir(exist_ok=False)
fig.savefig(output / "engine-cpu-memory.png", dpi=160, facecolor=fig.get_facecolor())
fig.savefig(output / "engine-cpu-memory.svg", facecolor=fig.get_facecolor())
plt.close(fig)
record = {"source_run": args.run_id,
          "source_sha256": {name: hashlib.sha256(file.read_bytes()).hexdigest()
                            for name, file in files.items()},
          "plot_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          "python": platform.python_version(), "matplotlib": matplotlib.__version__,
          "cpu_intervals_independently_recalculated": sum(map(len, curves)),
          "memory_samples": len(memory), "phases": statistics,
          "limits": ["CPU percent uses all logical CPUs as 100%; not single-core normalization.",
                     "CPU points are interval means, not instantaneous peaks.",
                     "Memory values are sampled; private bytes and resident working set differ.",
                     "X axis is sample receipt time; cross-phase CPU intervals are excluded."]}
(output / "plot-verification.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"directory": str(output), "phases": statistics}, indent=2))
