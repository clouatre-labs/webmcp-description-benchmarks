# SPDX-License-Identifier: Apache-2.0
# WebMCP payload token counts at three site commits vs the 2,000 and
# 600 token budgets. Source: docs/audit/2026-10-04-webmcp-payload.json.

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

REPO = Path(__file__).resolve().parents[1]
payload = json.loads(
    (REPO / "docs/audit/2026-10-04-webmcp-payload.json").read_text()
)
points = {p["label"]: p for p in payload["points"]}

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5))

# Panel 1: get_post_markdown response size at the three commits.
stages = [
    ("Unbounded\n(full post)", points["unbounded"]["audited_post_full_tokens"]),
    ("Paginated\n(largest page)", max(
        r["tokens"] for r in points["paginated"]["rows"]
        if r["tool"] == "get_post_markdown"
    )),
    ("Capped HEAD\n(largest page)", max(
        r["tokens"] for r in points["head"]["rows"]
        if r["tool"] == "get_post_markdown"
    )),
]
colors = ["#D55E00", "#009E73", "#0072B2"]
bars = ax1.bar([s[0] for s in stages], [s[1] for s in stages],
               color=colors, width=0.55, zorder=3)
for bar, (_, v) in zip(bars, stages):
    ax1.text(bar.get_x() + bar.get_width() / 2, v + 120, f"{v:,}",
             ha="center", va="bottom", fontsize=9, fontweight="bold")
ax1.axhline(2000, color="0.2", linestyle="--", linewidth=1.5, zorder=4)
ax1.text(2.42, 2100, "2,000 budget", fontsize=8, ha="right", color="0.2")
ax1.set_ylabel("Payload tokens (o200k_base)", fontsize=10)
ax1.set_title("get_post_markdown: 6,764 to under budget", fontsize=11)
ax1.set_ylim(0, 7600)
ax1.yaxis.grid(True, linestyle="--", alpha=0.4, zorder=0)
ax1.set_axisbelow(True)
ax1.tick_params(axis="x", labelsize=9)

# Panel 2: discovery tools at HEAD vs their 600 token budget.
tools = ["search_posts", "get_related_posts", "get_posts_by_concept"]
rows = {r["tool"]: r["tokens"] for r in points["head"]["rows"]
        if r["tool"] in tools}
bars2 = ax2.bar(tools, [rows[t] for t in tools], color="#0072B2",
                width=0.5, zorder=3)
for bar, t in zip(bars2, tools):
    ax2.text(bar.get_x() + bar.get_width() / 2,
             bar.get_height() + 10, f"{rows[t]:,}",
             ha="center", va="bottom", fontsize=9, fontweight="bold")
ax2.axhline(600, color="0.2", linestyle="--", linewidth=1.5, zorder=4)
ax2.text(2.45, 615, "600 budget", fontsize=8, ha="right", color="0.2")
ax2.set_title("Discovery tools: all under budget", fontsize=11)
ax2.set_ylim(0, 720)
ax2.yaxis.grid(True, linestyle="--", alpha=0.4, zorder=0)
ax2.set_axisbelow(True)
ax2.tick_params(axis="x", labelsize=8, rotation=12)

fig.tight_layout()
out = Path(__file__).with_suffix(".svg")
fig.savefig(out, bbox_inches="tight", transparent=True)
print(f"Saved {out}")
