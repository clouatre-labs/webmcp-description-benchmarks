/**
 * Progressive tool disclosure: derive a closed page-kind enum from the
 * current URL and filter the read-only WebMCP tool catalog accordingly.
 * This module is the single source of truth for the kind -> tool mapping;
 * Layout.astro and AgentReady.astro must not inline it.
 */
import type { ToolDefinition } from "./webmcp-tools";

export type PageKind = "home" | "post" | "archive" | "other";

/** kind -> allowed tool names, in catalog order. Adding a page kind means
 * editing this mapping table only. */
const ALLOWED_TOOLS: Record<PageKind, readonly string[]> = {
  home: ["search_posts", "get_posts_by_concept"],
  post: ["get_post_markdown", "get_related_posts", "get_posts_by_concept"],
  archive: ["search_posts"],
  other: ["search_posts"],
};

/**
 * Derive the page kind from a URL. A trailing slash is optional.
 * - "/" or "" -> home
 * - /posts/<slug> (single segment, non-numeric) -> post
 * - /posts, /posts/<digits> (pagination), /tags*, /search* -> archive
 * - everything else (404, about, topics/*, ...) -> other
 */
export function derivePageKind(url: URL): PageKind {
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "") return "home";
  if (
    /^\/posts\/[^/]+$/.test(path) &&
    !/^\d+$/.test(path.slice("/posts/".length))
  ) {
    return "post";
  }
  if (path === "/posts" || /^\/posts\/\d+$/.test(path)) return "archive";
  if (path.startsWith("/tags") || path.startsWith("/search")) return "archive";
  return "other";
}

/**
 * Return the tool definitions allowed for the given page kind, preserving
 * the input order and identity of the returned definitions.
 */
export function filterToolsForPageKind(
  kind: PageKind,
  tools: ToolDefinition[],
): ToolDefinition[] {
  const allowed = new Set(ALLOWED_TOOLS[kind]);
  return tools.filter((tool) => allowed.has(tool.name));
}
