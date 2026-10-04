// SPDX-License-Identifier: Apache-2.0
// WebMCP behavioral eval: total tokens per run for the four-tool baseline
// (post-#1632) and the rerun on 289d94d (progressive disclosure, caps,
// #1659 ordering fix). 3 tasks x 3 models x 5 iterations per batch.
// Source: docs/audit/ai-performance/2026-10-04-webmcp-eval/{baseline,
// delta-rerun}/runs/*.json, field tokens.total, rubric-passing runs only
// (matches summary.md). Baseline extract/claude-haiku-4-5 iteration 1
// failed the rubric (80,292 tokens) and is excluded: 4 runs in that cell,
// 89 runs plotted. Means and bootstrap 95% CIs (10,000 resamples,
// mulberry32 seed 42, one stream across cells in category order,
// Baseline then Rerun) precomputed.

import type { SlopeOverlayChart } from "./types";

const chart: SlopeOverlayChart = {
  id: "webmcp-rerun-tokens",
  type: "slope-overlay",
  title: "Tokens stayed within 4% of baseline in 7 of 9 cells",
  source:
    "2026-10-04-webmcp-eval baseline and delta-rerun run JSONs (archived in docs/audit/)",
  categories: [
    "D-Haiku",
    "D-GLM",
    "D-Luna",
    "E-Haiku",
    "E-GLM",
    "E-Luna",
    "T-Haiku",
    "T-GLM",
    "T-Luna",
  ],
  axisMin: 0,
  axisMax: 120000,
  ticks: [0, 30000, 60000, 90000, 120000],
  series: [
    {
      label: "Baseline",
      data: [
        [14264, 14264, 14264, 14264, 14264],
        [11755, 11703, 11758, 11755, 11755],
        [11162, 11139, 11206, 11067, 11067],
        [64695, 64645, 64731, 64657],
        [58892, 41771, 54121, 34727, 54205],
        [39957, 24393, 24374, 24381, 24365],
        [22316, 22268, 22268, 22268, 22268],
        [18017, 18017, 18017, 18017, 18017],
        [16999, 16999, 16999, 16999, 16999],
      ],
      stats: [
        { mean: 14264, ci95: [14264, 14264] },
        { mean: 11745.2, ci95: [11723.8, 11756.8] },
        { mean: 11128.2, ci95: [11081.4, 11175] },
        { mean: 64682, ci95: [64651, 64713] },
        { mean: 48743.2, ci95: [40362.2, 56063] },
        { mean: 27494, ci95: [24371.8, 33726.6] },
        { mean: 22277.6, ci95: [22268, 22296.8] },
        { mean: 18017, ci95: [18017, 18017] },
        { mean: 16999, ci95: [16999, 16999] },
      ],
    },
    {
      label: "Rerun",
      data: [
        [14185, 14185, 14181, 14185, 14219],
        [11704, 11704, 11704, 11704, 11701],
        [11259, 11259, 11251, 11259, 11259],
        [113806, 65882, 65892, 81244, 81377],
        [35375, 68403, 35333, 48710, 55111],
        [25037, 25018, 34779, 41066, 25031],
        [22657, 22169, 22169, 22667, 22178],
        [18027, 18027, 18027, 18027, 18027],
        [11510, 17659, 17670, 17659, 17659],
      ],
      stats: [
        { mean: 14191, ci95: [14182.6, 14205.4] },
        { mean: 11703.4, ci95: [11702.2, 11704] },
        { mean: 11257.4, ci95: [11254.2, 11259] },
        { mean: 81640.2, ci95: [68958.4, 97735.4] },
        { mean: 48586.4, ci95: [38025.2, 59147.6] },
        { mean: 30186.2, ci95: [25027, 36599] },
        { mean: 22368, ci95: [22170.8, 22565.4] },
        { mean: 18027, ci95: [18027, 18027] },
        { mean: 16431.4, ci95: [13969.6, 17665.6] },
      ],
    },
  ],
  comparisons: [
    { label: "discover", categories: ["D-Haiku", "D-Luna"] },
    { label: "extract", categories: ["E-Haiku", "E-Luna"] },
    { label: "traverse", categories: ["T-Haiku", "T-Luna"] },
  ],
  rawLabel: "individual runs (89 passing)",
  caption:
    "Figure 2: Total tokens per run by task (D discover, E extract, T traverse) and model; dots are the 89 rubric-passing runs, lines join each batch's mean with bootstrap 95% confidence intervals (CIs). The one failed baseline run (extract, Haiku, 80,292 tokens) is excluded, as in the archived medians. Discover and traverse overlap; on extract, the Haiku and Luna means rise and the GLM mean holds flat.",
};

export default chart;
