import type { ToolUseBlock, TextBlock } from "@anthropic-ai/sdk/resources";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import type { ToolCall as MistralToolCall } from "@mistralai/mistralai/models/components";
import type { FunctionCallPart, TextPart } from "@google/generative-ai";
import { normalizeToolCalls, ToolCallInfo } from "./tool-calls";

// Each payload is typed against the SDK it comes from, so the fixtures are the
// providers' real shapes rather than guesses. Jest runs through babel and the
// build excludes specs, so nothing checks those types automatically; after an
// SDK bump, check them with:
//   npx tsc --noEmit --strict --esModuleInterop --skipLibCheck --moduleResolution node \
//     --target es2020 --module commonjs --types jest,node lib/agents/tool-calls.spec.ts

const expected: ToolCallInfo = {
  id: "call_1",
  name: "run_shell",
  input: { command: "ls" },
  rawArguments: '{"command":"ls"}',
};

describe("normalizeToolCalls", () => {
  it("reads Anthropic tool_use blocks and skips the text beside them", () => {
    const text: TextBlock = { type: "text", text: "looking", citations: [] };
    const call: ToolUseBlock = { type: "tool_use", id: "call_1", name: "run_shell", input: { command: "ls" } };
    expect(normalizeToolCalls([text, call])).toEqual([expected]);
  });

  it("reads Responses API function_call items, keyed on call_id", () => {
    const call: ResponseFunctionToolCall = {
      type: "function_call",
      id: "fc_item",
      call_id: "call_1",
      name: "run_shell",
      arguments: '{"command":"ls"}',
    };
    expect(normalizeToolCalls([call])).toEqual([expected]);
  });

  it("reads chat-completions tool calls (OpenRouter, OpenAI-compatible)", () => {
    const call: ChatCompletionMessageFunctionToolCall = {
      id: "call_1",
      type: "function",
      function: { name: "run_shell", arguments: '{"command":"ls"}' },
    };
    expect(normalizeToolCalls([call])).toEqual([expected]);
  });

  it("reads Mistral tool calls, whose type is optional and arguments may be an object", () => {
    const withString: MistralToolCall = { id: "call_1", function: { name: "run_shell", arguments: '{"command":"ls"}' } };
    const withObject: MistralToolCall = { id: "call_1", function: { name: "run_shell", arguments: { command: "ls" } } };
    expect(normalizeToolCalls([withString])).toEqual([expected]);
    expect(normalizeToolCalls([withObject])).toEqual([expected]);
  });

  it("reads Ollama tool calls, taking the ids the agent generated", () => {
    // OllamaAgent's own OllamaToolCall type: no id, no type, object arguments.
    const call = { function: { name: "run_shell", arguments: { command: "ls" } } };
    expect(normalizeToolCalls([call], ["call_1"])).toEqual([expected]);
  });

  it("reads Gemini functionCall parts, which carry no id", () => {
    const text: TextPart = { text: "looking" };
    const call: FunctionCallPart = { functionCall: { name: "run_shell", args: { command: "ls" } } };
    expect(normalizeToolCalls([text, call])).toEqual([{ ...expected, id: undefined }]);
  });

  it("keeps arguments that are not valid JSON as the raw string", () => {
    const [call] = normalizeToolCalls([
      { type: "function_call", call_id: "call_1", name: "run_shell", arguments: "{not json" },
    ]);
    expect(call.input).toBe("{not json");
    expect(call.rawArguments).toBe("{not json");
  });

  it("returns nothing for a payload that is not an array of calls", () => {
    expect(normalizeToolCalls(undefined)).toEqual([]);
    expect(normalizeToolCalls({ name: "run_shell" })).toEqual([]);
    expect(normalizeToolCalls([null, "text", { type: "text", text: "hi" }])).toEqual([]);
  });
});
