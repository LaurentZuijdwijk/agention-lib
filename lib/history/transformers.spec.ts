/**
 * Transformer tests — multimodal image content
 */
import {
  anthropicTransformer,
  openAiTransformer,
  mistralTransformer,
  geminiTransformer,
  chatCompletionsTransformer,
  openRouterTransformer,
} from "./transformers";
import { imageUrl, imageBase64, text, thinking, toolUse, toolResult } from "./types";
import type { HistoryEntry } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userWithImage(content: HistoryEntry["content"]): HistoryEntry {
  return { role: "user", content };
}

const URL_ENTRY = userWithImage([
  { type: "text", text: "What's in this image?" },
  imageUrl("https://example.com/photo.jpg", { mimeType: "image/jpeg" }),
]);

const B64_ENTRY = userWithImage([
  { type: "text", text: "Describe this." },
  imageBase64("abc123base64data", "image/png"),
]);

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe("anthropicTransformer — image content", () => {
  it("converts image_url to Anthropic ImageBlockParam (url source)", () => {
    const messages = anthropicTransformer.toProvider([URL_ENTRY]);
    expect(messages).toHaveLength(1);
    const content = messages[0].content as any[];
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "What's in this image?" });
    expect(content[1]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/photo.jpg" },
    });
  });

  it("converts image_base64 to Anthropic ImageBlockParam (base64 source)", () => {
    const messages = anthropicTransformer.toProvider([B64_ENTRY]);
    const content = messages[0].content as any[];
    expect(content[1]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "abc123base64data",
      },
    });
  });
});

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

describe("openAiTransformer — image content", () => {
  it("converts mixed text+image_url to content parts array", () => {
    const items = openAiTransformer.toProvider([URL_ENTRY]) as any[];
    expect(items).toHaveLength(1);
    const parts = items[0].content;
    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0]).toEqual({ type: "input_text", text: "What's in this image?" });
    expect(parts[1]).toEqual({
      type: "input_image",
      image_url: "https://example.com/photo.jpg",
    });
  });

  it("encodes image_base64 as data URI in image_url field", () => {
    const items = openAiTransformer.toProvider([B64_ENTRY]) as any[];
    const parts = items[0].content as any[];
    expect(parts[1]).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,abc123base64data",
    });
  });

  it("preserves detail hint when present", () => {
    const entry = userWithImage([
      imageUrl("https://example.com/photo.jpg", { detail: "high" }),
    ]);
    const items = openAiTransformer.toProvider([entry]) as any[];
    const parts = items[0].content as any[];
    expect(parts[0].detail).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Mistral
// ---------------------------------------------------------------------------

describe("mistralTransformer — image content", () => {
  it("converts image_url to Mistral image_url content part", () => {
    const messages = mistralTransformer.toProvider([URL_ENTRY]) as any[];
    expect(messages).toHaveLength(1);
    const parts = messages[0].content as any[];
    expect(parts).toContainEqual({ type: "text", text: "What's in this image?" });
    expect(parts).toContainEqual({
      type: "image_url",
      image_url: "https://example.com/photo.jpg",
    });
  });

  it("throws for image_base64 inputs", () => {
    expect(() => mistralTransformer.toProvider([B64_ENTRY])).toThrow(
      /Mistral does not support base64/
    );
  });
});

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

describe("geminiTransformer — image content", () => {
  it("converts image_url to fileData part", () => {
    const contents = geminiTransformer.toProvider([URL_ENTRY]) as any[];
    expect(contents).toHaveLength(1);
    const parts = contents[0].parts as any[];
    expect(parts).toContainEqual({ text: "What's in this image?" });
    expect(parts).toContainEqual({
      fileData: { mimeType: "image/jpeg", fileUri: "https://example.com/photo.jpg" },
    });
  });

  it("converts image_base64 to inlineData part", () => {
    const contents = geminiTransformer.toProvider([B64_ENTRY]) as any[];
    const parts = contents[0].parts as any[];
    expect(parts).toContainEqual({
      inlineData: { mimeType: "image/png", data: "abc123base64data" },
    });
  });

  it("uses image/jpeg as default mimeType when not specified for image_url", () => {
    const entry = userWithImage([imageUrl("https://example.com/img.jpg")]);
    const contents = geminiTransformer.toProvider([entry]) as any[];
    const parts = contents[0].parts as any[];
    expect(parts[0].fileData.mimeType).toBe("image/jpeg");
  });
});

// ---------------------------------------------------------------------------
// Chat Completions (OpenAI-compatible servers, e.g. llama.cpp)
// ---------------------------------------------------------------------------

describe("chatCompletionsTransformer — image content", () => {
  it("converts mixed text+image_url to image_url content parts", () => {
    const messages = chatCompletionsTransformer.toProvider([URL_ENTRY]) as any[];
    expect(messages).toHaveLength(1);
    const parts = messages[0].content;
    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0]).toEqual({ type: "text", text: "What's in this image?" });
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: "https://example.com/photo.jpg" },
    });
  });

  it("encodes image_base64 as a data URI inside image_url.url", () => {
    const messages = chatCompletionsTransformer.toProvider([B64_ENTRY]) as any[];
    const parts = messages[0].content as any[];
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,abc123base64data" },
    });
  });

  it("preserves the detail hint when present", () => {
    const entry = userWithImage([
      imageUrl("https://example.com/photo.jpg", { detail: "high" }),
    ]);
    const messages = chatCompletionsTransformer.toProvider([entry]) as any[];
    const parts = messages[0].content as any[];
    expect(parts[0].image_url.detail).toBe("high");
  });

  it("does not silently drop image-only user messages", () => {
    const entry = userWithImage([imageUrl("https://example.com/photo.jpg")]);
    const messages = chatCompletionsTransformer.toProvider([entry]) as any[];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content[0]).toEqual({
      type: "image_url",
      image_url: { url: "https://example.com/photo.jpg" },
    });
  });
});

describe("chatCompletionsTransformer — toProvider", () => {
  it("converts a system entry to a system message", () => {
    const messages = chatCompletionsTransformer.toProvider([
      { role: "system", content: [text("Be concise.")] },
    ]);
    expect(messages).toEqual([{ role: "system", content: "Be concise." }]);
  });

  it("converts a plain user text entry to a user message", () => {
    const messages = chatCompletionsTransformer.toProvider([
      { role: "user", content: [text("Hello there")] },
    ]);
    expect(messages).toEqual([{ role: "user", content: "Hello there" }]);
  });

  it("converts an assistant text entry to an assistant message with no tool_calls", () => {
    const messages = chatCompletionsTransformer.toProvider([
      { role: "assistant", content: [text("Sure, I can help.")] },
    ]) as any[];
    expect(messages).toEqual([
      { role: "assistant", content: "Sure, I can help." },
    ]);
    expect(messages[0].tool_calls).toBeUndefined();
  });

  it("embeds tool_use blocks as tool_calls on the assistant message", () => {
    const messages = chatCompletionsTransformer.toProvider([
      {
        role: "assistant",
        content: [
          text("Let me check the weather."),
          toolUse("call_1", "get_weather", { city: "Paris" }),
        ],
      },
    ]) as any[];
    expect(messages[0]).toEqual({
      role: "assistant",
      content: "Let me check the weather.",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_weather", arguments: JSON.stringify({ city: "Paris" }) },
        },
      ],
    });
  });

  it("emits thinking blocks as reasoning_content on the assistant message", () => {
    const messages = chatCompletionsTransformer.toProvider([
      {
        role: "assistant",
        content: [
          thinking("Paris is in France."),
          text("Let me check the weather."),
          toolUse("call_1", "get_weather", { city: "Paris" }),
        ],
      },
    ]) as any[];

    expect(messages[0].reasoning_content).toBe("Paris is in France.");
    expect(messages[0].content).toBe("Let me check the weather.");
    expect(messages[0].tool_calls).toHaveLength(1);
  });

  it("omits reasoning_content when the assistant entry has no thinking block", () => {
    const messages = chatCompletionsTransformer.toProvider([
      { role: "assistant", content: [text("No reasoning here.")] },
    ]) as any[];

    expect(messages[0]).not.toHaveProperty("reasoning_content");
  });

  it("omits reasoning_content for a redacted-only thinking block", () => {
    // Anthropic redacted blocks carry an opaque payload and no replayable text
    const messages = chatCompletionsTransformer.toProvider([
      { role: "assistant", content: [thinking("", undefined, "redacted-payload"), text("Hi")] },
    ]) as any[];

    expect(messages[0]).not.toHaveProperty("reasoning_content");
  });

  it("uses null content when an assistant tool-call message has no text", () => {
    const messages = chatCompletionsTransformer.toProvider([
      {
        role: "assistant",
        content: [toolUse("call_1", "get_weather", { city: "Paris" })],
      },
    ]) as any[];
    expect(messages[0].content).toBeNull();
    expect(messages[0].tool_calls).toHaveLength(1);
  });

  it("converts tool_result blocks to role:tool messages keyed by tool_use_id", () => {
    const messages = chatCompletionsTransformer.toProvider([
      {
        role: "user",
        content: [
          toolResult("call_1", "22°C, sunny"),
          toolResult("call_2", "Forecast: rain"),
        ],
      },
    ]);
    expect(messages).toEqual([
      { role: "tool", tool_call_id: "call_1", content: "22°C, sunny" },
      { role: "tool", tool_call_id: "call_2", content: "Forecast: rain" },
    ]);
  });
});

describe("chatCompletionsTransformer — fromProviderMessage", () => {
  it("converts a plain text response to a normalized assistant entry", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "The answer is 42.",
    });
    expect(entry).toEqual({
      role: "assistant",
      content: [text("The answer is 42.")],
      meta: { provider: "llamacpp" },
    });
  });

  it("converts tool_calls into normalized tool_use blocks", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          function: { name: "get_weather", arguments: '{"city":"Paris"}' },
        },
      ],
    });
    expect(entry.content).toEqual([
      toolUse("call_1", "get_weather", { city: "Paris" }),
    ]);
    expect(entry.meta).toEqual({ provider: "llamacpp" });
  });

  it("includes both text and tool_use blocks when both are present", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "Checking the weather for you.",
      tool_calls: [
        { id: "call_1", function: { name: "get_weather", arguments: "{}" } },
      ],
    });
    expect(entry.content).toEqual([
      text("Checking the weather for you."),
      toolUse("call_1", "get_weather", {}),
    ]);
  });

  it("stores DeepSeek/llama.cpp reasoning_content as a thinking block", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "42.",
      reasoning_content: "Six times seven.",
    });

    expect(entry.content).toEqual([thinking("Six times seven."), text("42.")]);
  });

  it("stores OpenRouter reasoning as a thinking block", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "42.",
      reasoning: "Six times seven.",
    });

    expect(entry.content).toEqual([thinking("Six times seven."), text("42.")]);
  });

  it("prefers reasoning over reasoning_content when both are present", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "42.",
      reasoning: "OpenRouter",
      reasoning_content: "DeepSeek",
    });

    expect(entry.content).toEqual([thinking("OpenRouter"), text("42.")]);
  });

  it("adds no thinking block when the response carries no reasoning", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: "42.",
      reasoning_content: null,
    });

    expect(entry.content).toEqual([text("42.")]);
  });

  it("round-trips reasoning back out as reasoning_content", () => {
    const entry = chatCompletionsTransformer.fromProviderMessage({
      role: "assistant",
      content: null,
      reasoning_content: "I need the weather tool.",
      tool_calls: [{ id: "call_1", function: { name: "get_weather", arguments: "{}" } }],
    });

    const [message] = chatCompletionsTransformer.toProvider([entry]) as any[];

    expect(message.reasoning_content).toBe("I need the weather tool.");
    expect(message.tool_calls).toHaveLength(1);
  });
});

describe("chatCompletionsTransformer — toolResultEntry", () => {
  it("creates a normalized tool-result entry keyed by tool_call_id", () => {
    const entry = chatCompletionsTransformer.toolResultEntry("call_1", "22°C, sunny");
    expect(entry).toEqual({
      role: "user",
      content: [toolResult("call_1", "22°C, sunny")],
      meta: { provider: "llamacpp", tool_call_id: "call_1" },
    });
  });
});

// ---------------------------------------------------------------------------
// Gemini — functionResponse.response must be a protobuf Struct
//
// Ported from agention-marshall's gemini-tool-response.test.ts. The reported
// bug: a tool returning a plain string is stored as `JSON.stringify(result)`,
// which parses back to a string rather than throwing, so the object fallback
// never fired and a bare scalar went out. Gemini answers 400 with the whole
// tool output quoted back — on the first tool call of any session.
// ---------------------------------------------------------------------------

/** What the agent stores: `JSON.stringify` of whatever the tool returned. */
const asStored = (result: unknown): string => JSON.stringify(result) as string;

/** What the transformer sends as `functionResponse.response`. */
function asSent(stored: string): unknown {
  const entry = geminiTransformer.toolResultEntry("get_weather", stored);
  const [content] = geminiTransformer.toProvider([entry]) as any[];
  return content.parts[0].functionResponse.response;
}

const isStruct = (value: unknown): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("geminiTransformer — tool results are Structs", () => {
  it("wraps a plain string result, which is what most tools return", () => {
    expect(asSent(asStored("d  .changeset\nd  .claude\nf  .env"))).toEqual({
      result: "d  .changeset\nd  .claude\nf  .env",
    });
  });

  it("leaves a result that is already an object alone", () => {
    expect(asSent(asStored({ files: ["a.ts"], truncated: false }))).toEqual({
      files: ["a.ts"],
      truncated: false,
    });
  });

  it("wraps the scalars a JSON parse would otherwise hand back bare", () => {
    expect(asSent(asStored("42"))).toEqual({ result: "42" });
    expect(asSent(asStored(7))).toEqual({ result: 7 });
    expect(asSent(asStored(true))).toEqual({ result: true });
  });

  it("wraps an array, which is valid JSON but not a Struct", () => {
    expect(asSent(asStored(["a", "b"]))).toEqual({ result: ["a", "b"] });
  });

  it("survives a tool that returned nothing at all", () => {
    // JSON.stringify(undefined) is undefined, not a string
    expect(asSent(asStored(undefined))).toEqual({ result: "" });
    expect(asSent(asStored(null))).toEqual({ result: "" });
  });

  it("keeps text that was never JSON in the first place", () => {
    expect(asSent("not json at all")).toEqual({ result: "not json at all" });
  });

  it("always produces something Gemini will accept as a Struct", () => {
    for (const result of ["text", "", 42, true, null, undefined, ["a"], { ok: 1 }]) {
      expect(isStruct(asSent(asStored(result)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Gemini — thought signatures survive the round trip
//
// Gemini 3 attaches an opaque `thoughtSignature` to every functionCall part and
// requires it back on that same part in every later request. Verified against
// the live API: replaying a tool turn without it is rejected with
//   400 "Function call is missing a thought_signature in functionCall parts."
// The transformer is the only place that touches these parts, so a subclass
// cannot carry the field — it has to survive here.
// ---------------------------------------------------------------------------

describe("geminiTransformer — thought signatures", () => {
  const SIGNATURE = "Et0CCtoCARFNMg9xpotCjWgr8rPF+rbSfJaLqutU";

  it("captures the signature from a function call part", () => {
    const entry = geminiTransformer.fromProviderContent("assistant", [
      {
        functionCall: { name: "get_weather", args: { city: "Paris" } },
        thoughtSignature: SIGNATURE,
      },
    ] as any);

    expect(entry.content[0]).toEqual(
      toolUse("get_weather", "get_weather", { city: "Paris" }, SIGNATURE)
    );
  });

  it("emits the signature back on the part it came from", () => {
    const entry: HistoryEntry = {
      role: "assistant",
      content: [
        toolUse("get_weather", "get_weather", { city: "Paris" }, SIGNATURE),
      ],
    };

    const [content] = geminiTransformer.toProvider([entry]) as any[];

    expect(content.parts[0]).toEqual({
      functionCall: { name: "get_weather", args: { city: "Paris" } },
      thoughtSignature: SIGNATURE,
    });
  });

  it("survives a full round trip through history", () => {
    const parts = [
      {
        functionCall: { name: "get_weather", args: { city: "Paris" } },
        thoughtSignature: SIGNATURE,
      },
    ];

    const entry = geminiTransformer.fromProviderContent("assistant", parts as any);
    const [content] = geminiTransformer.toProvider([entry]) as any[];

    expect(content.parts[0].thoughtSignature).toBe(SIGNATURE);
  });

  it("omits the field entirely when there is no signature", () => {
    // Gemini 2.5 and any non-thinking path send none, and an explicit
    // undefined would be a different request body
    const entry: HistoryEntry = {
      role: "assistant",
      content: [toolUse("get_weather", "get_weather", { city: "Paris" })],
    };

    const [content] = geminiTransformer.toProvider([entry]) as any[];

    expect(content.parts[0]).toEqual({
      functionCall: { name: "get_weather", args: { city: "Paris" } },
    });
    expect("thoughtSignature" in content.parts[0]).toBe(false);
  });

  it("keeps each signature with its own call when several come back at once", () => {
    const entry = geminiTransformer.fromProviderContent("assistant", [
      { functionCall: { name: "get_weather", args: { city: "Paris" } }, thoughtSignature: "sig-a" },
      { functionCall: { name: "get_time", args: { tz: "UTC" } }, thoughtSignature: "sig-b" },
    ] as any);

    const [content] = geminiTransformer.toProvider([entry]) as any[];

    expect(content.parts.map((p: any) => p.thoughtSignature)).toEqual([
      "sig-a",
      "sig-b",
    ]);
  });
});

// ---------------------------------------------------------------------------
// OpenRouter — reasoning_details round trip
// ---------------------------------------------------------------------------

/**
 * OpenRouter rebuilds the upstream provider's native thinking blocks from
 * `reasoning_details`. The `reasoning.encrypted` variant carries Anthropic's
 * signature and OpenAI's encrypted reasoning, neither of which can be
 * reconstructed from the plain text — so a turn that drops them fails on the
 * *next* request, not the one that lost them.
 */
describe("openRouterTransformer reasoning details", () => {
  const ENCRYPTED = { type: "reasoning.encrypted", data: "opaque-blob", id: "rd-1" };
  const TEXT_DETAIL = { type: "reasoning.text", text: "step one", signature: "sig-1" };

  it("carries reasoning details from the response back onto the next request", () => {
    const entry = openRouterTransformer.fromProviderMessage({
      role: "assistant",
      content: "Answer",
      reasoning: "step one",
      reasoningDetails: [TEXT_DETAIL, ENCRYPTED],
    } as any);

    const [message] = openRouterTransformer.toProvider([entry]) as any[];

    expect(message.reasoningDetails).toEqual([TEXT_DETAIL, ENCRYPTED]);
    expect(message.reasoning).toBe("step one");
  });

  it("keeps details alongside tool calls, which is where dropping them breaks", () => {
    const entry = openRouterTransformer.fromProviderMessage({
      role: "assistant",
      content: null,
      reasoning: "I should check the weather",
      reasoningDetails: [ENCRYPTED],
      toolCalls: [
        {
          id: "call_1",
          function: { name: "get_weather", arguments: '{"city":"Paris"}' },
        },
      ],
    } as any);

    const [message] = openRouterTransformer.toProvider([entry]) as any[];

    expect(message.reasoningDetails).toEqual([ENCRYPTED]);
    expect(message.toolCalls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "get_weather", arguments: '{"city":"Paris"}' },
      },
    ]);
  });

  it("survives details arriving with no accompanying reasoning text", () => {
    // Anthropic returns redacted thinking this way: opaque payload, no text.
    const entry = openRouterTransformer.fromProviderMessage({
      role: "assistant",
      content: "Answer",
      reasoningDetails: [ENCRYPTED],
    } as any);

    const [message] = openRouterTransformer.toProvider([entry]) as any[];

    expect(message.reasoningDetails).toEqual([ENCRYPTED]);
    expect(message.reasoning).toBeUndefined();
  });

  it("omits the key entirely when the turn carried no reasoning", () => {
    // Non-reasoning models must produce a byte-identical request to before the
    // field existed, so servers that reject unknown keys keep working.
    const entry = openRouterTransformer.fromProviderMessage({
      role: "assistant",
      content: "Plain answer",
    } as any);

    const [message] = openRouterTransformer.toProvider([entry]) as any[];

    expect(message).not.toHaveProperty("reasoningDetails");
    expect(message).not.toHaveProperty("reasoning");
  });

  it("merges details from several thinking blocks in order", () => {
    const entry = {
      role: "assistant" as const,
      content: [
        thinking("first", undefined, undefined, [TEXT_DETAIL]),
        thinking("second", undefined, undefined, [ENCRYPTED]),
        text("Answer"),
      ],
    };

    const [message] = openRouterTransformer.toProvider([entry]) as any[];

    expect(message.reasoningDetails).toEqual([TEXT_DETAIL, ENCRYPTED]);
    expect(message.reasoning).toBe("first\nsecond");
  });
});

describe("openRouterTransformer prompt caching", () => {
  const SYSTEM_ENTRY: HistoryEntry = {
    role: "system",
    content: [{ type: "text", text: "You are a helpful assistant." }],
  };

  it("leaves the system message a plain string when cacheSystemPrompt is not set", () => {
    const [message] = openRouterTransformer.toProvider([SYSTEM_ENTRY]) as any[];
    expect(message.content).toBe("You are a helpful assistant.");
  });

  it("leaves the system message a plain string when cacheSystemPrompt is explicitly false", () => {
    const [message] = openRouterTransformer.toProvider([SYSTEM_ENTRY], {
      cacheSystemPrompt: false,
    }) as any[];
    expect(message.content).toBe("You are a helpful assistant.");
  });

  it("wraps the system message in a cache-marked content block when cacheSystemPrompt is true", () => {
    const [message] = openRouterTransformer.toProvider([SYSTEM_ENTRY], {
      cacheSystemPrompt: true,
    }) as any[];

    expect(message.content).toEqual([
      {
        type: "text",
        text: "You are a helpful assistant.",
        cacheControl: { type: "ephemeral" },
      },
    ]);
  });

  it("does not mark any message when cacheSystemPrompt is unset, even with real history", () => {
    const entries: HistoryEntry[] = [
      SYSTEM_ENTRY,
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    const [systemMsg, userMsg] = openRouterTransformer.toProvider(entries) as any[];

    expect(systemMsg.content).toBe("You are a helpful assistant.");
    expect(userMsg.content).toBe("hi");
  });

  // The system-prompt breakpoint alone only caches the fixed part of a
  // request. An agentic loop's growing tool-call history is not fixed, so a
  // second breakpoint has to land on the *latest* message each turn — that's
  // what makes the next turn's longer-but-still-matching prefix a cache hit
  // instead of paid for again in full. See markLatestCacheBreakpoint's own
  // comment for the mechanics.
  it("marks the latest message too, not just the system prompt", () => {
    const entries: HistoryEntry[] = [
      SYSTEM_ENTRY,
      { role: "user", content: [text("hi")] },
    ];
    const [systemMsg, userMsg] = openRouterTransformer.toProvider(entries, {
      cacheSystemPrompt: true,
    }) as any[];

    expect(systemMsg.content).toEqual([
      { type: "text", text: "You are a helpful assistant.", cacheControl: { type: "ephemeral" } },
    ]);
    expect(userMsg.content).toEqual([
      { type: "text", text: "hi", cacheControl: { type: "ephemeral" } },
    ]);
  });

  it("marks only the latest message in a multi-turn history, not every message", () => {
    const entries: HistoryEntry[] = [
      SYSTEM_ENTRY,
      { role: "user", content: [text("first")] },
      { role: "assistant", content: [text("reply one")] },
      { role: "user", content: [text("second")] },
    ];
    const messages = openRouterTransformer.toProvider(entries, { cacheSystemPrompt: true }) as any[];

    // Marked: the system prompt (always) and the last message (index 3).
    expect(messages[0].content[0].cacheControl).toEqual({ type: "ephemeral" });
    expect(messages[3].content).toEqual([
      { type: "text", text: "second", cacheControl: { type: "ephemeral" } },
    ]);
    // Untouched: everything in between — plain strings, no breakpoint.
    expect(messages[1].content).toBe("first");
    expect(messages[2].content).toBe("reply one");
  });

  it("marks a trailing tool result when that's the latest message", () => {
    const entries: HistoryEntry[] = [
      SYSTEM_ENTRY,
      { role: "user", content: [text("run it")] },
      { role: "assistant", content: [toolUse("call_1", "run_shell", { command: "echo hi" })] },
      { role: "user", content: [toolResult("call_1", "hi\n")] },
    ];
    const messages = openRouterTransformer.toProvider(entries, { cacheSystemPrompt: true }) as any[];

    const toolMsg = messages[messages.length - 1];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.content).toEqual([
      { type: "text", text: "hi\n", cacheControl: { type: "ephemeral" } },
    ]);
  });

  it("falls back to the nearest message with real content when the latest one is a bare tool call", () => {
    // An assistant turn that's purely a tool call has content: null — nothing
    // for a text-block breakpoint to attach to, so this must not throw, and
    // must land on the closest eligible message instead (here, the user
    // turn one entry back) rather than silently marking nothing.
    const entries: HistoryEntry[] = [
      SYSTEM_ENTRY,
      { role: "user", content: [text("run it")] },
      { role: "assistant", content: [toolUse("call_1", "run_shell", { command: "echo hi" })] },
    ];
    const messages = openRouterTransformer.toProvider(entries, { cacheSystemPrompt: true }) as any[];

    const assistantMsg = messages[messages.length - 1];
    expect(assistantMsg.content).toBeNull();
    expect(assistantMsg.toolCalls).toBeDefined();

    const userMsg = messages[messages.length - 2];
    expect(userMsg.content).toEqual([
      { type: "text", text: "run it", cacheControl: { type: "ephemeral" } },
    ]);
  });
});
