<div align="center">

# WebMCP Description Benchmarks

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache-2.0-blue.svg)](LICENSE)
[![Result](https://img.shields.io/badge/result-45%2F45_rubric_passes-brightgreen)](results/rerun.md)

</div>

Do in-browser WebMCP tool descriptions, progressive disclosure, and response
caps let real agent runtimes complete content tasks, and at what token cost?

Supplementary data repository for a behavioral evaluation of the four WebMCP
tools exposed by [clouatre.ca](https://github.com/clouatre-labs/clouatre.ca)
(`search_posts`, `get_post_markdown`, `get_related_posts`,
`get_posts_by_concept`). Three tasks (`discover`, `extract`, `traverse`) x
three models x five iterations were run with a Playwright-driven Chromium,
the real in-browser `document.modelContext` registration, and the goose agent
runtime across three site configurations (baseline, delta, rerun). Companion
blog post: [WebMCP beyond checkout](https://github.com/clouatre-labs/clouatre.ca/pull/1676).

```mermaid
flowchart TD
    dist["Built site in dist/"] --> chromium["Playwright Chromium\nWebMCP flags"]
    chromium --> modelCtx["document.modelContext\ntool registration"]
    modelCtx --> bridge["Local streamable-HTTP\nMCP bridge"]
    bridge --> goose["Goose agent runtime\none run per iteration"]
    goose --> payloads["Bridge-recorded\npayloads"]
    goose --> response["Goose final\nresponse"]
    payloads --> rubric["Deterministic rubric"]
    response --> rubric
    rubric --> runs["Run JSONs\n3 batches x 45"]
    runs --> summary["Summarizer\nsummary.md"]
    runs --> figures["Figures"]
```

*Figure 1: The evaluation harness pipeline. Each run serves the built site,
drives goose through the real in-browser tool registration, grades a
deterministic rubric, and writes one run JSON; the summarizer and the
matplotlib figures are derived from those JSONs.*

## Status

**45/45 rubric passes with zero infra errors in the latest batch; token
medians within 4% of baseline in 7 of 9 cells.** Progressive disclosure plus
response caps held task completion without reducing tokens; the earlier
pagination change, not the caps, is what bounded payloads (6,764 tokens in one
unbounded `get_post_markdown` response to pages of at most 1,422 against a
2,000-token budget). Full findings: [results/rerun.md](results/rerun.md).

| Batch | Site config | Rubric passes | Headline |
| --- | --- | --- | --- |
| [baseline](results/baseline.md) | post-pagination (#1632) | 44/45 | prompt-ambiguity failures fixed, 15/15 traverse |
| [delta](results/delta.md) | + caps and progressive disclosure (#1653/#1651) | 45/45 | caps induce a traverse retry loop for 2 of 3 models |
| [rerun](results/rerun.md) | + ordering fix (#1659) | 45/45 | retry loop gone; tokens within 4% of baseline in 7/9 cells |

## Structure

- `scripts/webmcp-eval/harness.ts`: the behavioral eval harness. Serves the
  built site over localhost, launches Playwright Chromium with WebMCP feature
  flags, waits for per-page-kind tool registration, exposes the disclosed
  tools over a local streamable-HTTP MCP bridge, drives goose headless per
  run, and grades a deterministic rubric from bridge-recorded payloads plus
  the goose final response.
- `scripts/webmcp-eval/summarize.ts`: median/IQR summary per task-model cell
  from run JSONs.
- `scripts/webmcp-page-kind.ts`: vendored from clouatre.ca; the page-kind
  derivation the harness uses to know which tools a start page discloses.
- `scripts/audit-webmcp-payloads.ts`: point-in-time snapshot of the clouatre.ca
  payload budget audit (provenance for the payload JSON; site-coupled, not
  runnable here).
- `docs/audit/{baseline,delta,delta-rerun}/`: 135 run JSONs (3 batches x 45)
  plus machine-generated `summary.md` per batch.
- `docs/audit/2026-10-04-webmcp-payload.json`: payload token counts at three
  site commits (unbounded, paginated, capped), exact local BPE tokenizer.
- `docs/spike.md`: harness enablement findings (Chromium flags,
  `registerTool` semantics, goose per-run model selection and token usage).
- `results/`: the three written audit reports (baseline, delta, rerun).
- `data/charts/`: chart source data for the companion post's figures.
- `figures/`: matplotlib figures (Python scripts alongside their rendered
  PNGs, deterministic, regenerated from the committed run JSONs).

## Figures

Rerun on the fixed site held median tokens near baseline while keeping every
payload under budget. Scripts in `figures/` regenerate the PNGs with
`uv run --with matplotlib python figures/<script>.py`.

![Median total tokens per task-model cell, baseline versus rerun grouped bars](figures/fig1-token-medians.png)

*Figure 2: Median total tokens per task-model cell (3 tasks x 3 models), baseline versus rerun. Rerun medians landed within 4% of baseline in 7 of 9 cells; the exceptions are extract, where Haiku's median rose 26% and GLM's fell 10%.*

![WebMCP payload tokens at three site commits versus the 2,000 and 600 token budgets](figures/fig2-payload-budget.png)

*Figure 3: WebMCP payload tokens at three site commits against the budgets. The unbounded `get_post_markdown` response fell from 6,764 tokens to pages of at most 1,422 against the 2,000-token budget, and every discovery tool response stays under the 600-token budget.*

## Running the harness

Requires bun, Playwright 1.63+, goose 1.53+, and a built site in `dist/`
(secure context required by WebMCP). See
[METHODOLOGY.md](METHODOLOGY.md) for the full protocol.

```sh
bun run scripts/webmcp-eval/harness.ts \
  --output-dir docs/audit/<name> --iterations 5
bun run scripts/webmcp-eval/summarize.ts \
  --run-dir docs/audit/<name> --out docs/audit/<name>/summary.md
```

## Provenance

The experiment was designed and first executed inside
[`clouatre-labs/clouatre.ca`](https://github.com/clouatre-labs/clouatre.ca)
against epic [#1626](https://github.com/clouatre-labs/clouatre.ca/issues/1626);
artifacts moved here at clouatre.ca `426f5ec` (2026-10-04). The payload
budget audit script remains a live CI gate in clouatre.ca; its snapshot here
is for reproducibility of the archived JSON only.

## License

Apache-2.0.
