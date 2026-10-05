/**
 * Composite scores and statistical comparison of rerun vs baseline runs.
 *
 * Parses run JSONs from docs/audit/{baseline,delta-rerun}/runs, computes a
 * per-run composite score (fraction of true rubric checks), and compares
 * the batches per task-model cell with an exact two-sided Mann-Whitney U
 * test on composite score and tokens.total, plus the rank-biserial effect
 * size and a seeded bootstrap 95% percentile CI for the median difference.
 *
 * Usage: bun run scripts/webmcp-eval/compare.ts
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface RunRecord {
  task: string;
  provider: string;
  model: string;
  iteration: number;
  rubric: { pass: boolean; detail: string };
  tokens: { total: number | null };
}

export interface MwuResult {
  u: number;
  p: number;
  r: number;
}

export interface Comparison {
  baselineMedian: number;
  rerunMedian: number;
  u: number;
  p: number;
  r: number;
  ci: [number, number];
}

/** Extract per-check booleans from a semicolon-separated rubric detail. */
export function parseChecks(detail: string): boolean[] {
  const checks: boolean[] = [];
  const re = /([^:;]+):\s*(true|false)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(detail)) !== null) {
    checks.push(m[2] === "true");
  }
  return checks;
}

/** Composite score: fraction of true checks; null when the run did not execute. */
export function compositeScore(detail: string): number | null {
  if (detail === "not run") return null;
  const checks = parseChecks(detail);
  if (checks.length === 0) return null;
  return checks.filter(Boolean).length / checks.length;
}

/** Deterministic PRNG (mulberry32) so bootstrap output is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two-sided exact Mann-Whitney U via permutation over all assignments (ties: midranks). */
export function mannWhitneyExact(x: number[], y: number[]): MwuResult {
  const n1 = x.length;
  const n2 = y.length;
  if (n1 === 0 || n2 === 0) throw new Error("empty group");
  if (n1 > 8 || n2 > 8) {
    throw new Error("exact test only supported for group sizes <= 8");
  }
  const pooled = [...x, ...y];
  const order = pooled.map((_, i) => i).sort((a, b) => pooled[a] - pooled[b]);
  const ranks = new Array<number>(pooled.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && pooled[order[j + 1]] === pooled[order[i]]) j++;
    const midrank = (i + j + 2) / 2; // average of 1-based ranks i+1..j+1
    for (let k = i; k <= j; k++) ranks[order[k]] = midrank;
    i = j + 1;
  }
  const rankSumX = x.map((_, idx) => ranks[idx]).reduce((a, b) => a + b, 0);
  const u1 = rankSumX - (n1 * (n1 + 1)) / 2;

  // Enumerate all C(n1+n2, n1) assignments of pooled ranks to group x.
  const idxs = pooled.map((_, k) => k);
  const dist: number[] = [];
  const combo = (start: number, chosen: number[]) => {
    if (chosen.length === n1) {
      const inX = new Set(chosen);
      const rs = ranks.filter((_, k) => inX.has(k)).reduce((a, b) => a + b, 0);
      dist.push(rs - (n1 * (n1 + 1)) / 2);
      return;
    }
    for (let k = start; k < idxs.length; k++) combo(k + 1, [...chosen, idxs[k]]);
  };
  combo(0, []);

  const ge = dist.filter((u) => u >= u1).length;
  const le = dist.filter((u) => u <= u1).length;
  let p = 2 * Math.min(ge / dist.length, le / dist.length);
  if (p > 1) p = 1;
  const r = 1 - (2 * u1) / (n1 * n2);
  return { u: u1, p, r };
}

/** Bootstrap 95% percentile CI for median(x) - median(y); deterministic given seed. */
export function bootstrapMedianDiffCI(
  x: number[],
  y: number[],
  resamples = 10000,
  seed = 42,
): [number, number] {
  const rng = mulberry32(seed);
  const diffs: number[] = [];
  const pick = (arr: number[]) => arr[Math.floor(rng() * arr.length)];
  for (let b = 0; b < resamples; b++) {
    const bx: number[] = [];
    const by: number[] = [];
    for (let k = 0; k < x.length; k++) bx.push(pick(x));
    for (let k = 0; k < y.length; k++) by.push(pick(y));
    diffs.push(median(bx) - median(by));
  }
  diffs.sort((a, b) => a - b);
  const lo = diffs[Math.floor(0.025 * (resamples - 1))];
  const hi = diffs[Math.floor(0.975 * (resamples - 1))];
  return [lo, hi];
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function loadRuns(dir: string): RunRecord[] {
  const runsDir = join(dir, "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(runsDir, f), "utf8")) as RunRecord);
}

function fmtP(p: number): string {
  return p < 0.001 ? p.toFixed(3) : p.toFixed(3);
}

function compareCells(
  baseline: number[],
  rerun: number[],
): Comparison {
  const { u, p, r } = mannWhitneyExact(baseline, rerun);
  return {
    baselineMedian: median(baseline),
    rerunMedian: median(rerun),
    u,
    p,
    r,
    ci: bootstrapMedianDiffCI(rerun, baseline),
  };
}

function fmtRow(cell: string, c: Comparison): string {
  return (
    `| ${cell} | ${c.baselineMedian.toFixed(3)} | ${c.rerunMedian.toFixed(3)} | ` +
    `${c.u} | ${fmtP(c.p)} | ${c.r.toFixed(3)} | ` +
    `[${c.ci[0].toFixed(3)}, ${c.ci[1].toFixed(3)}] |`
  );
}

function main() {
  const root = "docs/audit";
  const baselineRuns = loadRuns(join(root, "baseline"));
  const rerunRuns = loadRuns(join(root, "delta-rerun"));

  const cells = (runs: RunRecord[]) =>
    new Set(runs.map((r) => `${r.task} | ${r.provider}/${r.model}`));
  const cellKeys = [...new Set([...cells(baselineRuns), ...cells(rerunRuns)])].sort();

  const lines: string[] = [];
  lines.push("# Composite scores and statistical comparison (rerun vs baseline)");
  lines.push("");
  lines.push(
    "n = 5 per cell (baseline vs delta-rerun). Each metric per cell is tested " +
      "with an exact two-sided Mann-Whitney U test (permutation over all " +
      "C(10,5) = 252 assignments, midranks for ties) at alpha = 0.05. Effect " +
      "size is the rank-biserial r; the median-difference 95% CI is a " +
      "percentile bootstrap with 10,000 resamples (seed 42). No correction " +
      "for the nine parallel tests per metric is applied; results are " +
      "exploratory. Composite score is the fraction of true rubric checks per " +
      "run; runs with detail 'not run' are excluded. Token medians here " +
      "include all 45 runs per batch, including the one baseline rubric " +
      "FAIL, so they can differ from the pass-only medians in the batch " +
      "summary.md files.",
  );
  lines.push("");

  const compositeTable = (label: string, table: string[]) => {
    lines.push(`## ${label}`);
    lines.push("");
    lines.push(table);
    lines.push("");
  };

  const scoreHeader =
    "| Task | Model | Baseline median | Rerun median | U | p | r | Median diff 95% CI |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- |";
  const tokenHeader = scoreHeader;

  const scoreRows: string[] = [];
  const tokenRows: string[] = [];
  const passRows: string[] = [];
  const significant: string[] = [];

  for (const key of cellKeys) {
    const [task, model] = key.split(" | ");
    const b = baselineRuns.filter(
      (r) => r.task === task && `${r.provider}/${r.model}` === model,
    );
    const rr = rerunRuns.filter(
      (r) => r.task === task && `${r.provider}/${r.model}` === model,
    );
    const bScores = b
      .map((r) => compositeScore(r.rubric.detail))
      .filter((x): x is number => x !== null);
    const rScores = rr
      .map((r) => compositeScore(r.rubric.detail))
      .filter((x): x is number => x !== null);
    const bTok = b.map((r) => r.tokens.total).filter((x): x is number => x !== null);
    const rTok = rr.map((r) => r.tokens.total).filter((x): x is number => x !== null);

    if (bScores.length > 0 && rScores.length > 0) {
      const c = compareCells(bScores, rScores);
      scoreRows.push(fmtRow(key, c));
      if (c.p < 0.05) {
        significant.push(
          `composite ${key}: rerun ${c.rerunMedian > c.baselineMedian ? "higher" : "lower"} than baseline (p = ${fmtP(c.p)})`,
        );
      }
    }
    if (bTok.length > 0 && rTok.length > 0) {
      const c = compareCells(bTok, rTok);
      tokenRows.push(
        fmtRow(key, { ...c, baselineMedian: c.baselineMedian, rerunMedian: c.rerunMedian }),
      );
      if (c.p < 0.05) {
        significant.push(
          `tokens ${key}: rerun ${c.rerunMedian > c.baselineMedian ? "higher" : "lower"} than baseline (p = ${fmtP(c.p)})`,
        );
      }
    }
    const bPass = b.filter((r) => r.rubric.pass).length;
    const rPass = rr.filter((r) => r.rubric.pass).length;
    passRows.push(`| ${key} | ${bPass}/${b.length} | ${rPass}/${rr.length} |`);
  }

  compositeTable("Composite score per cell", scoreHeader + "\n" + scoreRows.join("\n"));
  compositeTable("Tokens per cell", tokenHeader + "\n" + tokenRows.join("\n"));
  compositeTable(
    "Rubric pass counts per cell",
    "| Task | Model | Baseline | Rerun |\n| --- | --- | --- | --- |\n" + passRows.join("\n"),
  );

  const report = lines.join("\n");
  console.log(report);
  if (significant.length > 0) {
    console.log("Significant cells (alpha = 0.05):");
    for (const s of significant) console.log(`- ${s}`);
  } else {
    console.log("No significant differences at alpha = 0.05.");
  }

  mkdirSync("results", { recursive: true });
  let out = `${report}\n`;
  out +=
    significant.length > 0
      ? `\nSignificant cells (alpha = 0.05):\n${significant.map((s) => `- ${s}`).join("\n")}\n`
      : "\nNo significant differences at alpha = 0.05.\n";
  writeFileSync(join("results", "comparison-stats.md"), out);
  console.log("\nwritten to results/comparison-stats.md");
}

// Run CLI only when executed directly, so tests can import pure functions.
const isMain = process.argv[1]?.endsWith("compare.ts");
if (isMain) main();
