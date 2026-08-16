/**
 * Shared History Types
 *
 * These types define a provider-agnostic message format that can be
 * transformed to/from any LLM provider's native format.
 */

// =============================================================================
// Content Types
// =============================================================================

/**
 * Plain text content
 */
export type TextContent = {
  type: "text";
  text: string;
};

/**
 * Tool/function call made by the assistant
 */
export type ToolUseContent = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  /**
   * Provider-opaque reasoning token that has to be echoed back verbatim.
   *
   * Gemini 3 returns one beside every `functionCall` and rejects any later
   * request in the conversation that omits it — "Function call is missing a
   * thought_signature in functionCall parts". Nothing reads its contents; it
   * only has to survive the round trip through history.
   */
  thoughtSignature?: string;
};

/**
 * Result of a tool execution
 */
export type ToolResultContent = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

/**
 * Extended-thinking / reasoning block produced by the assistant (Anthropic).
 *
 * These must be preserved verbatim — including `signature` — and echoed back on
 * the following request when the assistant used a tool, or the provider rejects
 * the turn. `redactedData` is set instead of `thinking` for redacted blocks,
 * whose payload is opaque and must be returned unchanged.
 */
export type ThinkingContent = {
  type: "thinking";
  thinking: string;
  signature?: string;
  redactedData?: string;
  /**
   * Provider-opaque reasoning blocks that have to be echoed back verbatim.
   *
   * OpenRouter returns `reasoning_details` beside the plain `reasoning` text and
   * requires them back on the next request — the `reasoning.encrypted` variant
   * carries the upstream provider's signed thinking (Anthropic's `signature`,
   * OpenAI's encrypted reasoning), which cannot be reconstructed from the text.
   * Dropping them makes a multi-turn tool call fail on those models.
   *
   * Nothing here reads the contents; they only have to survive the round trip,
   * so they stay untyped rather than modelling every provider's block shapes.
   */
  reasoningDetails?: unknown[];
};

/**
 * Supported image MIME types across all providers
 */
export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

/**
 * Image referenced by URL
 */
export type ImageUrlContent = {
  type: "image_url";
  url: string;
  /** Required hint for Gemini (fileData); optional for other providers */
  mimeType?: ImageMimeType;
  /** OpenAI detail level hint — ignored by other providers */
  detail?: "low" | "high" | "auto";
};

/**
 * Image provided as raw base64-encoded data (no data: URI prefix)
 */
export type ImageBase64Content = {
  type: "image_base64";
  /** Raw base64 string — do not include the `data:<mime>;base64,` prefix */
  data: string;
  mimeType: ImageMimeType;
};

/**
 * Union of all content types
 */
export type MessageContent =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent
  | ImageUrlContent
  | ImageBase64Content;

// =============================================================================
// Provider Metadata
// =============================================================================

/**
 * Anthropic-specific metadata
 */
export type AnthropicMeta = {
  provider: "anthropic";
  cache_control?: { type: "ephemeral" };
};

/**
 * OpenAI-specific metadata
 */
export type OpenAiMeta = {
  provider: "openai";
  call_id?: string; // Used for function_call_output mapping
};

/**
 * Mistral-specific metadata
 */
export type MistralMeta = {
  provider: "mistral";
  tool_call_id?: string;
  tool_name?: string;
};

/**
 * Gemini-specific metadata
 */
export type GeminiMeta = {
  provider: "gemini";
};

/**
 * Ollama-specific metadata
 */
export type OllamaMeta = {
  provider: "ollama";
  tool_call_id?: string;
};

/**
 * llama.cpp-specific metadata
 */
export type LlamaCppMeta = {
  provider: "llamacpp";
  tool_call_id?: string;
};

/**
 * OpenRouter-specific metadata
 */
export type OpenRouterMeta = {
  provider: "openrouter";
  tool_call_id?: string;
};

/**
 * Union of all provider metadata types
 */
export type ProviderMeta =
  | AnthropicMeta
  | OpenAiMeta
  | MistralMeta
  | GeminiMeta
  | OllamaMeta
  | LlamaCppMeta
  | OpenRouterMeta;

// =============================================================================
// History Entry
// =============================================================================

/**
 * Valid roles for history entries
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * A single entry in the conversation history.
 *
 * This is the normalized format that all providers transform to/from.
 *
 * @example Text message
 * ```typescript
 * const entry: HistoryEntry = {
 *   role: "user",
 *   content: [{ type: "text", text: "Hello" }]
 * };
 * ```
 *
 * @example Assistant with tool use
 * ```typescript
 * const entry: HistoryEntry = {
 *   role: "assistant",
 *   content: [
 *     { type: "text", text: "I'll help you with that." },
 *     { type: "tool_use", id: "call_123", name: "get_weather", input: { city: "Paris" } }
 *   ]
 * };
 * ```
 *
 * @example Tool result
 * ```typescript
 * const entry: HistoryEntry = {
 *   role: "user",
 *   content: [{ type: "tool_result", tool_use_id: "call_123", content: "22°C, sunny" }]
 * };
 * ```
 */
export type HistoryEntry = {
  role: MessageRole;
  content: MessageContent[];
  meta?: ProviderMeta;
};

// =============================================================================
// Helper Type Guards
// =============================================================================

export function isTextContent(content: MessageContent): content is TextContent {
  return content.type === "text";
}

export function isToolUseContent(
  content: MessageContent
): content is ToolUseContent {
  return content.type === "tool_use";
}

export function isToolResultContent(
  content: MessageContent
): content is ToolResultContent {
  return content.type === "tool_result";
}

export function isThinkingContent(
  content: MessageContent
): content is ThinkingContent {
  return content.type === "thinking";
}

export function isImageUrlContent(
  content: MessageContent
): content is ImageUrlContent {
  return content.type === "image_url";
}

export function isImageBase64Content(
  content: MessageContent
): content is ImageBase64Content {
  return content.type === "image_base64";
}

export function isImageContent(
  content: MessageContent
): content is ImageUrlContent | ImageBase64Content {
  return content.type === "image_url" || content.type === "image_base64";
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a text content block
 */
export function text(value: string): TextContent {
  return { type: "text", text: value };
}

/**
 * Create a tool use content block
 */
export function toolUse(
  id: string,
  name: string,
  input: Record<string, unknown>,
  thoughtSignature?: string
): ToolUseContent {
  // Only set the key when there is one, so a block stored without a signature
  // serializes exactly as it did before the field existed
  return {
    type: "tool_use",
    id,
    name,
    input,
    ...(thoughtSignature ? { thoughtSignature } : {}),
  };
}

/**
 * Create a thinking content block. Pass `redactedData` for redacted thinking.
 */
export function thinking(
  thinkingText: string,
  signature?: string,
  redactedData?: string,
  reasoningDetails?: unknown[]
): ThinkingContent {
  // As in `toolUse()`, only set the passthrough key when there is something in
  // it, so a block stored without details serializes exactly as it did before
  // the field existed.
  return {
    type: "thinking",
    thinking: thinkingText,
    signature,
    redactedData,
    ...(reasoningDetails && reasoningDetails.length > 0
      ? { reasoningDetails }
      : {}),
  };
}

/**
 * Create a tool result content block
 */
export function toolResult(
  tool_use_id: string,
  content: string,
  is_error?: boolean
): ToolResultContent {
  return { type: "tool_result", tool_use_id, content, is_error };
}

/**
 * Create a simple text message entry
 */
export function textMessage(role: MessageRole, value: string): HistoryEntry {
  return { role, content: [text(value)] };
}

/**
 * Create an image URL content block
 */
export function imageUrl(
  url: string,
  options?: { mimeType?: ImageMimeType; detail?: "low" | "high" | "auto" }
): ImageUrlContent {
  return { type: "image_url", url, ...options };
}

/**
 * Create a base64 image content block
 */
export function imageBase64(
  data: string,
  mimeType: ImageMimeType
): ImageBase64Content {
  return { type: "image_base64", data, mimeType };
}

// =============================================================================
// Plugin System
// =============================================================================

/**
 * Options controlling how history.reduce() compacts stored entries.
 * All fields are optional — supply whichever constraints apply.
 */
export type ReduceOptions = {
  /** Compress/drop entries until total estimated tokens fall below this value. */
  maxTokens?: number;
  /** Compress/drop entries until the entry count falls below this value. */
  maxEntries?: number;
  /** Compress/drop entries whose timestamp predates this date. */
  olderThan?: Date;
};
