/**
 * WebMCP behavioral eval harness (issue #1626, baseline half).
 *
 * Per run:
 *   1. Serve dist/ over localhost (secure context required by WebMCP).
 *   2. Launch Playwright Chromium with WebMCP feature flags; wait for the
 *      page's disclosed tools to register (per page kind, post-#1651).
 *      Tasks run on their start page so required tools are disclosed.
 *   3. Expose the page's tools over a local streamable-HTTP MCP bridge.
 *   4. Drive goose headless (`goose run --with-streamable-http-extension`)
 *      with one task prompt; record tokens, tool calls, wall clock.
 *   5. Grade a deterministic rubric from bridge-recorded payloads plus the
 *      goose final response.
 *
 * Usage:
 *   bun run scripts/webmcp-eval/harness.ts --output-dir <dir> \
 *     [--iterations 5] [--tasks discover,extract,traverse] [--port 4177]
 *
 * Local/on-demand only; no CI wiring (non-goal in #1626).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { derivePageKind } from "../webmcp-page-kind";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DIST_DIR = resolve("dist");
const SITE_PORT = 4177;
const BRIDGE_PORT = 4178;
const SITE_ORIGIN = `http://localhost:${SITE_PORT}`;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}/mcp`;
const GOOSE_TEMPERATURE = "0.3";
const GOOSE_SEED = "42";
const MAX_TURNS = "12";
const TOOL_NAMES = [
  "search_posts",
  "get_post_markdown",
  "get_related_posts",
  "get_posts_by_concept",
] as const;

// Progressive disclosure (#1651): no single page registers all four tools.
// Each task starts on a page kind where its required tools are disclosed.
const HOME_TOOLS = ["search_posts", "get_posts_by_concept"] as const;

interface ModelSpec {
  provider: string;
  model: string;
  /** Filesystem-safe label for run filenames and summaries. */
  label: string;
}

const MODELS: ModelSpec[] = [
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    label: "claude-haiku-4-5",
  },
  { provider: "zai", model: "glm-5.3-flash", label: "glm-5.3-flash" },
  { provider: "openrouter", model: "openai/gpt-6-luna", label: "gpt-6-luna" },
];

interface TaskSpec {
  id: string;
  /** Path to load before the run; the registry is filtered per page kind
   * since #1651 progressive disclosure. */
  startPath: string;
  /** Tools that must be live on startPath for the run to be valid. */
  requires: readonly string[];
  prompt: string;
  /** Machine-checkable rubric over recorded tool payloads + final response. */
  grade: (r: RunObservation) => RubricResult;
}

const TASKS: TaskSpec[] = [
  {
    id: "discover",
    startPath: "/",
    requires: ["search_posts"],
    prompt:
      "Use the search_posts tool to find the blog post about when AI agents " +
      "need human approval gates before acting. Then reply with the exact " +
      "slug of that post and nothing else.",
    grade: (r) => {
      const target = "ai-approval-gates";
      const searched = r.toolCalls.some(
        (c) =>
          c.name === "search_posts" &&
          JSON.stringify(c.result).includes(target),
      );
      const answered = normalize(r.finalResponse).includes(target);
      return {
        pass: searched && answered,
        detail: `search_posts returned target: ${searched}; final response names slug: ${answered}`,
      };
    },
  },
  {
    id: "extract",
    startPath: "/posts/ai-sdlc-governance-stack/",
    requires: ["get_post_markdown"],
    prompt:
      "Use the get_post_markdown tool to retrieve the post with slug " +
      "'ai-sdlc-governance-stack'. Find the sentence that begins with the " +
      "words 'Two studies' and reply with that sentence quoted verbatim. " +
      "If the post is paginated, keep requesting further pages until you " +
      "have found the sentence.",
    grade: (r) => {
      const claim =
        "Two studies that appear contradictory resolve once governance " +
        "scaffolding maturity is accounted for.";
      const answered = normalize(r.finalResponse).includes(normalize(claim));
      const paginated = r.toolCalls.some(
        (c) =>
          c.name === "get_post_markdown" &&
          typeof c.input?.page === "number" &&
          c.input.page > 0,
      );
      return {
        pass: answered,
        detail: `claim quoted verbatim: ${answered}; used page traversal: ${paginated}`,
      };
    },
  },
  {
    id: "traverse",
    startPath: "/posts/ai-approval-gates/",
    requires: ["get_related_posts", "get_posts_by_concept"],
    prompt:
      "Start from the post with slug 'ai-approval-gates'. Use get_related_posts " +
      "to find the post linked by the thematic_chain edge. That linked post " +
      "belongs to more than one concept cluster; use get_posts_by_concept " +
      "with the cluster id 'governance-oversight' to find that cluster's hub " +
      "post. Reply with the hub post's slug and nothing else.",
    grade: (r) => {
      const terminal = "ai-sdlc-governance-stack";
      const intermediate = "ai-observability-gaps";
      const sawIntermediate = r.toolCalls.some(
        (c) =>
          (c.name === "get_related_posts" ||
            c.name === "get_posts_by_concept") &&
          JSON.stringify(c.result).includes(intermediate),
      );
      const answered = normalize(r.finalResponse).includes(terminal);
      return {
        pass: sawIntermediate && answered,
        detail: `intermediate post seen: ${sawIntermediate}; terminal hub in response: ${answered}`,
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
  ms: number;
}

interface RubricResult {
  pass: boolean;
  detail: string;
}

interface RunObservation {
  toolCalls: ToolCallRecord[];
  finalResponse: string;
}

interface RunRecord extends RunObservation {
  task: string;
  provider: string;
  model: string;
  iteration: number;
  /** URL path the run started from (evaluation context, issue #1658). */
  startPath: string | null;
  /** Page kind derived from startPath (evaluation context). */
  pageKind: string | null;
  /** Tool names disclosed at bridge start (evaluation context). */
  servedTools: string[] | null;
  rubric: RubricResult;
  tokens: {
    total: number | null;
    input: number | null;
    output: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
  };
  costUsd: number | null;
  wallClockMs: number;
  gooseExitCode: number | null;
  gooseStderr: string;
  infraError: string | null;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Static server for dist/
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

function startStaticServer(): { stop: () => void } {
  const server = Bun.serve({
    port: SITE_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      let path = decodeURIComponent(url.pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = join(DIST_DIR, path);
      if (!file.startsWith(DIST_DIR) || !existsSync(file)) {
        return new Response("not found", { status: 404 });
      }
      return new Response(Bun.file(file), {
        headers: {
          "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
        },
      });
    },
  });
  return { stop: () => server.stop(true) };
}

// ---------------------------------------------------------------------------
// Browser + in-page tool execution
// ---------------------------------------------------------------------------

async function launchBrowser(): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-features=WebMCP", "--enable-blink-features=WebMCP"],
  });
  const page = await browser.newPage();
  await page.goto(`${SITE_ORIGIN}/`, { waitUntil: "networkidle" });
  // Wait for the home page's disclosed tools (progressive disclosure #1651
  // means per-page-kind registries; tasks navigate to their own start page).
  await waitForTools(page, HOME_TOOLS);
  return { browser, page };
}

/** Wait until every named tool is live in the page's model context. */
async function waitForTools(
  page: Page,
  names: readonly string[],
  timeoutMs = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (names: string[]) => {
      const mc = (document as never as Record<string, never>).modelContext as
        | { getTools?: () => Promise<Array<{ name: string }>> }
        | undefined;
      if (!mc?.getTools) return false;
      return mc.getTools().then((tools) => {
        return names.every((n) => tools.some((t) => t.name === n));
      }) as unknown as boolean;
    },
    [...names],
    { timeout: timeoutMs },
  );
}

/** Navigate to the task's start page and wait for its required tools. */
async function ensureTaskContext(page: Page, task: TaskSpec): Promise<void> {
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== task.startPath) {
    await page.goto(`${SITE_ORIGIN}${task.startPath}`, {
      waitUntil: "networkidle",
    });
  }
  await waitForTools(page, task.requires);
}

/** Invoke one tool inside the page via the real modelContext API. */
async function callToolInPage(
  page: Page,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  return page.evaluate(
    async ({ name, input }) => {
      const d = document as never as {
        modelContext?: {
          getTools: () => Promise<Array<Record<string, unknown>>>;
          executeTool: (tool: unknown, input: string) => Promise<unknown>;
        };
      };
      const mc = d.modelContext;
      if (!mc) throw new Error("document.modelContext unavailable");
      const tools = await mc.getTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      // Chrome's executeTool takes the RegisteredTool descriptor from
      // getTools() plus the input serialized as a JSON string.
      return mc.executeTool(tool, JSON.stringify(input));
    },
    { name, input },
  );
}

// ---------------------------------------------------------------------------
// Streamable-HTTP MCP bridge
// ---------------------------------------------------------------------------

function startBridge(
  page: Page,
  onToolCall: (rec: ToolCallRecord) => void,
): { stop: () => Promise<void>; server: ReturnType<typeof Bun.serve> } {
  const server = Bun.serve({
    port: BRIDGE_PORT,
    async fetch(req) {
      // Streamable-HTTP transport: clients open a GET SSE stream for
      // server-to-client messages; keep it open so the session stays live.
      if (req.method === "GET") {
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(": keepalive\n\n"));
            const iv = setInterval(
              () => controller.enqueue(enc.encode(": keepalive\n\n")),
              15_000,
            );
            req.signal.addEventListener("abort", () => {
              clearInterval(iv);
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }
      if (req.method !== "POST") {
        return new Response("method not allowed", { status: 405 });
      }
      let msg: {
        id?: number | string;
        method: string;
        params?: Record<string, unknown>;
      };
      try {
        msg = await req.json();
      } catch {
        return sseResponse({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "parse error" },
        });
      }
      console.log(
        `[bridge] ${msg.method ?? "notification"} id=${String(msg.id)}`,
      );
      if (!msg.method) {
        return new Response(null, { status: 202 });
      }
      if (msg.method.startsWith("notifications/")) {
        return new Response(null, { status: 202 });
      }
      switch (msg.method) {
        case "server/discover":
          // MCP 2026-07-28 (SEP-2575) sessionless discovery. This bridge
          // speaks the modern protocol exclusively; all request handlers
          // below are sessionless and require no initialize handshake.
          return jsonRpcResult(msg.id, {
            resultType: "complete",
            supportedVersions: ["2026-07-28"],
            capabilities: { tools: {} },
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "webmcp-eval-bridge",
                version: "0.1.0",
              },
            },
            ttlMs: 3_600_000,
            cacheScope: "public",
          });
        case "initialize":
          // Unreachable under a 2026-07-28-only server, but answered for
          // protocol-safe fallback if a client insists on legacy.
          return jsonRpcError(
            msg.id ?? null,
            -32601,
            "initialize unsupported; use server/discover (2026-07-28)",
          );
        case "tools/list": {
          const tools = await page.evaluate(() => {
            const d = document as never as {
              modelContext?: {
                getTools: () => Promise<
                  Array<{
                    name: string;
                    description?: string;
                    inputSchema?: unknown;
                    annotations?: unknown;
                  }>
                >;
              };
            };
            return d.modelContext
              ? d.modelContext.getTools()
              : Promise.resolve([]);
          });
          const served = tools
            .filter((t) => (TOOL_NAMES as readonly string[]).includes(t.name))
            .map((t) => ({
              name: t.name,
              description: t.description,
              // Chrome serializes inputSchema as a JSON string over
              // getTools(); MCP clients require the object form.
              inputSchema:
                typeof t.inputSchema === "string"
                  ? (JSON.parse(t.inputSchema) as unknown)
                  : t.inputSchema,
              annotations: t.annotations,
            }));
          console.log(
            `[bridge] serving ${served.length} tools: ${served.map((t) => t.name).join(",")}`,
          );
          return jsonRpcResult(msg.id, { tools: served, nextCursor: null });
        }
        case "tools/call": {
          const { name, arguments: args } = msg.params as {
            name: string;
            arguments?: Record<string, unknown>;
          };
          const started = performance.now();
          try {
            const result = await callToolInPage(page, name, args ?? {});
            onToolCall({
              name,
              input: args ?? {},
              result,
              ms: Math.round(performance.now() - started),
            });
            return jsonRpcResult(msg.id, {
              content: [{ type: "text", text: JSON.stringify(result) }],
              structuredContent: result,
            });
          } catch (e) {
            onToolCall({
              name,
              input: args ?? {},
              result: { error: String(e) },
              ms: Math.round(performance.now() - started),
            });
            return jsonRpcResult(msg.id, {
              content: [{ type: "text", text: `tool error: ${String(e)}` }],
              isError: true,
            });
          }
        }
        default:
          return jsonRpcError(
            msg.id ?? null,
            -32601,
            `unknown method: ${msg.method}`,
          );
      }
    },
  });
  return {
    server,
    stop: () =>
      new Promise((res) => {
        server.stop(true);
        res();
      }),
  };
}

function jsonRpcResult(id: unknown, result: unknown): Response {
  return sseResponse({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: unknown, code: number, message: string): Response {
  return sseResponse({ jsonrpc: "2.0", id, error: { code, message } });
}

// goose's rmcp streamable-HTTP client expects SSE-framed responses to POSTs.
function sseResponse(body: unknown): Response {
  return new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

// ---------------------------------------------------------------------------
// Goose runner
// ---------------------------------------------------------------------------

interface GooseJsonOutput {
  messages?: Array<{
    role: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  metadata?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_write_input_tokens?: number;
    cost_usd?: number;
  };
}

function runGoose(
  prompt: string,
  spec: ModelSpec,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const child = spawn(
      "goose",
      [
        "run",
        "--no-session",
        "--no-profile",
        "--output-format",
        "json",
        "--with-streamable-http-extension",
        BRIDGE_URL,
        "--max-turns",
        MAX_TURNS,
        "--provider",
        spec.provider,
        "--model",
        spec.model,
        "-t",
        prompt,
      ],
      {
        env: {
          ...process.env,
          GOOSE_TEMPERATURE: GOOSE_TEMPERATURE,
          GOOSE_SEED: GOOSE_SEED,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (exitCode) => res({ exitCode, stdout, stderr }));
  });
}

function parseGooseJson(stdout: string): {
  observation: Pick<RunObservation, "finalResponse">;
  tokens: RunRecord["tokens"];
  costUsd: number | null;
} {
  // goose may emit a CLI banner before the multi-line JSON payload; scan
  // candidate object starts and take the first that parses with metadata.
  let payload: GooseJsonOutput | null = null;
  for (let i = stdout.indexOf("{"); i >= 0; i = stdout.indexOf("{", i + 1)) {
    try {
      const parsed = JSON.parse(stdout.slice(i)) as GooseJsonOutput;
      if (parsed.metadata) {
        payload = parsed;
        break;
      }
    } catch {
      // not a complete object at this offset
    }
  }
  // The final assistant text is the last text content block in `messages`.
  const texts = (payload?.messages ?? [])
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "");
  const text = texts[texts.length - 1] ?? "";
  const m = payload?.metadata ?? {};
  return {
    observation: { finalResponse: text },
    tokens: {
      total: m.total_tokens ?? null,
      input: m.input_tokens ?? null,
      output: m.output_tokens ?? null,
      cacheRead: m.cache_read_input_tokens ?? null,
      cacheWrite: m.cache_write_input_tokens ?? null,
    },
    costUsd: m.cost_usd ?? null,
  };
}

// ---------------------------------------------------------------------------
// Normalization for substring rubrics
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`*_>[\]()#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const outputDir = resolve(arg("output-dir", ""));
  const iterations = Number(arg("iterations", "5"));
  const taskFilter = arg("tasks", "discover,extract,traverse").split(",");
  const modelFilter = arg("models", ""); // e.g. "anthropic/claude-haiku-4-5"
  const activeModels = modelFilter
    ? MODELS.filter((m) => `${m.provider}/${m.model}` === modelFilter)
    : MODELS;
  if (activeModels.length === 0)
    throw new Error(`no models match: ${modelFilter}`);
  if (!outputDir || !existsSync(DIST_DIR)) {
    console.error("usage: harness.ts --output-dir <dir> (dist/ must exist)");
    process.exit(1);
  }
  const runsDir = join(outputDir, "runs");
  mkdirSync(runsDir, { recursive: true });

  const staticServer = startStaticServer();
  const { browser, page } = await launchBrowser();
  console.log(`browser up; home tools registered at ${SITE_ORIGIN}`);

  const plan: Array<{ task: TaskSpec; spec: ModelSpec; iteration: number }> =
    [];
  for (const taskId of taskFilter) {
    const task = TASKS.find((t) => t.id === taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    for (const spec of activeModels) {
      for (let i = 1; i <= iterations; i++)
        plan.push({ task, spec, iteration: i });
    }
  }

  let runIndex = 0;
  let infraFailures = 0;
  let bridge: ReturnType<typeof startBridge> | null = null;
  if (process.argv.includes("--manual")) {
    bridge = startBridge(page, () => {});
    console.log("manual mode: bridge stays up until killed");
    await new Promise(() => {});
  }
  for (const { task, spec, iteration } of plan) {
    runIndex++;
    const label = `${task.id}__${spec.label}__${iteration}`;
    const record: RunRecord = {
      task: task.id,
      provider: spec.provider,
      model: spec.model,
      iteration,
      rubric: { pass: false, detail: "not run" },
      tokens: {
        total: null,
        input: null,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      },
      costUsd: null,
      wallClockMs: 0,
      gooseExitCode: null,
      gooseStderr: "",
      infraError: null,
      recordedAt: new Date().toISOString(),
      startPath: null,
      pageKind: null,
      servedTools: null,
      toolCalls: [],
      finalResponse: "",
    };

    const started = performance.now();
    // Progressive disclosure (#1651): put the page on the task's start page
    // so its required tools are the ones disclosed to the agent.
    try {
      await ensureTaskContext(page, task);
      record.startPath = task.startPath;
      record.pageKind = derivePageKind(new URL(task.startPath, SITE_ORIGIN));
      const live = (await page.evaluate(() => {
        const d = document as never as {
          modelContext?: {
            getTools: () => Promise<Array<{ name: string }>>;
          };
        };
        return d.modelContext ? d.modelContext.getTools() : [];
      })) as Array<{ name: string }>;
      record.servedTools = live.map((t) => t.name);
    } catch {
      // Leave context fields null so infra failures stay distinguishable.
    }
    bridge = startBridge(page, (rec) => record.toolCalls.push(rec));
    try {
      const goose = await runGoose(task.prompt, spec);
      record.gooseExitCode = goose.exitCode;
      record.gooseStderr = goose.stderr.slice(0, 1000);
      const parsed = parseGooseJson(goose.stdout);
      record.finalResponse = parsed.observation.finalResponse;
      record.tokens = parsed.tokens;
      record.costUsd = parsed.costUsd;
      if (goose.exitCode !== 0 && !record.finalResponse) {
        record.infraError = `goose exit ${goose.exitCode}: ${goose.stderr.slice(0, 500)}`;
      }
      record.rubric = task.grade(record);
    } catch (e) {
      record.infraError = `harness error: ${String(e)}`;
      infraFailures++;
    } finally {
      await bridge.stop();
      bridge = null;
    }
    record.wallClockMs = Math.round(performance.now() - started);

    const file = join(runsDir, `${label}.json`);
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    console.log(
      `[${runIndex}/${plan.length}] ${label}: rubric=${record.rubric.pass ? "PASS" : "FAIL"} ` +
        `tokens=${record.tokens.total ?? "?"} toolCalls=${record.toolCalls.length} ` +
        `${Math.round(record.wallClockMs / 1000)}s` +
        (record.infraError
          ? ` INFRA_ERROR: ${record.infraError.slice(0, 200)}`
          : ""),
    );
    // Per-run sanity: if the page lost the task's required tools (browser/
    // flag issue), stop rather than working around (per #1626 scope).
    const live = (await page.evaluate(() => {
      const d = document as never as {
        modelContext?: { getTools: () => Promise<Array<{ name: string }>> };
      };
      return d.modelContext ? d.modelContext.getTools() : Promise.resolve([]);
    })) as Array<{ name: string }>;
    if (!task.requires.every((n) => live.some((t) => t.name === n))) {
      console.error("tool registry lost on page; aborting (infra failure)");
      infraFailures++;
      break;
    }
  }

  await browser.close();
  staticServer.stop();
  console.log(`done: ${runIndex} runs, ${infraFailures} infra failures`);
  console.log(
    `summarize with: bun run scripts/webmcp-eval/summarize.ts --run-dir ${outputDir}`,
  );
  if (infraFailures > 0) process.exit(2);
}

main();
