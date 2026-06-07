/**
 * Provider-defined ("built-in" / server-side) tools.
 *
 * Unlike `Tool`, these are not executed locally — the provider runs them as
 * part of generating its response (e.g. Anthropic's web search, bash, and
 * text editor tools). They carry no `execute` function or input schema; the
 * agent simply forwards their definition to the provider's API.
 *
 * Pass arbitrary built-in tool definitions straight through — only `type`
 * and `name` are required, any other provider-specific fields are allowed:
 *
 * @example
 * ```typescript
 * const agent = new ClaudeAgent({
 *   ...,
 *   builtInTools: [
 *     { type: "web_search_20250305", name: "web_search", max_uses: 5 },
 *   ],
 * });
 * ```
 *
 * Or use one of the helpers below for the well-known Anthropic tools.
 */
export interface BuiltInTool {
  /** Provider-specific tool type identifier, e.g. `"web_search_20250305"` */
  type: string;
  /** Name the model will use to refer to the tool, e.g. `"web_search"` */
  name: string;
  /** Any additional provider-specific configuration for this tool */
  [key: string]: unknown;
}

/**
 * Options for Anthropic's web search tool (`web_search_20250305`).
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool
 */
export interface WebSearchToolOptions {
  /** Maximum number of searches Claude can perform during the request */
  maxUses?: number;
  /** Only include results from these domains (mutually exclusive with `blockedDomains`) */
  allowedDomains?: string[];
  /** Never include results from these domains (mutually exclusive with `allowedDomains`) */
  blockedDomains?: string[];
  /** Approximate user location, used to localize search results */
  userLocation?: {
    type?: "approximate";
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}

/**
 * Anthropic's server-side web search tool.
 * Claude decides when to search and the results are fetched and processed by Anthropic.
 */
export function webSearchTool(options: WebSearchToolOptions = {}): BuiltInTool {
  const tool: BuiltInTool = {
    type: "web_search_20250305",
    name: "web_search",
  };
  if (options.maxUses !== undefined) tool.max_uses = options.maxUses;
  if (options.allowedDomains) tool.allowed_domains = options.allowedDomains;
  if (options.blockedDomains) tool.blocked_domains = options.blockedDomains;
  if (options.userLocation) {
    tool.user_location = { type: "approximate", ...options.userLocation };
  }
  return tool;
}

/**
 * Anthropic's server-side bash tool — gives Claude a persistent shell session.
 * Requires a compatible model (e.g. Claude 4 / 3.7 Sonnet) and beta header support.
 */
export function bashTool(): BuiltInTool {
  return { type: "bash_20250124", name: "bash" };
}

/**
 * Anthropic's server-side text editor tool — lets Claude view and edit text files.
 */
export function textEditorTool(
  version: "20250124" | "20250429" | "20250728" = "20250728"
): BuiltInTool {
  const names: Record<string, string> = {
    "20250124": "str_replace_editor",
    "20250429": "str_replace_based_edit_tool",
    "20250728": "str_replace_based_edit_tool",
  };
  return { type: `text_editor_${version}`, name: names[version] };
}

/**
 * Define an arbitrary provider-defined / built-in tool by its raw definition.
 * Use this to pass through tools not covered by the helpers above (or for
 * other providers that support server-side tools).
 */
export function builtInTool(definition: BuiltInTool): BuiltInTool {
  return definition;
}
