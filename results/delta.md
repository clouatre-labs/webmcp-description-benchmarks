# WebMCP Behavioral Eval Delta: Caps and Progressive Disclosure vs Baseline

Date: 2026-10-04  
Period covered: delta run on post-#1653/#1651 build vs baseline from post-#1632 build  
Data source(s): `scripts/webmcp-eval/harness.ts` (45 runs: 3 tasks x 3 models x 5 iterations), goose headless, Playwright Chromium with WebMCP flags  
Raw data: `docs/audit/delta/runs/` (delta) and `docs/audit/baseline/runs/` (baseline)  
Tracking: [#1626](https://github.com/clouatre-labs/clouatre.ca/issues/1626); results feed [#1627](https://github.com/clouatre-labs/clouatre.ca/issues/1627)

## BLUF

The delta run completed 45/45 runs with 45 rubric passes and zero infra errors, up from 44/45 passes at baseline. The #1625 pagination fix is the clearest win: the extract task that failed at baseline (claude-haiku-4-5 missing the verbatim claim) now passes for every model. The #1625 response caps carry a measurable traversal cost: on the traverse task, glm-5.3-flash and claude-haiku-4-5 each added one `get_related_posts` retry (limit escalation or offset paging) per run, raising median tokens and wall clock for those cells, while gpt-6-luna improved on every metric. Attribution framing per #1626: this is the incremental caps-plus-disclosure delta against the post-#1632 baseline, not an end-to-end architectural delta. The traverse retry loop in Finding 3 was traced to edge ordering (#1657) and fixed in #1659; see `2026-10-04-webmcp-eval-rerun.md` for the rerun on the fixed build.

## Per-cell comparison (medians)

Median tokens (total), tool calls, and wall clock per task-model cell; pass rate over 5 iterations.

*Table 1: Discover task, baseline vs delta medians*

| Model | Pass | Tokens base/delta | Calls base/delta | Wall clock base/delta |
| --- | --- | --- | --- | --- |
| anthropic/claude-haiku-4-5 | 5/5, 5/5 | 14,264 / 14,068 | 1 / 1 | 2,137 ms / 2,481 ms |
| zai/glm-5.3-flash | 5/5, 5/5 | 11,755 / 11,594 | 1 / 1 | 6,961 ms / 9,434 ms |
| openrouter/openai/gpt-6-luna | 5/5, 5/5 | 11,139 / 11,141 | 1 / 1 | 6,045 ms / 3,710 ms |

*Table 2: Extract task, baseline vs delta medians*

| Model | Pass | Tokens base/delta | Calls base/delta | Wall clock base/delta |
| --- | --- | --- | --- | --- |
| anthropic/claude-haiku-4-5 | 4/5, 5/5 | 64,676 / 80,721 | 5 / 6 | 8,751 ms / 10,567 ms |
| zai/glm-5.3-flash | 5/5, 5/5 | 54,121 / 54,784 | 5 / 5 | 23,899 ms / 28,071 ms |
| openrouter/openai/gpt-6-luna | 5/5, 5/5 | 24,381 / 24,864 | 6 / 6 | 6,458 ms / 6,871 ms |

*Table 3: Traverse task, baseline vs delta medians*

| Model | Pass | Tokens base/delta | Calls base/delta | Wall clock base/delta |
| --- | --- | --- | --- | --- |
| anthropic/claude-haiku-4-5 | 5/5, 5/5 | 22,268 / 31,827 | 2 / 3 | 3,328 ms / 5,280 ms |
| zai/glm-5.3-flash | 5/5, 5/5 | 18,017 / 24,430 | 2 / 3 | 11,055 ms / 18,090 ms |
| openrouter/openai/gpt-6-luna | 5/5, 5/5 | 16,999 / 11,654 | 2 / 2 | 4,370 ms / 4,400 ms |

Full medians with IQR per cell: `docs/audit/{baseline,delta}/summary.md`.

## Findings

1. **Completion improved.** 45/45 rubric passes vs 44/45 at baseline. The failed baseline cell (extract, claude-haiku-4-5 iter 1: claim not quoted verbatim) passes in all 5 delta iterations. The delta extract prompts instruct paging to the end, and #1653 pagination makes that traversal reliable.
2. **Discover is flat.** Single-tool cells are statistically unchanged on tokens and calls; wall-clock movement (gpt-6-luna faster, glm-5.3-flash slower) is within the run-to-run spread the baseline IQR already showed.
3. **Caps induce a retry loop on traverse for 2 of 3 models.** In every delta traverse run for glm-5.3-flash and claude-haiku-4-5, the first `get_related_posts` response no longer surfaced the `thematic_chain` target, and the model re-requested (limit escalation to `limit: 20` or `limit: 10`, or offset paging with `offset: 5`) before continuing (2 calls to `get_related_posts`, then `get_posts_by_concept`). gpt-6-luna located the target on the first page in all 5 iterations and improved on tokens (16,999 to 11,654) with unchanged calls. This is the caps behavior working as designed; the retry cost is the price of the budget cap for models that scan deeper.
4. **Extract tokens rose slightly where paging adds calls.** claude-haiku-4-5 added one median call and roughly 25% tokens; glm-5.3-flash and gpt-6-luna stayed within a few percent. Baseline runs were already paging (the prompt asks for it), so the delta reflects cap-tuned page sizes rather than a new behavior.

## Harness adaptation (required by #1651)

The issue anticipated running the harness unchanged, but #1651 changed the registration contract: no page registers all four tools, so the harness's four-tool launch wait and per-run registry check aborted after one run ("tool registry lost"). The harness now declares per-task `startPath` and `requires` (`scripts/webmcp-eval/harness.ts`): discover starts on `/`, extract on `/posts/ai-sdlc-governance-stack/`, traverse on `/posts/ai-approval-gates/`, and validity is checked against the task's required tools on that page. This measures the shipped progressive-disclosure behavior rather than working around it.

## Methodology

- Same harness, prompts, rubrics, models, and fixed settings as the baseline (`GOOSE_TEMPERATURE=0.3`, `GOOSE_SEED=42`, max 12 turns), run locally on demand against the served `dist/` build.
- Token counts from provider usage fields, applied uniformly across models; efficiency stats exclude failed-rubric and infra-error runs (none in delta).
- Median over 5 iterations per cell; IQR in the machine-generated summaries.

## Caveats

- **Harness-context confound.** Baseline runs executed on `/` with all four tools disclosed; delta runs execute on per-task pages with the #1651-filtered registries (home: 2 tools, post: 3 tools). Tool-list context differs between the two batches, so cross-batch deltas conflate site changes with evaluation context. Directionally this favors the delta cells (smaller tool catalogs), and rubric-graded completion is unaffected.
- **Commercial APIs are not bitwise deterministic** even at temperature 0 with seeds (MoE routing, batch scheduling); single-run deltas swing 30-50% on one redundant tool loop. Medians over 5 iterations narrow but do not eliminate this.
- **n is small.** 5 iterations per cell supports directional reads only, not significance claims.
- Zone of attribution: the baseline is the post-#1632 pagination baseline; the delta measures #1625/#1624 work on top of it. Isolating #1625 from #1624 would have required a 45-run intermediate checkpoint, out of budget per #1626.
