# Data Dictionary

This document defines the schema and field meanings for all data files
in this repository.

## Overview

The dataset documents a behavioral evaluation of in-browser WebMCP tool
surfaces. Data is organized into three audit batches under `docs/audit/`:

| Directory | Contents | Runs |
|-----------|----------|------|
| `docs/audit/baseline/` | Unbounded tool descriptions | 45 |
| `docs/audit/delta/` | After tool description improvements | 45 |
| `docs/audit/delta-rerun/` | Rerun after payload pagination changes | 45 |

Each batch contains:

- `runs/`: 45 run JSON files, named `<task>__<model>__<iteration>.json`
- `summary.md`: Aggregated markdown summary (pass rates, token and
  wall-clock medians and IQRs per task-model cell)

Additionally, `docs/audit/2026-10-04-webmcp-payload.json` records the
tool payload token audit that motivated the pagination changes.

## Naming Convention

Run files follow the pattern `<task>__<model>__<iteration>.json`
(double underscore separators):

- `task`: one of `discover`, `extract`, `traverse`
- `model`: model identifier with slashes replaced by hyphens
  (for example, `claude-haiku-4-5`, `gpt-6-luna`, `glm-5.3-flash`)
- `iteration`: 1 through 5

Example: `extract__claude-haiku-4-5__3.json`. `scripts/validate-data.ts`
enforces this pattern, the task set, the iteration range, and exactly
three models per batch.

## Run Record Schema

Each run JSON file is one object. Field types use JSON terms.

### Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `task` | string | Evaluated task: `discover`, `extract`, or `traverse` |
| `provider` | string | LLM provider identifier (for example, `anthropic`, `openrouter/openai`, `zai`) |
| `model` | string | Model identifier (for example, `claude-haiku-4-5`) |
| `iteration` | number | Run index for this task-model cell, 1 to 5 |
| `rubric` | object | Behavioral rubric verdict for this run |
| `rubric.pass` | boolean | `true` if the run satisfied the task rubric |
| `rubric.detail` | string | Rubric checklist evaluation, naming each criterion and its boolean outcome |
| `tokens` | object | Token usage reported by the provider; subfields may be `null` when the provider omits them |
| `tokens.total` | number or null | Total tokens (input plus output) |
| `tokens.input` | number or null | Prompt tokens |
| `tokens.output` | number or null | Completion tokens |
| `tokens.cacheRead` | number or null | Tokens served from the prompt cache |
| `tokens.cacheWrite` | number or null | Tokens written to the prompt cache |
| `costUsd` | number or null | Estimated run cost in USD from provider pricing |
| `wallClockMs` | number | End-to-end wall-clock duration in milliseconds |
| `gooseExitCode` | number | Exit code of the goose CLI process; `0` on success |
| `gooseStderr` | string | Captured stderr from the goose CLI process; empty string when silent |
| `infraError` | string or null | Infrastructure failure description, or `null` when the run completed; `infraError` runs are excluded from efficiency statistics |
| `recordedAt` | string | ISO 8601 UTC timestamp when the run finished recording |
| `toolCalls` | array | Ordered list of WebMCP tool invocations made during the run |
| `finalResponse` | string | Verbatim final assistant response text |
| `startPath` | string | Site path the browser session started at (delta-rerun only) |
| `pageKind` | string | Page kind of the start path, for example `home` (delta-rerun only) |
| `servedTools` | array of string | Tool names the page advertised via `document.modelContext` (delta-rerun only) |

### toolCalls entries

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Tool name as advertised on the page (for example, `search_posts`, `get_post_markdown`) |
| `input` | object | Tool arguments exactly as the model supplied them (for example, `{"query": "...", "limit": 10}`) |
| `result` | string | Verbatim tool result serialized to a JSON string; contains the raw payload the model received, including HTML fragments such as search highlight markup |
| `ms` | number | Tool call duration in milliseconds |

## Batch Differences

The three batches share the core schema. `baseline` and `delta` contain
only the core fields; `delta-rerun` additionally records the session
context fields `startPath`, `pageKind`, and `servedTools`. The presence
of `servedTools` makes it possible to verify which tool descriptions the
model actually saw in the rerun condition.

## Batch Summaries

Each `docs/audit/<batch>/summary.md` is a generated markdown file with:

- Header line: run count, rubric pass count, infra error count, and a
  note that efficiency statistics exclude failed-rubric and infra-error
  runs
- One `## Task: <task>` section per task with a table of model, pass
  rate, total tokens with IQR, tool call count with IQR, and wall clock
  with IQR
- A `Failed rubrics` list naming each failing run by model and iteration
  with the failing rubric criteria

Summaries are regenerated with:

```bash
bun run scripts/webmcp-eval/summarize.ts --run-dir docs/audit/<batch>/runs --out docs/audit/<batch>/summary.md
```

## Payload Audit File

`docs/audit/2026-10-04-webmcp-payload.json` records per-post token
counts of the `get_post_markdown` tool payload at successive site
commits, quantifying the unbounded payload problem the pagination fix
addressed.

| Field | Type | Description |
|-------|------|-------------|
| `generated` | string | Date the audit was produced (YYYY-MM-DD) |
| `tokenizer` | string | Tokenizer name, version, encoding, and mode |
| `method` | string | How tokens were counted: `countTokens(JSON.stringify(toolOutput))`, matching `scripts/audit-webmcp-payloads.ts`; each point was built with `bun run build` in a git worktree at the listed commit |
| `budgets` | object | Payload token budgets |
| `budgets.get_post_markdown_page` | number | Per-page token budget for `get_post_markdown` (2000) |
| `budgets.discovery_tools` | number | Total token budget for discovery tools (600) |
| `points` | array | One entry per audited site commit |
| `points[].label` | string | Condition label, for example `unbounded`, `paginated` |
| `points[].commit` | string | Short commit hash of the audited site state |
| `points[].description` | string | What changed at this commit and how the point was produced |
| `points[].audited_post` | string | Slug of the post used as the reference payload |
| `points[].audited_post_full_tokens` | number | Tokens for the audited post under the audit method |
| `points[].audited_post_full_tokens_raw_text` | number | Tokens for the same post's plain text, excluding markup |
| `points[].largest_post` | object | Slug and token count of the largest post at this commit |
| `points[].posts_counted` | number | Number of posts counted |
| `points[].get_post_markdown_full_by_post` | array | Slug and token count per post, descending by tokens |

## Consistency Checks

`bun scripts/validate-data.ts` enforces: file counts and naming per
batch, run JSON shape, presence of `summary.md` per batch, parseability
of the payload audit file, and that computed rubric pass counts match
the constants claimed in `results/` (baseline 44, delta 45,
delta-rerun 45).
