# Spike: WebMCP Eval Enablement and Goose Multi-Model Findings

Spike date: 2026-10-03

Status: Complete. Local evidence gathered on the working tree at `a525995` via throwaway Playwright probes and goose CLI invocations; probes deleted after the spike. External claims cross-checked against Chrome for Developers documentation the same day.

## See Also

- [Stripe WebMCP checkout audit](https://github.com/clouatre-labs/clouatre.ca/blob/main/docs/audit/2026-10-04-stripe-webmcp-checkout-audit.md) -- source audit and tracking issues
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp) -- API reference and origin-trial guidance
- [Behavioral WebMCP eval epic #1626](https://github.com/clouatre-labs/clouatre.ca/issues/1626) -- consumer of these findings
- [Spike issue #1629](https://github.com/clouatre-labs/clouatre.ca/issues/1629) -- this spike

## Purpose

Execute spike #1629: determine whether the eval harness planned for #1626 can (a) launch Chromium with the WebMCP `document.modelContext` API exposed locally, (b) rely on defined duplicate-registration semantics, and (c) drive goose across vendors per-run with per-run token usage.

## Methodology

- Playwright 1.63.0 probes against the bundled Chromium (153.0.8010.12) and the installed Google Chrome channel (154.0.0.0), headless and headed, over a plain `data:` URL and a `python3 -m http.server` localhost page
- Feature-flag variants: `--enable-features=WebMCP`, `--enable-features=WebMCPForContent`, `--enable-features=WebMCP@1`, `--enable-blink-features=WebMCP`, `--enable-blink-features=WebMCPTesting`, and combinations
- Duplicate-registration probe used the real `document.modelContext.registerTool` API only; no stubs
- goose 1.53.0: `goose run --help` inspection plus three short `--no-session` invocations (default provider, Anthropic override, JSON output with stats)

## Findings

*Table 1: Spike findings*

| # | Question | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Can Playwright Chromium expose `document.modelContext`? | Yes. Launch with `--enable-features=WebMCP --enable-blink-features=WebMCP`. Works on Playwright Chromium 153.0.8010.12 and installed Chrome 154.0.0.0. Page must be a secure context (`localhost` or HTTPS); `data:` URLs stay `undefined`. Note: Chrome's documentation now lists only `chrome://flags/#enable-webmcp-testing` as the supported local enablement path; the command-line switches still work on flag-gated builds but are undocumented | Local probe, 2026-10-03 |
| 2 | Does production Chrome need an origin trial? | Yes. Stable Chrome gates WebMCP per origin from Chrome 149 (trial runs through Chrome 156, ending 2026-11-16); a page needs a served origin-trial token. Local development uses the `chrome://flags/#enable-webmcp-testing` flag instead | [Chrome for Developers, 2026](https://developer.chrome.com/docs/ai/webmcp) |
| 3 | Duplicate `registerTool` under the same key | Throws `InvalidStateError` with message "Duplicate tool name". Neither overwrite nor no-op | Local probe, 2026-10-03 |
| 4 | Registry query surface | `getTools()` exists (async; returns a Promise of an array of `{annotations, description, inputSchema, name, origin, title, window}`). No `unregisterTool`, no `hasTool`, no `tools` getter. `executeTool` requires a `RegisteredTool` value, not a name | Local probe, 2026-10-03 |
| 5 | Abort-signal semantics | Aborting the `AbortSignal` passed at registration removes the tool from the registry (`getTools()` empty after abort), and re-registration under the same name then succeeds. Since Chrome 153, aborting no longer cancels in-flight executions; teardown is decoupled from execution cancellation | Local probe, 2026-10-03 |
| 6 | Can goose select a model per run across vendors? | Yes. `goose run --provider <p> --model <m>` overrides `GOOSE_PROVIDER`/`GOOSE_MODEL` per run. Verified with the default provider and `--provider anthropic --model claude-haiku-4-5`, both returning normal completions | Local CLI runs, goose 1.53.0 |
| 7 | Where does per-run token usage surface? | `goose run --output-format json` emits `metadata.total_tokens`, `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_write_input_tokens`, and `cost_usd` per run. The `--stats` flag prints the same statistics after a text run | Local CLI run: 23,413 input / 76 output / $0.0032 for one haiku "say hi" |

## Implications for #1626

1. **Harness can use the real API.** Launch the eval browser with `--enable-features=WebMCP --enable-blink-features=WebMCP` and navigate to `http://localhost:4321/`; `document.modelContext.registerTool` is the genuine implementation, so evals exercise the production code path in `AgentReady.astro` without stubs.
2. **Idempotent re-registration is safe via abort.** Because duplicate registration throws `InvalidStateError` but aborting the registration signal removes the tool, the re-registration fix in #1630 (abort-then-register with fresh controllers) is valid on the real API; no `unregisterTool` call is needed. Evals should assert exactly one registration per tool name.
3. **No unregister path.** With `unregisterTool` absent, per-page tool teardown depends on registry lifecycle rather than explicit removal; progressive-disclosure work in #1624 cannot unregister tools on navigation and must plan accordingly.
4. **Origin trial is a production dependency.** Local evals work flag-only, but production visitors on stable Chrome need an origin-trial token served for `clouatre.ca` before mid-November 2026, when the current trial window closes. Re-check chromestatus before that date for renewal.
5. **`navigator.modelContext` is deprecated.** Chrome deprecates `navigator.modelContext` in Chrome 150 (getter moved to `document.modelContext` in the 2026-05-27 spec draft); the document-first feature-detect order is correct and the navigator fallback is legacy-only.
6. **Per-model evals are unblocked.** #1626's 3 models x 5 iterations matrix can run goose non-interactively with `--provider`/`--model` per run and read token deltas straight from the JSON `metadata` block; no session-file parsing or provider-specific accounting needed.
