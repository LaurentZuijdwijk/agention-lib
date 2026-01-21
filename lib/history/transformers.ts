/**
 * Provider Transformers
 *
 * Transform between normalized HistoryEntry format and provider-specific formats.
 */

import type {
  MessageParam,
  ContentBlockParam,
  TextBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
  ContentBlock,
} from "@anthropic-ai/sdk/resources";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import {
  HistoryEntry,
  MessageContent,
  text,
  toolUse,
  toolResult,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
} from "./types";

// =============================================================================
// Anthropic Transformer
// =============================================================================

export const anthropicTransformer = {
  /**
   * Convert normalized entries to Anthropic MessageParam format
   */
  toProvider(entries: HistoryEntry[]): MessageParam[] {
    return entries
      .filter((entry) => entry.role !== "system") // Anthropic handles system separately
      .map((entry): MessageParam => {
        const role = entry.role === "assistant" ? "assistant" : "user";

        // Convert content blocks to Anthropic's ContentBlockParam
        const content: ContentBlockParam[] = entry.content.map((block) => {
          if (isTextContent(block)) {
            return { type: "text", text: block.text } as TextBlockParam;
          }
          if (isToolUseContent(block)) {
            return {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input,
            } as ToolUseBlockParam;
          }
          if (isToolResultContent(block)) {
            return {
              type: "tool_result",
              tool_use_id: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
            } as ToolResultBlockParam;
          }
          throw new Error(
            `Unknown content type: ${(block as MessageContent).type}`
          );
        });

        return { role, content };
      });
  },

  /**
   * Convert Anthropic response content to normalized HistoryEntry
   */
  fromProviderContent(
    role: "user" | "assistant",
    content: ContentBlock[]
  ): HistoryEntry {
    const normalizedContent: MessageContent[] = content.map((block) => {
      if (block.type === "text") {
        return text(block.text);
      }
      if (block.type === "tool_use") {
        return toolUse(
          block.id,
          block.name,
          block.input as Record<string, unknown>
        );
      }
      // Handle thinking blocks or other types as text
      return text(JSON.stringify(block));
    });

    return {
      role,
      content: normalizedContent,
      meta: { provider: "anthropic" },
    };
  },

  /**
   * Extract system message from entries
   */
  getSystemMessage(entries: HistoryEntry[]): string | undefined {
    const systemEntry = entries.find((e) => e.role === "system");
    if (!systemEntry) return undefined;

    return systemEntry.content
      .filter(isTextContent)
      .map((c) => c.text)
      .join("\n");
  },
};

// =============================================================================
// OpenAI Transformer
// =============================================================================

/**
 * Map to track ID conversions from other providers to OpenAI format.
 * OpenAI requires IDs to start with 'fc_' for function calls.
 */
const idMappingToOpenAi = new Map<string, string>();

/**
 * Convert a tool call ID to OpenAI format.
 * OpenAI expects IDs starting with 'fc_'.
 */
function toOpenAiId(originalId: string): string {
  // Already an OpenAI ID
  if (originalId.startsWith("fc_")) {
    return originalId;
  }

  // Check if we've already mapped this ID
  if (idMappingToOpenAi.has(originalId)) {
    return idMappingToOpenAi.get(originalId)!;
  }

  // Generate a new OpenAI-compatible ID and store the mapping
  const newId = `fc_${originalId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  idMappingToOpenAi.set(originalId, newId);
  return newId;
}

export const openAiTransformer = {
  /**
   * Convert normalized entries to OpenAI ResponseInputItem format
   */
  toProvider(entries: HistoryEntry[]): ResponseInputItem[] {
    const items: ResponseInputItem[] = [];

    for (const entry of entries) {
      if (entry.role === "system") {
        items.push({
          type: "message",
          role: "system",
          content: entry.content
            .filter(isTextContent)
            .map((c) => c.text)
            .join("\n"),
        });
        continue;
      }

      // Separate tool_use from other content for OpenAI format
      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);

      // Add text message if present
      if (textBlocks.length > 0 && entry.role !== "user") {
        items.push({
          type: "message",
          role: entry.role as "assistant" | "user",
          content: textBlocks.map((c) => c.text).join("\n"),
        });
      } else if (
        entry.role === "user" &&
        textBlocks.length > 0 &&
        toolResultBlocks.length === 0
      ) {
        items.push({
          type: "message",
          role: "user",
          content: textBlocks.map((c) => c.text).join("\n"),
        });
      }

      // Add tool calls as separate function_call items (OpenAI format)
      // Convert IDs to OpenAI format if they came from another provider
      for (const toolBlock of toolUseBlocks) {
        const openAiId = toOpenAiId(toolBlock.id);
        items.push({
          type: "function_call",
          id: openAiId,
          call_id: openAiId,
          name: toolBlock.name,
          arguments: JSON.stringify(toolBlock.input),
        } as ResponseInputItem);
      }

      // Add tool results as function_call_output items
      // Use the same ID mapping to match results with their calls
      for (const resultBlock of toolResultBlocks) {
        const openAiId = toOpenAiId(resultBlock.tool_use_id);
        items.push({
          type: "function_call_output",
          call_id: openAiId,
          output: resultBlock.content,
        } as ResponseInputItem);
      }
    }

    return items;
  },

  /**
   * Convert OpenAI response to normalized HistoryEntry
   */
  fromProviderMessage(
    role: "assistant" | "user",
    outputText: string,
    functionCalls?: Array<{
      id: string;
      call_id: string;
      name: string;
      arguments: string;
    }>
  ): HistoryEntry {
    const content: MessageContent[] = [];

    if (outputText) {
      content.push(text(outputText));
    }

    if (functionCalls) {
      for (const call of functionCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.arguments);
        } catch {
          input = { raw: call.arguments };
        }
        content.push(toolUse(call.call_id, call.name, input));
      }
    }

    return {
      role,
      content,
      meta: { provider: "openai" },
    };
  },

  /**
   * Create a tool result entry from OpenAI function call output
   */
  toolResultEntry(
    call_id: string,
    output: string,
    is_error?: boolean
  ): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(call_id, output, is_error)],
      meta: { provider: "openai", call_id },
    };
  },
};

// =============================================================================
// Mistral Transformer
// =============================================================================

type MistralMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  name?: string;
  tool_call_id?: string;
};

// Type for Mistral's response message
type MistralResponseMessage = {
  content?: string | null | Array<{ type: string; text?: string } | string>;
  toolCalls?: Array<{
    id?: string;
    function: { name: string; arguments: unknown };
  }> | null;
};

export const mistralTransformer = {
  /**
   * Convert normalized entries to Mistral message format
   */
  toProvider(entries: HistoryEntry[]): MistralMessage[] {
    const messages: MistralMessage[] = [];

    for (const entry of entries) {
      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);

      if (entry.role === "system") {
        messages.push({
          role: "system",
          content: textBlocks.map((c) => c.text).join("\n"),
        });
        continue;
      }

      if (entry.role === "assistant") {
        const msg: MistralMessage = {
          role: "assistant",
          content: textBlocks.map((c) => c.text).join("\n"),
        };

        if (toolUseBlocks.length > 0) {
          msg.tool_calls = toolUseBlocks.map((block) => ({
            id: block.id,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          }));
        }

        messages.push(msg);
        continue;
      }

      // User role - could be text or tool results
      if (toolResultBlocks.length > 0) {
        // Mistral uses separate "tool" role messages for each result
        for (const result of toolResultBlocks) {
          messages.push({
            role: "tool",
            content: result.content,
            tool_call_id: result.tool_use_id,
          });
        }
      } else if (textBlocks.length > 0) {
        messages.push({
          role: "user",
          content: textBlocks.map((c) => c.text).join("\n"),
        });
      }
    }

    return messages;
  },

  /**
   * Convert Mistral response to normalized HistoryEntry
   */
  fromProviderMessage(message: MistralResponseMessage): HistoryEntry {
    const content: MessageContent[] = [];

    // Handle content
    if (typeof message.content === "string" && message.content) {
      content.push(text(message.content));
    } else if (Array.isArray(message.content)) {
      for (const chunk of message.content) {
        if (typeof chunk === "string") {
          content.push(text(chunk));
        } else if (chunk.type === "text" && chunk.text) {
          content.push(text(chunk.text));
        }
      }
    }

    // Handle tool calls
    if (message.toolCalls) {
      for (const call of message.toolCalls) {
        const args =
          typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
        content.push(
          toolUse(
            call.id || "",
            call.function.name,
            args as Record<string, unknown>
          )
        );
      }
    }

    return {
      role: "assistant",
      content,
      meta: { provider: "mistral" },
    };
  },

  /**
   * Create a tool result entry for Mistral
   */
  toolResultEntry(
    tool_call_id: string,
    _name: string,
    output: string
  ): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(tool_call_id, output)],
      meta: { provider: "mistral", tool_call_id },
    };
  },
};
