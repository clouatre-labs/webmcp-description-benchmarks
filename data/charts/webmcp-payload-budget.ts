// SPDX-License-Identifier: Apache-2.0
// get_post_markdown payload for the audit's fixed post
// (ai-sdlc-governance-stack), tokens = countTokens(JSON.stringify(output))
// with gpt-tokenizer 4.0.0 (o200k_base). Unbounded at 1699cd8 (one
// response), largest page at 8629e9d (before #1653) and at 289d94d (HEAD),
// against the 2,000-token page budget.
// Source: docs/audit/audit-data-2026-10-04-webmcp-payload.json

import type { BarChart } from "./types";

const chart: BarChart = {
  id: "webmcp-payload-budget",
  type: "bar",
  title: "Paging cut one 6,764-token response to pages of 1,422 or less",
  source: "clouatre.ca docs/audit/audit-data-2026-10-04-webmcp-payload.json",
  unit: " tokens",
  series: [
    { label: "Unbounded full post", value: 6764 },
    { label: "Max page before #1653", value: 1415 },
    { label: "Max page now", value: 1422 },
    { label: "Page budget", value: 2000 },
  ],
  annotation:
    "Audited post: ai-sdlc-governance-stack, 6 pages at both paged commits",
  caption:
    "Figure 3: get_post_markdown payload for the audited post. Before pagination, one call returned the whole post; after it, the largest of six pages stays at 71% of the 2,000-token budget, before and after the #1653 caps.",
};

export default chart;
