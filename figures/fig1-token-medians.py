# SPDX-License-Identifier: Apache-2.0
# Median total tokens per task-model cell, baseline vs delta-rerun.
# Reads the committed run JSONs; rubric-failing runs are excluded
# (one baseline extract/claude-haiku-4-5 run), matching summary.md.

import glob
import json
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

REPO = Path(__file__).resolve().parents[1]
BATCHES = [
    ("Baseline", "baseline", "#0072B2"),
    ("Rerun", "delta-rerun", "#E69F00"),
]
TASKS = ["discover", "extract", "traverse"]
MODELS = [
    ("claude-haiku-4-5", "Haiku"),
    ("glm-5.3-flash", "GLM"),
    ("openai/gpt-6-luna", "Luna"),
]


def medians(batch):
    cells = defaultdict(list)
    for f in sorted(glob.glob(str(REPO / f"docs/audit/{batch}/runs/*.json"))):
        run = json.loads(Path(f).read_text())
        if run["rubric"]["pass"]:
            cells[(run["task"], run["model"])].append(run["tokens"]["total"])
    return {
        (t, m): statistics.median(v) for (t, m), v in cells.items()
    }


data = {label: medians(batch) for label, batch, _ in BATCHES}

fig, ax = plt.subplots(figsize=(11, 5))

x = np.arange(len(TASKS) * len(MODELS))
width = 0.38
labels = []
for task in TASKS:
    for _, mlabel in MODELS:
        labels.append(f"{mlabel}\n{task[:3].capitalize()}")

within = 0
for k, (label, batch, color) in enumerate(BATCHES):
    vals = [
        data[label][(t, m)] for t in TASKS for m, _ in MODELS
    ]
    bars = ax.bar(
        x + (k - 0.5) * width, vals, width, label=label,
        color=color, zorder=3,
    )
    for bi, bar in enumerate(bars):
        h = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2, h * 1.04, f"{h/1000:.1f}K",
            ha="center", va="bottom", fontsize=8, fontweight="bold",
        )
    if k == 1:
        for bi, (t, m) in enumerate(
            [(t, m) for t in TASKS for m, _ in MODELS]
        ):
            base = data["Baseline"][(t, m)]
            delta = (data["Rerun"][(t, m)] - base) / base * 100
            if abs(delta) <= 4:
                within += 1
            ax.text(
                x[bi], 128000, f"{delta:+.0f}%", ha="center", va="bottom",
                fontsize=7, color="0.35",
            )

ax.set_ylabel("Median total tokens (rubric-passing runs)", fontsize=11)
ax.set_title(
    f"Rerun medians within 4% of baseline in {within} of 9 cells",
    fontsize=12,
)
ax.set_ylim(0, 140000)
ax.yaxis.grid(True, linestyle="--", alpha=0.4, zorder=0)
ax.set_axisbelow(True)
ax.set_xticks(x)
ax.set_xticklabels(labels, fontsize=8)
ax.legend(loc="upper left", fontsize=9)

fig.tight_layout()
out = Path(__file__).with_suffix(".svg")
fig.savefig(out, bbox_inches="tight", transparent=True)
print(f"Saved {out}")
