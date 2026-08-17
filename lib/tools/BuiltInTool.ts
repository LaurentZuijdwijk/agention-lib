/**
 * Provider-defined ("built-in" / server-side) tools.
 *
 * Unlike `Tool`, these are not executed locally — the provider runs them as
 * part of generating its response (e.g. Anthropic's web search, bash, and
 * text editor tools; OpenAI's web search, file search, and code interpreter;
 * OpenRouter's web search/fetch server tools). They carry no `execute`
 * function or input schema; the agent simply forwards their definition to
 * the provider's API.
 *
 * Pass arbitrary built-in tool definitions straight through — only `type`
 * is required. Anthropic also expects a `name` (the model's label for the
 * tool); OpenAI and OpenRouter's built-in tool objects generally omit it.
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
 * Or use one of the helpers below for the well-known tools of each provider.
 */
export interface BuiltInTool {
  /** Provider-specific tool type identifier, e.g. `"web_search_20250305"` */
  type: string;
  /** Name the model will use to refer to the tool, e.g. `"web_search"` (Anthropic only) */
  name?: string;
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
 * Options for OpenAI's web search tool (`web_search`), used on the Responses API.
 * @see https://developers.openai.com/api/docs/guides/tools-web-search
 */
export interface OpenAiWebSearchToolOptions {
  /** Only include results from these domains (max 100) */
  allowedDomains?: string[];
  /** Never include results from these domains (max 100) */
  blockedDomains?: string[];
  /** Approximate user location, used to localize search results */
  userLocation?: {
    type?: "approximate";
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
  /** How much of the web page to feed back into context (higher = more thorough, more tokens) */
  searchContextSize?: "low" | "medium" | "high";
}

/**
 * OpenAI's server-side web search tool for the Responses API.
 * The model decides when to search; results are fetched and processed by OpenAI.
 */
export function openAiWebSearchTool(
  options: OpenAiWebSearchToolOptions = {}
): BuiltInTool {
  const tool: BuiltInTool = { type: "web_search" };
  if (options.allowedDomains || options.blockedDomains) {
    tool.filters = {
      ...(options.allowedDomains ? { allowed_domains: options.allowedDomains } : {}),
      ...(options.blockedDomains ? { blocked_domains: options.blockedDomains } : {}),
    };
  }
  if (options.userLocation) {
    tool.user_location = { type: "approximate", ...options.userLocation };
  }
  if (options.searchContextSize) {
    tool.search_context_size = options.searchContextSize;
  }
  return tool;
}

/**
 * OpenAI's server-side file search tool — retrieves from vector stores you've
 * already uploaded files to.
 * @see https://developers.openai.com/api/docs/guides/tools-file-search
 */
export function openAiFileSearchTool(
  vectorStoreIds: string[],
  options: { maxNumResults?: number } = {}
): BuiltInTool {
  const tool: BuiltInTool = { type: "file_search", vector_store_ids: vectorStoreIds };
  if (options.maxNumResults !== undefined) tool.max_num_results = options.maxNumResults;
  return tool;
}

/**
 * OpenAI's server-side code interpreter tool — runs Python in a sandboxed container.
 * Defaults to `container: { type: "auto" }`, which OpenAI provisions automatically
 * and reuses across a conversation's follow-up requests.
 * @see https://developers.openai.com/api/docs/guides/tools-code-interpreter
 */
export function openAiCodeInterpreterTool(containerId?: string): BuiltInTool {
  return {
    type: "code_interpreter",
    container: containerId ?? { type: "auto" },
  };
}

/**
 * Options for OpenRouter's web search server tool (`openrouter:web_search`).
 * @see https://openrouter.ai/docs/guides/features/server-tools/web-search
 */
export interface OpenRouterWebSearchToolOptions {
  maxResults?: number;
  maxTotalResults?: number;
  searchContextSize?: "low" | "medium" | "high";
  allowedDomains?: string[];
  excludedDomains?: string[];
}

/**
 * OpenRouter's server-side web search tool — works identically across every
 * tool-calling model OpenRouter fronts, unlike each upstream provider's own
 * (differently-shaped) web search tool.
 */
export function openRouterWebSearchTool(
  options: OpenRouterWebSearchToolOptions = {}
): BuiltInTool {
  const tool: BuiltInTool = { type: "openrouter:web_search" };
  if (options.maxResults !== undefined) tool.max_results = options.maxResults;
  if (options.maxTotalResults !== undefined) tool.max_total_results = options.maxTotalResults;
  if (options.searchContextSize) tool.search_context_size = options.searchContextSize;
  if (options.allowedDomains) tool.allowed_domains = options.allowedDomains;
  if (options.excludedDomains) tool.excluded_domains = options.excludedDomains;
  return tool;
}

/**
 * OpenRouter's server-side web fetch tool (`openrouter:web_fetch`) — retrieves
 * and renders a specific URL, as opposed to searching.
 * @see https://openrouter.ai/docs/guides/features/server-tools/overview
 */
export function openRouterWebFetchTool(): BuiltInTool {
  return { type: "openrouter:web_fetch" };
}

/**
 * Define an arbitrary provider-defined / built-in tool by its raw definition.
 * Use this to pass through tools not covered by the helpers above (or for
 * other providers that support server-side tools).
 */
export function builtInTool(definition: BuiltInTool): BuiltInTool {
  return definition;
}
