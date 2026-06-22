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
  ImageBlockParam,
  ThinkingBlockParam,
  RedactedThinkingBlockParam,
  ContentBlock,
} from "@anthropic-ai/sdk/resources";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import type { Content, Part, FunctionCall } from "@google/generative-ai";

import {
  HistoryEntry,
  MessageContent,
  text,
  toolUse,
  toolResult,
  thinking,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
  isThinkingContent,
  isImageUrlContent,
  isImageBase64Content,
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
          if (isThinkingContent(block)) {
            if (block.redactedData !== undefined) {
              return {
                type: "redacted_thinking",
                data: block.redactedData,
              } as RedactedThinkingBlockParam;
            }
            return {
              type: "thinking",
              thinking: block.thinking,
              signature: block.signature ?? "",
            } as ThinkingBlockParam;
          }
          if (isImageUrlContent(block)) {
            return {
              type: "image",
              source: { type: "url", url: block.url },
            } as ImageBlockParam;
          }
          if (isImageBase64Content(block)) {
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: block.mimeType,
                data: block.data,
              },
            } as ImageBlockParam;
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
      if (block.type === "thinking") {
        return thinking(block.thinking, block.signature);
      }
      if (block.type === "redacted_thinking") {
        return thinking("", undefined, block.data);
      }
      // Unknown / unsupported block — preserve a textual representation
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

      // Separate content blocks by type for OpenAI format
      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);
      const imageUrlBlocks = entry.content.filter(isImageUrlContent);
      const imageBase64Blocks = entry.content.filter(isImageBase64Content);
      const hasImages = imageUrlBlocks.length > 0 || imageBase64Blocks.length > 0;

      // Add text/image message if present
      if (textBlocks.length > 0 && entry.role !== "user") {
        items.push({
          type: "message",
          role: entry.role as "assistant" | "user",
          content: textBlocks.map((c) => c.text).join("\n"),
        });
      } else if (
        entry.role === "user" &&
        (textBlocks.length > 0 || hasImages) &&
        toolResultBlocks.length === 0
      ) {
        if (hasImages) {
          // Mixed content: build an array of content parts
          const parts: Array<{ type: string; text?: string; image_url?: string; detail?: string }> = [];
          for (const block of entry.content) {
            if (isTextContent(block)) {
              parts.push({ type: "input_text", text: block.text });
            } else if (isImageUrlContent(block)) {
              parts.push({
                type: "input_image",
                image_url: block.url,
                ...(block.detail ? { detail: block.detail } : {}),
              });
            } else if (isImageBase64Content(block)) {
              parts.push({
                type: "input_image",
                image_url: `data:${block.mimeType};base64,${block.data}`,
              });
            }
          }
          items.push({
            type: "message",
            role: "user",
            content: parts as any,
          });
        } else {
          items.push({
            type: "message",
            role: "user",
            content: textBlocks.map((c) => c.text).join("\n"),
          });
        }
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
  toolCalls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  name?: string;
  toolCallId?: string;
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
        const contentText = textBlocks.map((c) => c.text).join("\n");
        // When there are tool calls but no text content, content should be null or empty string
        // Some APIs are picky about this
        const content = contentText || (toolUseBlocks.length > 0 ? null : "");
        const msg: MistralMessage = {
          role: "assistant",
          content: content as string,
        };

        if (toolUseBlocks.length > 0) {
          msg.toolCalls = toolUseBlocks.map((block) => ({
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

      // User role - could be text, images, or tool results
      if (toolResultBlocks.length > 0) {
        // Mistral uses separate "tool" role messages for each result
        // We need to find the corresponding tool name from the assistant's tool_calls
        for (const result of toolResultBlocks) {
          // Find the tool name from meta if available
          const toolName = (entry.meta as any)?.tool_name || "";
          messages.push({
            role: "tool",
            content: result.content,
            toolCallId: result.tool_use_id,
            name: toolName,
          });
        }
      } else {
        const imageUrlBlocks = entry.content.filter(isImageUrlContent);
        const imageBase64Blocks = entry.content.filter(isImageBase64Content);
        if (imageBase64Blocks.length > 0) {
          throw new Error(
            "Mistral does not support base64 image inputs. Convert images to URLs before using with MistralAgent."
          );
        }
        if (imageUrlBlocks.length > 0) {
          // Mistral vision: array content with text + image_url parts
          const parts: Array<{ type: string; text?: string; image_url?: string }> = [];
          for (const block of entry.content) {
            if (isTextContent(block)) {
              parts.push({ type: "text", text: block.text });
            } else if (isImageUrlContent(block)) {
              parts.push({ type: "image_url", image_url: block.url });
            }
          }
          messages.push({ role: "user", content: parts as any });
        } else if (textBlocks.length > 0) {
          messages.push({
            role: "user",
            content: textBlocks.map((c) => c.text).join("\n"),
          });
        }
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
    name: string,
    output: string
  ): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(tool_call_id, output)],
      meta: { provider: "mistral", tool_call_id, tool_name: name },
    };
  },
};

// =============================================================================
// Gemini Transformer
// =============================================================================

export const geminiTransformer = {
  /**
   * Convert normalized entries to Gemini Content format
   */
  toProvider(entries: HistoryEntry[]): Content[] {
    const contents: Content[] = [];

    for (const entry of entries) {
      // Skip system messages - Gemini handles these separately via systemInstruction
      if (entry.role === "system") {
        continue;
      }

      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);

      // Gemini uses "user" and "model" roles
      const role = entry.role === "assistant" ? "model" : "user";

      const parts: Part[] = [];

      // Add text parts
      for (const block of textBlocks) {
        parts.push({ text: block.text });
      }

      // Add image parts
      for (const block of entry.content) {
        if (isImageUrlContent(block)) {
          parts.push({
            fileData: {
              mimeType: block.mimeType ?? "image/jpeg",
              fileUri: block.url,
            },
          } as Part);
        } else if (isImageBase64Content(block)) {
          parts.push({
            inlineData: {
              mimeType: block.mimeType,
              data: block.data,
            },
          } as Part);
        }
      }

      // Add function call parts (for assistant/model messages)
      for (const block of toolUseBlocks) {
        parts.push({
          functionCall: {
            name: block.name,
            args: block.input,
          },
        });
      }

      // Add function response parts (for user messages with tool results)
      for (const block of toolResultBlocks) {
        // Parse content if it's JSON, otherwise wrap in response object
        let responseData: object;
        try {
          responseData = JSON.parse(block.content);
        } catch {
          responseData = { result: block.content };
        }

        parts.push({
          functionResponse: {
            name: block.tool_use_id, // Gemini uses the function name, but we store tool_use_id
            response: responseData,
          },
        });
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return contents;
  },

  /**
   * Convert Gemini response parts to normalized HistoryEntry
   */
  fromProviderContent(role: "user" | "assistant", parts: Part[]): HistoryEntry {
    const normalizedContent: MessageContent[] = [];

    for (const part of parts) {
      if ("text" in part && part.text) {
        normalizedContent.push(text(part.text));
      }
      if ("functionCall" in part && part.functionCall) {
        const fc = part.functionCall as FunctionCall;
        normalizedContent.push(
          toolUse(
            fc.name, // Gemini doesn't have separate IDs, use function name
            fc.name,
            (fc.args || {}) as Record<string, unknown>
          )
        );
      }
    }

    return {
      role,
      content: normalizedContent,
      meta: { provider: "gemini" },
    };
  },

  /**
   * Create a tool result entry for Gemini
   */
  toolResultEntry(
    functionName: string,
    output: string,
    is_error?: boolean
  ): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(functionName, output, is_error)],
      meta: { provider: "gemini" },
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
// Ollama Transformer
// =============================================================================

type OllamaMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
};

type OllamaResponseMessage = {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown> | string;
    };
  }>;
};

export const ollamaTransformer = {
  /**
   * Convert normalized entries to Ollama message format.
   * Tool results become role:"tool" messages; tool calls are embedded in assistant messages.
   */
  toProvider(entries: HistoryEntry[]): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    for (const entry of entries) {
      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);

      if (entry.role === "system") {
        messages.push({ role: "system", content: textBlocks.map((c) => c.text).join("\n") });
        continue;
      }

      if (entry.role === "assistant") {
        const msg: OllamaMessage = {
          role: "assistant",
          content: textBlocks.map((c) => c.text).join("\n"),
        };
        if (toolUseBlocks.length > 0) {
          msg.tool_calls = toolUseBlocks.map((block) => ({
            function: {
              name: block.name,
              arguments: block.input,
            },
          }));
        }
        messages.push(msg);
        continue;
      }

      // User role — could be text or tool results
      if (toolResultBlocks.length > 0) {
        for (const result of toolResultBlocks) {
          messages.push({ role: "tool", content: result.content });
        }
      } else if (textBlocks.length > 0) {
        messages.push({ role: "user", content: textBlocks.map((c) => c.text).join("\n") });
      }
    }

    return messages;
  },

  /**
   * Convert Ollama response message to normalized HistoryEntry.
   * generatedIds must supply one ID per tool call (Ollama doesn't return IDs).
   */
  fromProviderMessage(message: OllamaResponseMessage, generatedIds: string[]): HistoryEntry {
    const content: MessageContent[] = [];

    if (typeof message.content === "string" && message.content) {
      content.push(text(message.content));
    }

    if (message.tool_calls) {
      message.tool_calls.forEach((call, idx) => {
        const args =
          typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
        content.push(
          toolUse(generatedIds[idx] ?? `ollama_tool_${idx}`, call.function.name, args as Record<string, unknown>)
        );
      });
    }

    return {
      role: "assistant",
      content,
      meta: { provider: "ollama" },
    };
  },

  /**
   * Create a normalized tool result entry for Ollama
   */
  toolResultEntry(tool_call_id: string, output: string): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(tool_call_id, output)],
      meta: { provider: "ollama", tool_call_id },
    };
  },
};

// =============================================================================
// Chat Completions Transformer (OpenAI-compatible servers, e.g. llama.cpp)
// =============================================================================

/**
 * Convert normalized entries to/from the OpenAI Chat Completions message format
 * (`/v1/chat/completions`). Used by `LlamaCppAgent` and any other agent that
 * targets an OpenAI-compatible chat-completions endpoint.
 */
export const chatCompletionsTransformer = {
  /**
   * Convert normalized entries to Chat Completions message format.
   * Tool results become role:"tool" messages; tool calls are embedded in assistant messages.
   */
  toProvider(entries: HistoryEntry[]): ChatCompletionMessage[] {
    const messages: ChatCompletionMessage[] = [];

    for (const entry of entries) {
      const textBlocks = entry.content.filter(isTextContent);
      const toolUseBlocks = entry.content.filter(isToolUseContent);
      const toolResultBlocks = entry.content.filter(isToolResultContent);
      const imageUrlBlocks = entry.content.filter(isImageUrlContent);
      const imageBase64Blocks = entry.content.filter(isImageBase64Content);
      const hasImages = imageUrlBlocks.length > 0 || imageBase64Blocks.length > 0;

      if (entry.role === "system") {
        messages.push({ role: "system", content: textBlocks.map((c) => c.text).join("\n") });
        continue;
      }

      if (entry.role === "assistant") {
        const msg: Extract<ChatCompletionMessage, { role: "assistant" }> = {
          role: "assistant",
          content: textBlocks.map((c) => c.text).join("\n") || null,
        };
        if (toolUseBlocks.length > 0) {
          msg.tool_calls = toolUseBlocks.map((block) => ({
            id: block.id,
            type: "function" as const,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          }));
        }
        messages.push(msg);
        continue;
      }

      // User role — could be text, images, or tool results
      if (toolResultBlocks.length > 0) {
        for (const result of toolResultBlocks) {
          messages.push({
            role: "tool",
            tool_call_id: result.tool_use_id,
            content: result.content,
          });
        }
      } else if (hasImages) {
        const parts: ChatCompletionContentPart[] = [];
        for (const block of entry.content) {
          if (isTextContent(block)) {
            parts.push({ type: "text", text: block.text });
          } else if (isImageUrlContent(block)) {
            parts.push({
              type: "image_url",
              image_url: {
                url: block.url,
                ...(block.detail ? { detail: block.detail } : {}),
              },
            });
          } else if (isImageBase64Content(block)) {
            parts.push({
              type: "image_url",
              image_url: { url: `data:${block.mimeType};base64,${block.data}` },
            });
          }
        }
        messages.push({ role: "user", content: parts });
      } else if (textBlocks.length > 0) {
        messages.push({ role: "user", content: textBlocks.map((c) => c.text).join("\n") });
      }
    }

    return messages;
  },

  /**
   * Convert a Chat Completions response message to a normalized HistoryEntry.
   */
  fromProviderMessage(message: ChatCompletionResponseMessage): HistoryEntry {
    const content: MessageContent[] = [];

    if (typeof message.content === "string" && message.content) {
      content.push(text(message.content));
    }

    if (message.tool_calls) {
      message.tool_calls.forEach((call) => {
        if (!call.function) return;
        const args = JSON.parse(call.function.arguments || "{}");
        content.push(toolUse(call.id, call.function.name, args as Record<string, unknown>));
      });
    }

    return {
      role: "assistant",
      content,
      meta: { provider: "llamacpp" },
    };
  },

  /**
   * Create a normalized tool result entry for a Chat Completions tool call
   */
  toolResultEntry(tool_call_id: string, output: string): HistoryEntry {
    return {
      role: "user",
      content: [toolResult(tool_call_id, output)],
      meta: { provider: "llamacpp", tool_call_id },
    };
  },
};

type ChatCompletionToolCallParam = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type ChatCompletionContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    };

type ChatCompletionMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatCompletionContentPart[] }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatCompletionToolCallParam[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

type ChatCompletionResponseMessage = {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function?: {
      name: string;
      arguments: string;
    };
  }>;
};
