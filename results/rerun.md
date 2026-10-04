# WebMCP Behavioral Eval Rerun and Payload Before/After

Date: 2026-10-04  
Period covered: delta rerun on `origin/main` at `289d94d` (after #1659 ordering fix and #1660 run context) vs baseline (post-#1632) and original delta (post-#1653/#1651); payload audit at three commits  
Data source(s): `scripts/webmcp-eval/harness.ts` (45 runs: 3 tasks x 3 models x 5 iterations), goose 1.53.0 headless, Playwright Chromium with WebMCP flags; `scripts/audit-webmcp-payloads.ts` with gpt-tokenizer 4.0.0  
Raw data: `docs/audit/delta-rerun/runs/` (rerun), `docs/audit/baseline/runs/`, `docs/audit/delta/runs/`; `docs/audit/2026-10-04-webmcp-payload.json` (payload)  
Tracking: [#1627](https://github.com/clouatre-labs/clouatre.ca/issues/1627) prerequisites 1 and 2; supersedes the traverse findings in `2026-10-04-webmcp-eval-delta.md`

## BLUF

The rerun completed 45/45 runs with 45 rubric passes and zero infra errors, matching the original delta and up from 44/45 at baseline. The #1659 ordering fix removed the traverse retry loop: every traverse cell is back to 2 median tool calls, and median tokens sit within 4% of baseline for all three models (claude-haiku-4-5 went from 31,827 in the original delta to 22,178). Token medians on discover and traverse are flat against baseline; extract is mixed (+25.6%, -10.0%, +2.7%). On this site, disclosure plus response caps held completion without reducing tokens. Payloads were bounded earlier: #1632 pagination, already in place for the baseline, took the audited post from 6,764 tokens in one unbounded response to pages of at most 1,415 tokens, and the #1653 caps held them at 1,422 against a 2,000-token budget.

## Per-cell comparison (medians)

Median tokens (total) and tool calls per task-model cell. All rerun cells pass 5/5.

*Table 1: Median tokens, baseline vs original delta vs rerun*

| Task | Model | Baseline | Delta | Rerun | Rerun vs baseline |
| --- | --- | --- | --- | --- | --- |
| discover | anthropic/claude-haiku-4-5 | 14,264 | 14,068 | 14,185 | -0.6% |
| discover | zai/glm-5.3-flash | 11,755 | 11,594 | 11,704 | -0.4% |
| discover | openrouter/openai/gpt-6-luna | 11,139 | 11,141 | 11,259 | +1.1% |
| extract | anthropic/claude-haiku-4-5 | 64,676 | 80,721 | 81,244 | +25.6% |
| extract | zai/glm-5.3-flash | 54,121 | 54,784 | 48,710 | -10.0% |
| extract | openrouter/openai/gpt-6-luna | 24,381 | 24,864 | 25,037 | +2.7% |
| traverse | anthropic/claude-haiku-4-5 | 22,268 | 31,827 | 22,178 | -0.4% |
| traverse | zai/glm-5.3-flash | 18,017 | 24,430 | 18,027 | +0.1% |
| traverse | openrouter/openai/gpt-6-luna | 16,999 | 11,654 | 17,659 | +3.9% |

*Table 2: Median tool calls, baseline vs original delta vs rerun*

| Task | haiku-4-5 | glm-5.3-flash | gpt-6-luna |
| --- | --- | --- | --- |
| discover | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |
| extract | 5 / 6 / 6 | 5 / 5 / 5 | 6 / 6 / 6 |
| traverse | 2 / 3 / 2 | 2 / 3 / 2 | 2 / 2 / 2 |

Full medians with IQR and wall clock per cell: `docs/audit/delta-rerun/summary.md`.

## Payload before/after

`get_post_markdown` output for the audit's fixed post (`ai-sdlc-governance-stack`), counted as `countTokens(JSON.stringify(output))`.

*Table 3: Payload audit at three commits*

| Point | Commit | get_post_markdown | search_posts | get_related_posts | get_posts_by_concept |
| --- | --- | --- | --- | --- | --- |
| Unbounded (before #1632) | `1699cd8` | 6,764 (one response) | n/a | n/a | n/a |
| Paginated (before #1653) | `8629e9d` | 6 pages: 1,245 / 1,415 / 1,373 / 1,274 / 1,161 / 441 | 505 | 253 | 462 |
| HEAD | `289d94d` | 6 pages: 1,252 / 1,422 / 1,380 / 1,281 / 1,166 / 446 | 513 | 338 | 469 |

Budgets: 2,000 tokens per `get_post_markdown` page; 600 tokens for the three discovery tools. Every audited payload at `8629e9d` and HEAD passes. At `1699cd8` the largest post was `mcp-tool-docs` at 7,493 tokens in one response; per-post counts for all 18 posts are in the JSON.

## Findings

1. **The ordering fix closed the traverse regression.** The original delta's extra `get_related_posts` call on traverse (claude-haiku-4-5 and glm-5.3-flash) came from file-order windowing that pushed the `thematic_chain` edge off the first page (#1657). After #1659 sorts edges by weight before windowing, all 15 traverse runs finish in 2 calls.
2. **Tokens did not fall.** Seven of nine cells are within 4% of baseline. Extract is the only task that moves, in both directions: claude-haiku-4-5 pages further (IQR 65,892-81,377), glm-5.3-flash spends less. No cell approaches a 42% reduction.
3. **Completion holds at 45/45.** The baseline extract failure (claude-haiku-4-5, claim not quoted verbatim) stays fixed across both delta batches.
4. **Pagination bounds the worst case, before either batch.** The unbounded tool returned the whole post in one response (6,764 tokens for the audited post, 7,493 for the largest). Paginated pages peak at 1,422 tokens at HEAD, 71% of the page budget.

## Methodology

- Same harness, prompts, rubrics, models, and fixed settings as the baseline and original delta (`GOOSE_TEMPERATURE=0.3`, `GOOSE_SEED=42`, max 12 turns), run locally against the served `dist/` build of `289d94d`.
- Each run JSON records `startPath`, `pageKind`, and `servedTools` (#1660): discover on `/` (home: `get_posts_by_concept`, `search_posts`); extract on `/posts/ai-sdlc-governance-stack/` and traverse on `/posts/ai-approval-gates/` (post: `get_post_markdown`, `get_posts_by_concept`, `get_related_posts`).
- Token counts from provider usage fields; efficiency stats exclude failed-rubric and infra-error runs (none in the rerun). Median over 5 iterations per cell.
- Payload points were built with `bun run build` in git worktrees. `1699cd8` predates `scripts/audit-webmcp-payloads.ts` (added in #1632), and its `get_post_markdown` returned the raw `/posts/{slug}.md` text, so each built `dist/posts/*.md` file was counted with the audit's method. `8629e9d` and HEAD use `bun run audit:webmcp` output unchanged.

## Caveats

- **Harness-context confound.** Baseline runs executed on `/` with all four tools registered; the original delta and the rerun execute on per-task pages with the #1651-filtered registries (2 or 3 tools). Cross-batch deltas mix site changes with evaluation context. Directionally this favors the delta batches.
- **Payload method differs at the first point.** The unbounded figure applies the audit tokenizer to the built Markdown instead of running the audit script, which did not exist yet. Raw text without JSON escaping counts 6,411 tokens for the audited post. The issue's earlier estimate of about 6.0k is superseded by these measured values.
- **Commercial APIs are not bitwise deterministic** even with fixed temperature and seed; single runs swing 30-50% on one redundant tool loop. Medians over 5 iterations narrow but do not remove this.
- **n is small.** 5 iterations per cell supports directional reads only, not significance claims.
- `search_posts` payloads use a fixture built from knowledge-graph metadata, because Pagefind runs only in the browser; the count is an upper bound on metadata cost.
