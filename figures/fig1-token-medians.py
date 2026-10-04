# SPDX-License-Identifier: Apache-2.0
# Median total tokens per task-model cell, baseline vs delta-rerun.
# Reads the committed run JSONs; rubric-failing runs are excluded
# (one baseline extract/claude-haiku-4-5 run), matching summary.md.
# Rendered output is an opaque PNG (300 dpi), following the house
# figure standard in clouatre-labs/prompt-repetition-experiments.

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
BASELINE_COLOR = "#1f77b4"
RERUN_COLOR = "#ff7f0e"
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


baseline = medians("baseline")
rerun = medians("delta-rerun")

fig, ax = plt.subplots(figsize=(10, 5))

cells = [(t, m) for t in TASKS for m, _ in MODELS]
x = np.arange(len(cells))
width = 0.38

base_vals = [baseline[c] for c in cells]
rerun_vals = [rerun[c] for c in cells]

bars_base = ax.bar(x - width / 2, base_vals, width,
                   label="Baseline", color=BASELINE_COLOR, zorder=3)
bars_rerun = ax.bar(x + width / 2, rerun_vals, width,
                    label="Rerun", color=RERUN_COLOR, zorder=3)


def format_value(v):
    return f"{v/1000:.1f}K"


for bars, vals in [(bars_base, base_vals), (bars_rerun, rerun_vals)]:
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 1500,
                format_value(v), ha="center", va="bottom",
                fontsize=8, fontweight="bold")

within = 0
for i, c in enumerate(cells):
    delta = (rerun_vals[i] - base_vals[i]) / base_vals[i] * 100
    if abs(delta) <= 4:
        within += 1
    ax.text(x[i], 133000, f"{delta:+.1f}%", ha="center", va="bottom",
            fontsize=8, color="0.35")

ax.set_ylabel("Median total tokens (rubric-passing runs)", fontsize=11)
ax.set_title(
    f"Rerun medians within 4% of baseline in {within} of 9 cells "
    "(deltas above each cell)", fontsize=12,
)
ax.set_ylim(0, 145000)
ax.yaxis.grid(True, linestyle="--", alpha=0.4, zorder=0)
ax.set_axisbelow(True)

labels = [f"{label}\n{task[:3].capitalize()}"
          for task in TASKS for _, label in MODELS]
ax.set_xticks(x)
ax.set_xticklabels(labels, fontsize=9)
ax.legend(loc="upper left", bbox_to_anchor=(0.0, 0.92), fontsize=9)

fig.tight_layout()
out = Path(__file__).with_suffix(".png")
fig.savefig(out, dpi=300, bbox_inches="tight")
print(f"Saved {out}")
