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
 * Union of all content types
 */
export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

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
 * Union of all provider metadata types
 */
export type ProviderMeta =
  | AnthropicMeta
  | OpenAiMeta
  | MistralMeta
  | GeminiMeta;

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
  input: Record<string, unknown>
): ToolUseContent {
  return { type: "tool_use", id, name, input };
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
