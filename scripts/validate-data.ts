/**
 * Dataset integrity validation for docs/audit/ WebMCP eval batches.
 *
 * Run with: bun scripts/validate-data.ts
 * (No package.json exists; the command is wired directly into
 * .github/workflows/ci.yml.)
 *
 * Checks:
 * - baseline, delta, and delta-rerun batches each contain exactly 45 run
 *   JSON files named <task>__<model>__<iteration>.json with task in
 *   {discover, extract, traverse}, iteration 1..5, and exactly 3 models.
 * - Each run JSON parses with the expected shape.
 * - Each batch has a summary.md.
 * - docs/audit/2026-10-04-webmcp-payload.json parses.
 * - Computed rubric pass counts per batch equal the constants claimed in
 *   results/*.md: baseline 44, delta 45, delta-rerun 45.
 */

import { existsSync, readFileSync } from "node:fs";

const BATCHES = [
  { dir: "docs/audit/baseline", expectedPasses: 44 },
  { dir: "docs/audit/delta", expectedPasses: 45 },
  { dir: "docs/audit/delta-rerun", expectedPasses: 45 },
] as const;

const TASKS = ["discover", "extract", "traverse"] as const;

const failures: string[] = [];

function fail(msg: string): void {
  failures.push(msg);
}

async function main(): Promise<void> {
  for (const batch of BATCHES) {
    await validateBatch(batch.dir, batch.expectedPasses);
  }

  const payloadPath = "docs/audit/2026-10-04-webmcp-payload.json";
  try {
    await Bun.file(payloadPath).json();
  } catch (err) {
    fail(`${payloadPath}: failed to parse: ${err instanceof Error ? err.message : err}`);
  }

  if (failures.length > 0) {
    console.error(`validate-data: ${failures.length} failure(s):`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
  console.log("validate-data: all checks passed");
}

async function validateBatch(dir: string, expectedPasses: number): Promise<void> {
  let entries: string[];
  try {
    entries = Array.from(new Bun.Glob("*.json").scanSync({ cwd: `${dir}/runs` }));
  } catch (err) {
    fail(`${dir}/runs: cannot list: ${err instanceof Error ? err.message : err}`);
    return;
  }

  if (entries.length !== 45) {
    fail(`${dir}/runs: expected 45 JSON files, found ${entries.length}`);
  }

  const models = new Set<string>();
  const seen = new Set<string>();
  let passCount = 0;

  for (const name of entries) {
    const m = name.match(/^(discover|extract|traverse)__(.+)__(\d)\.json$/);
    if (!m) {
      fail(`${dir}/runs: unexpected file name ${name}`);
      continue;
    }
    const task = m[1] as (typeof TASKS)[number];
    const model = m[2];
    const iter = Number(m[3]);
    if (!TASKS.includes(task)) fail(`${dir}/runs/${name}: unknown task ${task}`);
    if (iter < 1 || iter > 5) fail(`${dir}/runs/${name}: iteration ${iter} out of 1..5`);
    models.add(model);
    const key = `${task}__${model}__${iter}`;
    if (seen.has(key)) fail(`${dir}/runs/${name}: duplicate ${key}`);
    seen.add(key);

    let json: any;
    try {
      json = JSON.parse(readFileSync(`${dir}/runs/${name}`, "utf8"));
    } catch (err) {
      fail(`${dir}/runs/${name}: cannot read or parse: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (typeof json.task !== "string" || json.task !== task) {
      fail(`${dir}/runs/${name}: task mismatch (file ${task}, field ${JSON.stringify(json.task)})`);
    }
    if (typeof json.model !== "string" || !json.model.includes(model)) {
      fail(`${dir}/runs/${name}: model mismatch (file token ${model}, field ${JSON.stringify(json.model)})`);
    }
    if (json.iteration !== iter) {
      fail(`${dir}/runs/${name}: iteration mismatch (file ${iter}, field ${JSON.stringify(json.iteration)})`);
    }
    if (typeof json.rubric?.pass !== "boolean") {
      fail(`${dir}/runs/${name}: rubric.pass is not boolean`);
    } else if (json.rubric.pass) {
      passCount++;
    }
    if (typeof json.tokens?.total !== "number") {
      fail(`${dir}/runs/${name}: tokens.total is not a number`);
    }
    if (!Array.isArray(json.toolCalls)) {
      fail(`${dir}/runs/${name}: toolCalls is not an array`);
    }
  }

  if (models.size !== 3) {
    fail(`${dir}/runs: expected 3 distinct models, found ${models.size}: ${[...models].sort().join(", ")}`);
  }

  for (const task of TASKS) {
    for (const model of models) {
      for (let i = 1; i <= 5; i++) {
        if (!seen.has(`${task}__${model}__${i}`)) {
          fail(`${dir}/runs: missing ${task}__${model}__${i}.json`);
        }
      }
    }
  }

  if (!existsSync(`${dir}/summary.md`)) {
    fail(`${dir}/summary.md: missing per-batch summary`);
  }

  if (passCount !== expectedPasses) {
    fail(`${dir}: computed ${passCount} rubric passes, results claim ${expectedPasses}`);
  }
  console.log(`${dir}: ${entries.length} runs, ${models.size} models, ${passCount} rubric passes (claimed ${expectedPasses})`);
}

await main();
