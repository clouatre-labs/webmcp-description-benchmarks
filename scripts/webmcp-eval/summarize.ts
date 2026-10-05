/**
 * Summarize WebMCP behavioral eval runs (issue #1626).
 *
 * Reads run JSON files produced by harness.ts and prints a markdown summary
 * with median and IQR per task-model cell. Runs that failed the rubric or
 * hit an infra error are excluded from efficiency stats and reported
 * separately.
 *
 * Usage:
 *   bun run scripts/webmcp-eval/summarize.ts --run-dir <dir> [--out <file>]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface RunRecord {
  task: string;
  provider: string;
  model: string;
  iteration: number;
  rubric: { pass: boolean; detail: string };
  tokens: {
    total: number | null;
    input: number | null;
    output: number | null;
  };
  costUsd: number | null;
  wallClockMs: number;
  infraError: string | null;
  toolCalls: Array<{ name: string }>;
  finalResponse: string;
  // Optional evaluation-context fields (#1658); absent in older records.
  startPath?: string | null;
  pageKind?: string | null;
  servedTools?: string[] | null;
}

interface CellStats {
  n: number;
  passed: number;
  medianTokens: number | null;
  iqrTokens: [number, number] | null;
  medianToolCalls: number | null;
  iqrToolCalls: [number, number] | null;
  medianWallMs: number | null;
  iqrWallMs: [number, number] | null;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function iqr(xs: number[]): [number, number] {
  return [quantile(xs, 0.25), quantile(xs, 0.75)];
}

function fmt(m: number | null, i: [number, number] | null, unit = ""): string {
  if (m === null || i === null) return "n/a";
  return `${Math.round(m).toLocaleString("en-US")}${unit} (IQR ${Math.round(i[0]).toLocaleString("en-US")}-${Math.round(i[1]).toLocaleString("en-US")}${unit})`;
}

function main() {
  const argv = process.argv;
  const dirIdx = argv.indexOf("--run-dir");
  const outIdx = argv.indexOf("--out");
  if (dirIdx < 0) {
    console.error("usage: summarize.ts --run-dir <dir> [--out <file>]");
    process.exit(1);
  }
  const runDir = resolve(argv[dirIdx + 1]);
  const records: RunRecord[] = readdirSync(join(runDir, "runs"))
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        JSON.parse(readFileSync(join(runDir, "runs", f), "utf8")) as RunRecord,
    );
  if (records.length === 0) {
    console.error(`no run files under ${runDir}/runs`);
    process.exit(1);
  }

  const models = [...new Set(records.map((r) => `${r.provider}/${r.model}`))];
  const tasks = [...new Set(records.map((r) => r.task))];

  const lines: string[] = [];
  lines.push(`# WebMCP Behavioral Eval Summary (${runDir})`);
  lines.push("");
  lines.push(
    `${records.length} runs; ${records.filter((r) => r.rubric.pass).length} rubric passes; ` +
      `${records.filter((r) => r.infraError).length} infra errors. Efficiency stats exclude ` +
      "failed-rubric and infra-error runs.",
  );
  lines.push("");

  for (const task of tasks) {
    lines.push(`## Task: ${task}`);
    lines.push("");
    lines.push(
      "| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |",
    );
    lines.push("| --- | --- | --- | --- | --- |");
    for (const model of models) {
      const cell = records.filter(
        (r) => r.task === task && `${r.provider}/${r.model}` === model,
      );
      const ok = cell.filter((r) => r.rubric.pass && !r.infraError);
      const stat = (
        pick: (r: RunRecord) => number | null,
      ): { m: number | null; i: [number, number] | null } => {
        const xs = ok.map(pick).filter((x): x is number => x !== null);
        return xs.length ? { m: median(xs), i: iqr(xs) } : { m: null, i: null };
      };
      const tok = stat((r) => r.tokens.total);
      const calls = stat((r) => r.toolCalls.length);
      const wall = stat((r) => r.wallClockMs);
      lines.push(
        `| ${model} | ${ok.length}/${cell.length} | ` +
          `${fmt(tok.m, tok.i)} | ` +
          `${fmt(calls.m, calls.i)} | ` +
          `${fmt(wall.m, wall.i, " ms")} |`,
      );
    }
    lines.push("");
    // Served-tool context caveat (#1658): flag divergent tool registries
    // across a task's cells; skip silently when records lack the field.
    const withTools = records.filter(
      (r) => r.task === task && Array.isArray(r.servedTools),
    );
    if (withTools.length > 0) {
      const contexts = new Set(
        withTools.map((r) => [...r.servedTools].sort().join(",")),
      );
      if (contexts.size > 1) {
        lines.push(
          "> Caveat: served tool context diverges across runs in this task; " +
            "cross-cell deltas conflate site changes with evaluation context.",
        );
        for (const ctx of contexts) {
          const who = withTools
            .filter((r) => [...r.servedTools].sort().join(",") === ctx)
            .map((r) => `${r.provider}/${r.model}`);
          lines.push(`> - ${[...new Set(who)].join(", ")}: [${ctx}]`);
        }
        lines.push("");
      }
    }
    const failures = records.filter((r) => r.task === task && !r.rubric.pass);
    if (failures.length > 0) {
      lines.push("Failed rubrics (excluded from stats above):");
      lines.push("");
      for (const f of failures) {
        lines.push(
          `- ${f.model} iter ${f.iteration}: ${f.rubric.detail}` +
            (f.infraError ? `; infra: ${f.infraError}` : ""),
        );
      }
      lines.push("");
    }
  }

  const report = lines.join("\n");
  console.log(report);
  if (outIdx >= 0) {
    writeFileSync(argv[outIdx + 1], `${report}\n`);
    console.log(`\nwritten to ${argv[outIdx + 1]}`);
  }
}

// Run CLI only when executed directly, so tests can import pure functions.
if (process.argv[1]?.endsWith("summarize.ts")) main();
