# Methodology

Behavioral evaluation of the WebMCP tool surface exposed by
[clouatre.ca](https://github.com/clouatre-labs/clouatre.ca). This document is
the protocol for the batches archived in `docs/audit/`; the enablement spike
that established the harness mechanics is in [`docs/spike.md`](docs/spike.md),
and the three written reports are in [`results/`](results/).

## Design

- 3 tasks x 3 models x 5 iterations = 45 runs per batch.
- Tasks:
  - `discover`: find a post matching a natural-language description via
    `search_posts` (start page `/`).
  - `extract`: retrieve a verbatim claim from a specific post via paginated
    `get_post_markdown` (start page `/posts/ai-sdlc-governance-stack/`).
  - `traverse`: two-hop navigation via `get_related_posts` then
    `get_posts_by_concept` with the `governance-oversight` concept
    (start page `/posts/ai-approval-gates/`).
- Models: `anthropic/claude-haiku-4-5`, `zai/glm-5.3-flash`,
  `openrouter/openai/gpt-6-luna`.

The harness declares per-task `startPath` and `requires`: each task runs on a
page whose disclosed tool registry satisfies it, measuring the shipped
progressive-disclosure behavior rather than a four-tools-everywhere surface.

## Execution environment

- The site is served from `dist/` over localhost (secure context required by
  WebMCP); Chromium is launched with
  `--enable-features=WebMCP --enable-blink-features=WebMCP`.
- The in-browser tools are exposed to goose through a local streamable-HTTP
  MCP bridge speaking MCP 2026-07-28 sessionless discovery only.
- goose 1.53.0 headless, one `goose run` per iteration with
  `GOOSE_TEMPERATURE=0.3`, `GOOSE_SEED=42`, `--max-turns 12`.
- Playwright 1.63.0 / Chromium 153.0.8010.12; Bun 1.4.0, macOS arm64.
- Fixed dates: baseline and delta captured 2026-10-04; rerun on
  clouatre.ca `origin/main` at `289d94d`.

## Grading and accounting

- Each run is graded by a deterministic rubric over bridge-recorded tool
  payloads plus the goose final response. No retries; genuine rubric FAILs
  are kept as data. Only infra failures (browser, flags, auth) invalidate a
  run; none occurred in any archived batch.
- Token counts come from provider usage fields (`metadata.total_tokens` in
  goose JSON output), applied uniformly across models.
- Summaries report median and IQR per task-model cell; efficiency stats
  exclude failed-rubric and infra-error runs.

## Batch history and comparability

| Batch | clouatre.ca state | Note |
| --- | --- | --- |
| baseline | post-#1632 pagination | one rubric FAIL (extract, claude-haiku-4-5, iter 1) |
| delta | + #1653 caps, #1651 progressive disclosure | harness adapted to per-task registries |
| delta-rerun | + #1659 tool-response ordering, #1660 run context | supersedes the delta's traverse findings |

Cross-batch comparison carries a harness-context confound: baseline runs
executed on `/` with all four tools disclosed, delta and rerun runs on
per-task pages with filtered registries. Commercial APIs are not bitwise
deterministic even at temperature 0 with seeds; n = 5 per cell supports
directional reads only.

## Payload audit

`docs/audit/2026-10-04-webmcp-payload.json` archives tool payload token
counts at three site commits (unbounded, paginated, capped), counted as
`countTokens(JSON.stringify(toolOutput))` with gpt-tokenizer 4.0.0
(o200k_base, exact, local), the method of `scripts/audit-webmcp-payloads.ts`
(snapshot archived in `scripts/`). Each point was built with `bun run build`
in a git worktree at the listed clouatre.ca commit. The live budget gate
(2,000 tokens per `get_post_markdown` page, 600 for discovery tools) runs in
clouatre.ca CI.
