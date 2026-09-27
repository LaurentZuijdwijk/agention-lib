/**
 * One tool call the model asked for, in the same shape for every provider.
 *
 * `AgentEvent.TOOL_USE` carries each provider's own payload — Anthropic
 * content blocks, chat-completions `tool_calls`, Responses `function_call`
 * items, Gemini parts — so a listener that wants to know *which tools were
 * called* has to recognise every one of them, and silently misses whichever
 * it does not. `AgentEvent.TOOL_CALLS` carries these instead.
 */
export interface ToolCallInfo {
  /**
   * The id the matching tool result is keyed on. Absent only where the
   * provider has none: Gemini matches results by function name, and a
   * model that omits `functionCall.id` gets no id here either.
   */
  id?: string;
  name: string;
  /** Parsed arguments; the raw string itself when it is not valid JSON. */
  input: unknown;
  /** The arguments as the model produced them, serialized when it produced an object. */
  rawArguments: string;
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Arguments that arrive as a string are kept verbatim; an object is serialized once. */
function fromArguments(args: unknown): { input: unknown; rawArguments: string } {
  if (typeof args === "string") {
    return { input: parseArguments(args), rawArguments: args };
  }
  return { input: args ?? {}, rawArguments: JSON.stringify(args ?? {}) };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Normalizes a `TOOL_USE` payload from any agent in this library.
 *
 * Recognises Anthropic `tool_use` blocks, Responses API `function_call` items,
 * chat-completions tool calls (`{ function: { name, arguments } }`, as sent by
 * OpenRouter, OpenAI-compatible servers, Ollama and Mistral — with `type`
 * optional and `arguments` either a JSON string or an object), and Gemini
 * `functionCall` parts. Anything else in the payload, such as a text block
 * beside Anthropic's tool calls, is not a call and is skipped.
 *
 * `ids` supplies ids for providers that do not send any (Ollama); the agent
 * passes the ones it generated, so a call and its result carry the same id.
 */
export function normalizeToolCalls(
  payload: unknown,
  ids?: readonly string[]
): ToolCallInfo[] {
  if (!Array.isArray(payload)) return [];
  const calls: ToolCallInfo[] = [];
  payload.forEach((item, index) => {
    const block = asRecord(item);
    if (!block) return;
    const suppliedId = ids?.[index];

    if (block.type === "tool_use" && typeof block.name === "string") {
      calls.push({
        id: typeof block.id === "string" ? block.id : suppliedId,
        name: block.name,
        input: block.input ?? {},
        rawArguments: JSON.stringify(block.input ?? {}),
      });
      return;
    }

    if (block.type === "function_call" && typeof block.name === "string") {
      // `call_id` is what a `function_call_output` answers; `id` is the item's
      // own id and matches nothing on the way back.
      const id = typeof block.call_id === "string" ? block.call_id : suppliedId;
      calls.push({ id, name: block.name, ...fromArguments(block.arguments) });
      return;
    }

    const fn = asRecord(block.function);
    if (fn && typeof fn.name === "string") {
      const id = typeof block.id === "string" && block.id ? block.id : suppliedId;
      calls.push({ id, name: fn.name, ...fromArguments(fn.arguments) });
      return;
    }

    const functionCall = asRecord(block.functionCall);
    if (functionCall && typeof functionCall.name === "string") {
      const id = typeof functionCall.id === "string" ? functionCall.id : suppliedId;
      calls.push({ id, name: functionCall.name, ...fromArguments(functionCall.args) });
    }
  });
  return calls;
}
