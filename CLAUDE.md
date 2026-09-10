# Commands for agention-lib

## Build & Development
- `npm run build` - Build project (cleans dist folder then runs TypeScript compiler)
- `npm run watch` - TypeScript compiler in watch mode
- `npm run example` - Run example code
- `npm run docs` - Generate TypeDoc documentation
- `npm run jsdoc` - Generate JSDoc documentation

## Testing
- `npm test` - Run all tests
- `jest <path-to-file>` - Run specific test file (e.g., `jest lib/tools/Tool.spec.ts`)
- `npm run test:watch` - Run tests in watch mode

## Linting & Formatting
- `npm run lint` - Run ESLint on source files
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

## Code Style Guidelines
- **Types**: Use strict typing with explicit return types and interfaces
- **Classes**: PascalCase for classes/interfaces, camelCase for variables/methods
- **Imports**: Group imports by source
- **Documentation**: Write JSDoc comments for classes and methods
- **Error Handling**: Use try/catch with proper error propagation
- **Testing**: Write descriptive test blocks with proper mocking
- **Architecture**: Follow modular approach with base classes and inheritance

---

## Project Architecture

### Core Components

| Component | Location | Description |
|-----------|----------|-------------|
| `BaseAgent` | `lib/agents/BaseAgent.ts` | Abstract foundation for all LLM agents |
| `ClaudeAgent` | `lib/agents/anthropic/ClaudeAgent.ts` | Anthropic Claude implementation |
| `OpenAiAgent` | `lib/agents/openai/OpenAiAgent.ts` | OpenAI implementation (in progress) |
| `CodexAgent` | `lib/agents/openai/CodexAgent.ts` | ChatGPT-subscription OAuth (extends `OpenAiAgent`) |
| `MistralAgent` | `lib/agents/mistral/MistralAgent.ts` | Mistral implementation |
| `Tool` | `lib/tools/Tool.ts` | Tool definition and execution |
| `MCPClient` | `lib/mcp/MCPClient.ts` | MCP server client — wraps MCP tools as `Tool` instances (optional peer: `@modelcontextprotocol/sdk`) |
| `History` | `lib/history/History.ts` | Conversation history management |
| `Team` | `lib/team/Team.ts` | Multi-agent coordination |

### Graph System (`lib/graph/`)

The graph module provides workflow orchestration patterns:

| Executor | Description |
|----------|-------------|
| `SequentialExecutor` | Chains agents, passing output to next |
| `ParallelExecutor` | Runs agents concurrently on same input |
| `Pipeline` | Chains any GraphNodes together |
| `MapExecutor` | Applies processor to each array item |
| `VotingSystem` | Judge selects best from multiple solutions |

**Key interfaces:**
- `GraphNode<TInput, TOutput>` - Base interface with `execute()`, `name`, and `nodeType`
- `GraphNodeType` - Type identifier: `"sequential" | "parallel" | "pipeline" | "map" | "voting" | "agent" | "custom"`

**Metrics & Observability:**
- `MetricsCollector` - Tracks timing, token usage, and pipeline structure
- `NodeExecutionMetrics` - Execution data for each node
- `PipelineMetrics` - Aggregate statistics for full pipeline runs
- Agents expose `lastTokenUsage` for metrics tracking

**Examples:** `examples/graph/` contains working examples for all executor types.

---

## Recent Changes

### Completed
- [x] Graph-based workflow system with 5 executor types
- [x] Metrics and observability (timing, token tracking, structure visualization)
- [x] Fixed filename typos (SequentialExecutor, MapExecutor)
- [x] Added `nodeType` property to all GraphNodes
- [x] Token usage tracking in ClaudeAgent (`lastTokenUsage` property)
- [x] Removed debug console.log statements from agents
- [x] Comprehensive tests for graph executors
- [x] Graph README and working examples
- [x] Moved `lastTokenUsage` to `BaseAgent` base class (all providers inherit it)
- [x] Fixed `BaseAgent.debug` default from `true` to `false`
- [x] Fixed `PlanStore.addStep()` step ID collision (now uses max existing index)
- [x] Fixed `PlanStore.updatePlanStatus()` to treat `skipped` steps as done
- [x] Fixed `PlanExecutor` with `stopOnFailure=true` to drain in-flight promises before throwing
- [x] Multi-provider multimodal support — `ImageUrlContent` / `ImageBase64Content` types, all 4 provider transformers updated, `BaseAgent.addImage()` helper, `execute()` accepts `string | MessageContent[]` on all agents. Fixed missing `system` param on Claude follow-up tool calls.
  - Future: per-image token estimation (currently flat 1000 tokens), `imageCompressionPlugin` for base64 history trimming
- [x] Added `LlamaCppAgent` (`lib/agents/llamacpp/`, vendor `"llamacpp"`, entry point `@agentionai/agents/llamacpp`) — talks to a local `llama-server` via its OpenAI-compatible `/v1/chat/completions` API using the `openai` SDK with a custom `baseURL`. New `chatCompletionsTransformer` in `lib/history/transformers.ts` handles the OpenAI Chat Completions message format (shared target for any OpenAI-compatible local server). Added `LlamaCppModel` type and `LlamaCppSpecificConfig`/`LlamaCppMeta`.
- [x] Added `listModels()` to both `OllamaAgent` (via `client.list()`) and `LlamaCppAgent` (via `client.models.list()` against `/v1/models`) for discovering locally-available models.
- [x] Added support for Anthropic built-in/server-side tools — new `lib/tools/BuiltInTool.ts` defines the `BuiltInTool` passthrough type plus helpers (`webSearchTool`, `bashTool`, `textEditorTool`, `builtInTool`). `ClaudeAgent` accepts them via `builtInTools` (flat config or `vendorConfig.anthropic.builtInTools`), merges them with regular tool definitions via `getAllToolDefinitions()`, and `handleResponse` now extracts text from anywhere in `response.content` (not just index 0) so responses containing `server_tool_use`/`web_search_tool_result` blocks are handled correctly.
- [x] Expanded usage metrics — `TokenUsage` (in `BaseAgent.ts`) now carries `reasoning_tokens`, `timeToFirstTokenMs` ("up"), `generationMs` ("down"), `totalMs`, `inputTokensPerSecond` and `outputTokensPerSecond` alongside the token counts. `lastTokenUsage` moved to `BaseAgent` (it was redeclared on every agent), and the duplicated accumulation blocks were replaced by `accumulateUsage()` / `startTurnTimer()` / `markFirstToken()` / `resetTokenUsage()` helpers there. Timings are measured locally around each API call (streaming agents mark the first token; unstreamed calls only get `totalMs`), and provider-reported timings win where available — Ollama's nanosecond `*_duration` fields and llama.cpp's `timings` object. Reasoning tokens come from OpenAI's `output_tokens_details`/`completion_tokens_details` and Gemini's `thoughtsTokenCount` (which is also folded into `output_tokens` so `input + output === total`). Anthropic and Mistral report no separate reasoning count. Graph/viz metrics still carry counts only. Example: `examples/usage-metrics.ts`
- [x] Fixed reasoning being dropped from history on the OpenAI-compatible path — DeepSeek V4 thinking mode requires the assistant turn's `reasoning_content` to be replayed verbatim or multi-turn tool calls fail with `400`. `chatCompletionsTransformer.fromProviderMessage` now stores inbound `reasoning ?? reasoning_content` as the neutral `thinking()` block, and `toProvider` emits it back as `reasoning_content` (DeepSeek's field name; an accepted alias for `reasoning` on OpenRouter — verified against their docs). Only emitted when thinking text is actually present, so non-reasoning models send a byte-identical request. `OpenAICompatibleAgent.streamTurn` accumulates reasoning deltas alongside text; the non-streaming path needed no change since both funnel through the transformer. Verified end-to-end against a local llama.cpp server (Qwen3.6), including a 3-hop conversation where every tool-calling assistant message carried its own reasoning. Anthropic path untouched.
- [x] Fixed `OpenAiAgent` reasoning configuration — two bugs, one on top of the other:
  - **`disableReasoning` never reached the API in `execute()`** — the conditional spread was immediately overwritten by an unconditional `reasoning: { effort: … }` on the next line, so the flag did nothing on the exact path whose own error message recommends it. The streaming and tool-continuation sites were correct; all three now share a single `buildReasoningParams()` helper so they cannot drift again. Also stops sending `reasoning: {}` when neither option is set.
  - **`effort: null` was never an off switch** — it means *unset*, so the model applies its own default (`medium` on every family before `gpt-5.1`). `disableReasoning` now resolves to the lowest effort the configured model accepts via `lowestReasoningEffort()`: `low` for o-series, `minimal` for the gpt-5 family, `none` for gpt-5.1 → gpt-5.6, and omitted entirely for non-reasoning models (`gpt-4.1-mini` — the agent's own default — rejects `reasoning.effort` outright, so sending one would 400). Every row verified against the live Responses API on 2026-08-05; the families reject each other's minimum, so no single constant works.
  - `reasoningEffort` widened from `"low" | "medium" | "high"` to the full documented enum (`none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`). `"max"` needs a cast at one boundary — the installed SDK's union predates it, though the API accepts it.
  - Verified end-to-end: `disableReasoning` takes reasoning tokens 640 → 0 on `gpt-5-nano` and 68 → 0 on `gpt-5.6-luna`.
- [x] Typed OpenAI reasoning effort per model (`lib/agents/model-types.ts`) — `reasoningEffort` is now narrowed to the set the configured `model` actually accepts, so `reasoningEffort: "none"` on `gpt-5-nano` is a compile error (it takes `minimal`).
  - `OPENAI_REASONING_SUPPORT` is a single `as const` table that both the `ReasoningEffortFor<M>` conditional type and the runtime `lowestReasoningEffort()` read, so the compile-time and runtime views cannot drift. Every row probed against the live Responses API on 2026-08-05 — 7 distinct groups, including `gpt-5-pro` (`high` only) and the `*-pro` variants of 5.2/5.4/5.5 (`medium`/`high`/`xhigh` — they drop the low end rather than extending it).
  - `OpenAiAgent` is now generic (`OpenAiAgent<M extends OpenAIModel = OpenAIModel>`). Backward compatible: the default type argument keeps `new OpenAiAgent({…})` and bare `OpenAiAgent` annotations working, and unknown/newer models fall back to the full `ReasoningEffort` union so a stale table never blocks a new model. Dated snapshots (`gpt-5-nano-2025-08-07`) resolve like their alias at both type and runtime level.
  - `OpenAIModel` refreshed — was missing everything from `gpt-5.1` onward (incl. the current `gpt-5.6` sol/terra/luna) plus `o3`/`o4-mini`/`gpt-4.1-mini`.
  - Type-level assertions live in `lib/agents/model-types.spec.ts` (no `@ts-nocheck`, unlike `OpenAiAgent.spec.ts`) using `@ts-expect-error`, which fails the suite if the narrowing ever stops rejecting a bad combination.
  - **Not done:** the OpenAI-compatible agent (`reasoningEffort` has no equivalent there) — deferred deliberately.
- [x] Hardened `MCPClient` for long-lived production use (`lib/mcp/`) — all additions optional, existing `fromStdio`/`fromUrl`/`connect`/`getTools`/`disconnect` unchanged:
  - **Cancellation & timeouts** — `MCPClientOptions.callOptions` (object or per-call resolver function), `setCallOptions()`, and per-call overrides via the new public `callTool(name, input, options)`. Forwarded to the SDK's `RequestOptions` (`signal`, `timeout`, `resetTimeoutOnProgress`, `maxTotalTimeout`, `onprogress`).
  - **`isError` honoured** — throws `MCPToolError` by default (agents already convert thrown tool errors into `is_error` tool results); `throwOnToolError: false` returns the rendered error content instead.
  - **Non-text content** — new `lib/mcp/content.ts` renders every block in order; binary blocks become descriptive placeholders instead of vanishing, text resources are inlined, unknown block types are JSON-serialised. `formatResult` hook and raw `callTool()` for hosts that want the real blocks.
  - **Connection loss** — `MCPClient` now extends `EventEmitter` (`MCPClientEvent.CONNECTED`/`DISCONNECTED`/`RECONNECTING`/`RECONNECTED`/`TOOLS_CHANGED`/`ERROR`), `getState()`/`isConnected()`, and opt-in `reconnect` with exponential backoff. Calls made during an in-flight reconnect wait for it.
  - **`tools/list_changed`** — subscribes via `setNotificationHandler` and re-runs discovery; `refreshTools()` for manual refresh. `Tool` instance identity is preserved for unchanged definitions so agents holding references keep working.
  - **`authProvider` typed** — `MCPOAuthClientProvider` declared structurally in `lib/mcp/types.ts` rather than imported, so consumers without the optional peer still typecheck; `types.spec.ts` asserts the SDK's `OAuthClientProvider` stays assignable to it. Added `@modelcontextprotocol/sdk` to devDependencies for that assertion.
- [x] `listModels()` on every agent — `ClaudeAgent`, `OpenAiAgent`, `MistralAgent` and `GeminiAgent` now have one, alongside the existing `OllamaAgent` and `OpenAICompatibleAgent` implementations. All six return the same neutral `ModelInfo` type (new, in `BaseAgent.ts`): `id` plus optional `displayName`/`created`/`ownedBy`/`contextLength`, with the provider's untouched entry on a per-provider-typed `raw`. **Breaking for the two existing ones**, which returned raw provider arrays; `m.raw` recovers the old value.
  - Anthropic, OpenAI and Mistral go through their SDK's `models.list()`; Claude's is fully paginated via the SDK's async iterator. Gemini calls `/v1beta/models` with `fetch` because `@google/generative-ai` has no models endpoint at all — it follows `nextPageToken` and strips the `"models/"` prefix so `id` is directly usable as a `model` value. New exported shapes: `GeminiModelCard`, `MistralModelCard`.
  - `BaseAgent.listModels()` throws `ExecutionError` by default, so a custom agent without a models endpoint fails loudly rather than returning an empty list.
  - `ModelInfo.loaded` + `LlamaCppModelCard` — llama.cpp in **model-router mode** lists every model it can serve, each with `status.value: "loaded" | "unloaded"`, and only loaded ones carry `meta`. `LlamaCppAgent` overrides `listModels()` to map that onto `loaded` and to fill `contextLength` from `meta.n_ctx ?? meta.n_ctx_train`. `loaded` is `undefined` (not `false`) on a single-model `llama-server`, which sends no `status` — its one model is by definition loaded. Router-only fields (launch `args`, `preset`, `architecture.input_modalities`, `source`, `can_remove`) are typed on `raw`. Verified against llama.cpp b10148 at `http://192.168.1.249:8080`.
  - Example: `examples/list-models.ts`. Docs: "Listing Available Models" in `docs/guide/agents.md`.
  - Follow-up this enables: check `model-types.ts`'s hand-maintained unions against what the providers actually report.
- [x] Capability data on `ModelInfo` — added `maxOutputTokens`, `capabilities` (`{chat, tools, vision, thinking}`, three-valued: `undefined` = not reported), `deprecatedAt`, `replacedBy`. Filled per provider: Claude `vision`/`thinking`, Mistral `chat`/`tools`/`vision` + deprecation, Gemini `chat`/`thinking`, llama.cpp `vision`; OpenAI and Ollama report nothing.
  - **Fixed: `contextLength` was always undefined on `ClaudeAgent`.** Anthropic's `/v1/models` *does* return `max_input_tokens`, `max_tokens` and a capability tree (thinking, effort levels, image/PDF input, citations, code execution, structured outputs, context management) — none of it in `@anthropic-ai/sdk` 0.71.2's `ModelInfo` type. New `AnthropicModelCard` declares the real shape. `raw.capabilities.effort` gives the live per-model effort levels, i.e. the Anthropic answer to what was hand-probed for OpenAI in `OPENAI_REASONING_SUPPORT`.
  - **Gemini lists retired models** — still advertised with `generateContent`, but calling them 404s with "no longer available to new users". No field distinguishes them and `/v1` lists them too, so `GeminiAgent` carries `GEMINI_RETIRED_MODELS` (exported) and filters them out; `listModels({ includeRetired: true })` opts out. Retirement is permanent, so the list only grows. **Match ids exactly, never by prefix** — `gemini-2.5-flash`/`-pro`/`-flash-lite` are gone while `gemini-2.5-flash-image`, `-preview-tts` and `-computer-use-preview-10-2025` still answer. Confirm new entries by probing `countTokens` (free, 404s identically) across every `generateContent` model; that sweep on 2026-08-11 found exactly those three. Separately, `capabilities.chat` drops never-were-chat models (embeddings/Imagen/Veo/live: 16 of 52).
  - **Mistral's `raw` is lossy** — the SDK zod-parses and strips unknown fields, so wire flags like `capabilities.reasoning` never arrive. Every other agent's `raw` is the untouched response.
- [x] Fixed three provider-level tool-calling bugs, each of which made its provider unusable with a tool belt attached:
  - **OpenAI `strict: true` was unconditional** (`getToolDefinitions()`). Strict mode requires `required` to name every key in `properties`, so one optional parameter 400s the request before the model runs — on every retry, since the belt never changes. New `lib/agents/openai/openai-strict.ts` decides `strict` per tool; it also rejects nested objects, because strict wants `additionalProperties: false` on those and only the top level sets it. Ported from `agention-marshall/packages/engine/src/openai-strict.ts`. Note the existing spec asserted `strict: true` for a tool with an optional param — it had encoded the bug.
  - **Gemini tool results were not Structs.** `functionResponse.response` is a protobuf `Struct`; the transformer's `JSON.parse` fallback only caught parse *failures*, but `JSON.stringify("some text")` parses back to a string rather than throwing, so a bare scalar went out. Fixed in `geminiTransformer.toProvider` (not the agent) so replayed history is covered. Anything non-object is nested under `result`.
  - **Gemini 3 thought signatures were dropped.** Gemini 3 attaches an opaque `thoughtSignature` to every `functionCall` part and rejects any later request that omits it. `ToolUseContent.thoughtSignature` + a 4th `toolUse()` param carry it; the transformer captures and re-emits it, omitting the key entirely when absent so non-thinking paths are byte-identical. The transformer is the only code that touches these parts, so this could not be done in a subclass.
  - Verified live on `gemini-3.5-flash` (a full tool round trip succeeds; the pre-fix transformer fails on the same call). **Free tier is 20 requests/day/model**, so probe sparingly and switch models to get a fresh bucket.
  - Checked and deliberately not done: text parts also carry signatures, but omitting them returns 200, so only function calls are carried. `functionCall.id` is not used as the `tool_use` id — `functionResponse.name` must be the function name, so that would desynchronise the tool_use/tool_result pair.
- [x] Cancellation — `execute(input, { signal })` and `executeStream(input, { signal })` on every agent, with `ExecuteOptions`/`ToolExecuteOptions` and the `isAbortError`/`throwIfAborted`/`combineSignals` helpers in the new `lib/agents/cancellation.ts`, plus an `AbortError` (`name: "AbortError"`, `reason` from the signal) in `errors/AgentError.ts`.
  - Each SDK takes the signal its own way: per-request options on Anthropic/OpenAI/Mistral/OpenAI-compatible, `SingleRequestOptions.signal` on Gemini (client-side only — Google still runs and bills the request), and on Ollama a **per-run client with a wrapped `fetch`**, since the `ollama` package has no per-request options and its `abort()` cancels every streamed request on the client at once. Mistral's inter-call rate-limit `setTimeout` takes the signal too, so an abort does not sit out the delay.
  - The abort branch sits first in each top-level catch and keys off `signal.aborted` before the error's `name`, so an abort still surfaces as `AbortError` after an inner catch has wrapped it in `ExecutionError`. `AgentEvent.ERROR` is emitted with it.
  - **Streaming needed an explicit check**: the Anthropic and OpenAI SDK stream iterators *swallow* the abort and simply stop yielding, so an interrupted stream otherwise looked like a short but complete turn (partial text written to history, `DONE` emitted). Found by running `examples/cancellation.ts` live, not by the mocks. `throwIfAborted` after the stream loop — placed after usage accumulation, so tokens already spent are still reported.
  - Cancellation is checked again just before each tool loop starts, ahead of the assistant turn being written, so a cancelled run leaves no tool call in history without a result to answer it. Tools that were already running record their failure as a normal tool result, which keeps the pair complete either way.
  - `Tool.execute()` takes a 7th `options` argument and passes `{ signal }` to the tool's own `execute` as a 3rd argument; `Tool.fromAgent()` forwards it to the sub-agent and rethrows aborts instead of turning them into a tool result. `MCPClient` tools pass it as a per-call override, beating the client's default `callOptions.signal`.
  - Verified live: Anthropic (all three example cases), OpenAI, Mistral, Gemini and llama.cpp all reject with `AbortError` on schedule. Ollama's path is unit-tested only — the peer dep is not installed here.
  - Example: `examples/cancellation.ts`. Docs: "Cancellation" in `docs/guide/agents.md`.
  - **Not done:** graph executors (`Pipeline`, `SequentialExecutor`, …) and `Team.execute()` still take no signal, so cancelling a whole pipeline means threading it in yourself.
- [x] Added explicit OAuth token support to `ClaudeAgent` — new `authType?: "apiKey" | "oauth"` on `ClaudeSpecificConfig`/flat config (default `"apiKey"`). When `"oauth"`, `apiKey` is passed to the Anthropic SDK as `authToken` (bearer) instead of `apiKey` (`x-api-key` header), for OAuth access tokens like Claude Code's `sk-ant-oat...` tokens. Deliberately explicit rather than sniffing the token prefix, since prefixes are an implementation detail.
- [x] Added `LlamaCppAgent.skipReasoning()` (1.10.0, `model` field fixed in 1.10.1) — POSTs to llama.cpp's proprietary `{baseURL}/chat/completions/control` with `{action: "reasoning_end", id, model}` to end a model's reasoning phase early, mid-stream. Needed `OpenAICompatibleAgent.streamTurn()` to capture each streamed chunk's `id` onto a new protected `lastChunkId` field — internal only, not added to the public `StreamChunk` type since other subclasses (vLLM, LM Studio) don't have this endpoint. No-op if no stream has run yet; fetch failures are logged (`debug`) rather than thrown, since this is a best-effort side channel.
  - **1.10.2**: fixed the control call being silently ignored — `llama-server` only honours `reasoning_end` on completions that opted in via `reasoning_control: true` on the original chat completions request. Without it the server returns 200 with no error, but the model keeps reasoning to completion regardless. `LlamaCppAgent` now overrides `buildExtraRequestParams()` to send `reasoning_control: true` on every request. Verified live against `llama-server` at `http://192.168.1.249:8080` (Qwen3.8-27B, both quantizations loaded) — before the fix, `skipReasoning()` cut nothing (274 reasoning chunks, 443 chars generated after the call); after, it stopped within ~1 chunk (18 chunks total). A direct-`OpenAICompatibleAgent` subclass targeting llama.cpp needs to set this field itself.
  - **1.10.3**: `skipReasoning()` was only checking for a network/HTTP error — llama.cpp's control endpoint instead reports its own rejections (e.g. calling it after the completion already finished) as `{success: false, message}` inside an HTTP 200, so a bad call was going unnoticed even with `debug: true`. Now reads the response body and logs on `!res.ok || body.success === false`. Verified live: calling it with a stale/finished completion id now logs `Failed to signal reasoning_end to llama.cpp: no active completion for this id`.
- [x] Bumped `@openrouter/sdk` 1.2.37 → 1.2.106 (dev + peer dep) after investigating a report of excessive linebreaks in streamed OpenRouter reasoning text. Verified live against several reasoning models (`z-ai/glm-5.3`, `deepseek/deepseek-v4-pro-0813`, `x-ai/grok-4.6`, `google/gemini-3.7-flash`) that the raw `delta.reasoning` SSE chunks are small, correctly incremental fragments — `OpenAICompatibleAgent`/`OpenRouterAgent`'s `reasoningContent += delta` accumulation isn't duplicating or mangling anything. The noisy formatting (GLM-series models in particular emit heavily bulleted chain-of-thought, one point per blank-line-separated bullet; some provider routes streamed it closer to one word per line) comes from the model/provider itself and is inconsistent run-to-run for the same model — confirmed the SDK is pure Speakeasy codegen from OpenRouter's OpenAPI spec (types + wire serialization only), so the version bump doesn't change this behavior; it was still worth taking since we were 69 patch releases behind.
  - Added `lib/agents/reasoning-text.ts` — `collapseReasoningWhitespace(text, options?)`, a **display-only** helper (never apply to the string stored in history / replayed to the provider, which must stay byte-exact). `collapseBlankLines` (default on) squashes 3+ newlines to one blank line; opt-in `collapseLineWraps` merges consecutive non-blank lines into one, skipping any line that starts a markdown block (list item, heading, blockquote) so real structure survives. Exported from `core.ts`/`index.ts`, reaching every entry point (`openrouter.ts`, `openai.ts`, `llamacpp.ts`) that re-exports `./core`.
- [x] Streamed turns are no longer lost when the stream dies — every streaming agent accumulated the turn into function-locals and only wrote it to history after the loop finished cleanly, so a dropped connection, a provider-side SSE error, a `finish_reason: "length"` stop or a consumer that stopped iterating discarded everything generated up to that point. Cheap for a short answer, expensive for a local reasoning model where the trail can be twenty minutes of compute (`OpenAiAgent` was worst: it accumulated nothing at all, rebuilding the turn from `response.completed`, which never arrives on a failure).
  - New `PartialTurn` / `PartialToolCall` / `PartialTurnReason` types in `BaseAgent.ts`, exposed on `BaseAgent.lastPartialTurn`, on `AgentError.partial`, and as `AgentEvent.PARTIAL_TURN`. Carries `text`, `reasoning`, `toolCalls` (arguments likely truncated mid-token), `reason` (`error` / `aborted` / `max_tokens` / `abandoned`), the `error`, and `at`.
  - Each `streamTurn()` wraps its loop in `try/catch/finally` with a `committed` flag set right after `addToHistory()`. The flag is what makes the recursive tool-call hops work: a frame that already committed stays quiet in its `finally`, so the innermost *uncommitted* frame's partial is the one that survives rather than being clobbered by an outer frame's stale accumulators. The `finally` also covers a consumer that `break`s out of the `for await` (generator cleanup), which is `reason: "abandoned"`.
  - **Deliberately not written to history.** An interrupted turn is frequently not replayable — Anthropic thinking blocks need the `signature` that arrives *after* the thinking text (`meta.signatures` reports what was actually received), and truncated tool-call JSON does not parse — so persisting it automatically would turn a recoverable error into a permanently broken conversation. `lastPartialTurn` is cleared at the start of every execution and only set when there is something to recover, so a set value always means unsaved work from the current run.
  - Helpers on `BaseAgent`: `capturePartialTurn()`, `partialTurnReason()`, `resetPartialTurn()`, `withPartialTurn()`.
  - Example: `examples/partial-turn.ts`. Docs: "Recovering an interrupted turn" in `docs/guide/agents.md`. Unit-tested on all four streaming agents (16 new tests).
  - **Verified live** against `deepseek/deepseek-v4-pro-0813` on OpenRouter, on both the native `OpenRouterAgent` path and the `OpenAICompatibleAgent` path (the one llama.cpp/vLLM/DeepSeek use). All four reasons reproduce with a real trail attached and nothing written to history: `abandoned` (206 chars kept), `aborted` (956), `max_tokens` (335), and `error` (98) — the last from a genuine mid-SSE socket drop, induced with a throwaway local proxy that forwards to `openrouter.ai` and destroys the socket after 3 KB. A completed turn leaves `lastPartialTurn` undefined. `AgentEvent.PARTIAL_TURN` fires with the same object the error carries.
  - Note from the live run: on a turn that is cut short, `lastTokenUsage` is usually `undefined` — OpenRouter attaches usage to the final chunk, which by definition never arrives. The `max_tokens` case is the exception (usage arrives before the finish reason is acted on). Pre-existing behaviour, not something the capture changes.
  - **Not done:** the follow-up discussed alongside it — an opt-in `persistPartialOnError` config that writes the partial turn into history (with `meta.partial`), and writing the assistant turn before throwing `MaxTokensExceededError`, where the content is complete and valid rather than truncated mid-stream.
- [x] `CodexAgent` — run agents on a **ChatGPT subscription** instead of a platform API key (1.13.0). New `lib/agents/openai/CodexAgent.ts` (extends `OpenAiAgent`) + `lib/agents/openai/codex-auth.ts`, exported from `index.ts`/`openai.ts`. **Verified live** end-to-end against `gpt-5.6-luna` on a Plus account: `listModels()`, `execute()`, `executeStream()`, a tool round trip, and multi-turn history.
  - **No SDK bump, and no `authType` header switch** — unlike Anthropic (`x-api-key` vs bearer `authToken`), the OpenAI SDK sends *every* credential as `Authorization: Bearer` (`openai/client.js:152`), so an OAuth token authenticates as-is. What differs is the **product surface**: `https://chatgpt.com/backend-api/codex` plus `chatgpt-account-id`, `OpenAI-Beta: responses=experimental`, `originator` and `Accept: text/event-stream` headers.
  - **Why a separate class rather than a flag on `OpenAiAgent`:** the model namespaces are *disjoint*. Every platform id — `gpt-5.6`, `gpt-4.1-mini`, even `gpt-5.1-codex`/`gpt-5-codex` — is rejected with *"model is not supported when using Codex with a ChatGPT account"*. The live catalog is `gpt-6-astra`, `gpt-reserve`, `gpt-5.6-sol/terra/luna`, `gpt-5.5`, `codex-auto-review`. `OpenAIModel` + `OPENAI_REASONING_SUPPORT` typing was therefore actively misleading on this path; `CodexModel`/`CodexReasoningEffort` (`low`–`max`, uniform) replace it.
  - **Five body constraints, each a bare 400:** `instructions` required and non-empty, `input` must be a list, `store: false`, `stream: true`, and **`max_output_tokens` is rejected outright** (so it must be deleted, not left undefined). `transformRequestParams()` hoists the system prompt into `instructions` and strips the duplicate `system` item from `input`; `forceStreaming` makes the two non-streaming call sites stream and rebuild the `Response`.
  - **`response.completed` carries `output: []`.** Content only ever arrives as `response.output_item.done` events — unlike the platform API. This silently broke *both* paths: `execute()` threw "missing output", and `streamTurn()` would have committed an empty assistant turn and dropped every tool call (it reads `response.output` for them). New `repairStreamedOutput()` rebuilds `output`/`output_text` from the collected items; a no-op where `output` is already populated.
  - **Two error-reporting bugs, found only by running it:** (a) `APIError.generate` reads `body.error` and discards the rest (`openai/core/error.js:43`), so this backend's `{"detail": …}` bodies all surfaced as `400 status code (no body)` — new `wrapErrorBodyFetch()` re-nests them (note `globalThis.Response`: this module imports the Responses API's `Response` *type*, which shadows the global class); (b) `OpenAiAgent`'s three catch blocks did `error.error.message` unguarded, turning any such body into `TypeError: Cannot read properties of undefined` — replaced by a shared `describeOpenAIError()`. (b) is pre-existing and affects any non-OpenAI host.
  - `OpenAiAgent` stayed codex-free: it gained generic `baseURL`/`fetch` config, a second type parameter for the models-endpoint card, and three override points (`forceStreaming`, `transformRequestParams`, `resolveApiKey`). Host-specific values are passed *into* `super()` rather than supplied by an override, since the base constructor runs before the subclass's fields exist.
  - **Auth:** `codex login` writes `$CODEX_HOME/auth.json` (`{tokens: {id_token, access_token, refresh_token, account_id}}`); `accountId`/`email`/`planType` fall back to the `id_token`'s `https://api.openai.com/auth` claim. Refresh is `POST https://auth.openai.com/oauth/token` with client id `app_EMoamEEZ73f0CkXaXp7hrann`; the endpoint only sometimes rotates the refresh token. `apiKey` widened to `string | (() => Promise<string>)` — the SDK re-invokes the function per request, which is how a long run outlives the ~1h token. Needs `Omit<BaseAgentConfig, "apiKey">` (an intersection would give `string & (() => …)`).
  - **`listModels()` works here after all** — `/models?client_version=…` (400s without the param). Returns far richer cards than `/v1/models`: `context_window` (272K on Plus) vs `max_context_window` (872K), `supported_reasoning_levels`, `available_in_plans`, `minimal_client_version` — the server hides models newer than the version claimed.
  - **Gotcha worth remembering:** agent history is transient by default (`BaseAgent.ts:312`), so multi-turn only works if you pass a `History`. Cost a debugging detour when the model "forgot" the previous turn — not a Codex bug.
  - **Known gap:** Codex can store credentials in the OS keychain instead of `auth.json` (`cli_auth_credentials_store`); `loadCodexCredentials()` only reads the file.
  - Examples: `examples/openai-oauth.ts`, plus `examples/mock-codex-backend.ts` — a local stand-in enforcing the same five validations, so the example runs with no ChatGPT account. Docs: "ChatGPT Subscription OAuth: `CodexAgent`" in `docs/guide/agents.md`. 63 new tests.
  - **Not done:** no built-in PKCE login flow (`codex login` is the way in); `reasoningEffort` on this backend is typed but not verified live.
- [x] Cache + quota accounting on the OpenAI/Codex path (1.14.0) — `TokenUsage` gained `cache_read_tokens` / `cache_write_tokens` (both **subsets of `input_tokens`**, summed across a turn's calls like the rest; `0` = nothing cached, `undefined` = provider said nothing). `OpenAiAgent.parseUsage()` fills them from `input_tokens_details`, so `CodexAgent` gets them too — the SDK's `ResponseUsage` only declares `cached_tokens`, so the new exported `OpenAIInputTokensDetails` widens it for the Codex-only `cache_write_tokens`. Also added opt-in `promptCacheKey` / `promptCacheRetention` (flat + `vendorConfig.openai`), spread at all three request sites via `buildCacheParams()`; unset by default so requests stay byte-identical.
  - **There is no `cost_usd` on a ChatGPT subscription and there never will be** — it isn't priced per request. What a call spends is plan allowance, which the backend reports as `x-codex-*` headers on every `/responses` call. New `lib/agents/openai/codex-usage.ts` (`CodexUsageLimits`, `CodexRateLimitWindow`, `CodexCredits`, `parseCodexUsageLimits()`, `observeHeadersFetch()`) + `CodexAgent.lastUsageLimits` and `AgentEvent.USAGE_LIMITS`: two rolling windows (`primary` 300 min, `secondary` 10080 min) with `usedPercent`/`resetAt`, plus `planType`, `activeLimit`, `credits`, and `primaryOverSecondaryLimitPercent`.
  - Headers are read by stacking `observeHeadersFetch()` over `wrapErrorBodyFetch()`. The holder-object dance in the constructor is load-bearing: the wrapper must exist before `super()` (which builds the SDK client), so `this` isn't available yet — `limits.notify` is attached after. Note the wrapper closes over whatever `fetch` was at construction, which is why the specs stub `global.fetch` *before* `new CodexAgent(...)` (an earlier version stubbed after and fired real requests at chatgpt.com).
  - `lastUsageLimits` is deliberately **not** reset per run — it describes the account, not the turn. Quota headers only ride on `/responses`: `/models` carries none, and `/usage`, `/rate_limits`, `/limits` all 403, so there is no way to poll without spending a call. They *do* ride on a 429/400, so the error path updates too.
  - **Caching on the Codex backend can't be steered.** Probed live 2026-09-10: a 4000-token prefix repeated 5 times returned `cache_read_tokens: 0` four times and `3840` once; neither `prompt_cache_key` nor echoing the `x-codex-turn-state` header back changed that, and hits appear sporadically regardless (routing, most likely). So the agent tracks caching and does not pretend to control it; `promptCacheKey` is forwarded but has no observed effect there, unlike the platform API.
  - Booleans in those headers are Python-style (`True`/`False`) — a `=== "true"` check reads every one as false.
  - Example: `examples/openai-oauth.ts` (usage section at the end). Docs: "Cache and quota accounting" under `CodexAgent`, plus a rewritten "Token Usage Tracking" with a per-field/per-provider table and a "Prompt caching" subsection. 30 new tests.
  - **Not done:** Anthropic/Gemini/OpenRouter also report cache counts (`cache_read_input_tokens`, `cachedContentTokenCount`, `cache_discount`) and still leave the two new fields undefined — wiring those up is the obvious follow-up.

---

## TODO

### Context Engineering Improvements
These are derived from context engineering research (lost-in-the-middle, U-shaped attention, attention scarcity). Priority order reflects impact.

- [x] **Token-aware history trimming** — `History` now accepts `maxTokens` option; each entry stores `estimatedTokens` (ceil(contentLength/4)); trimming preserves the system message. `AgentConfig.maxHistoryTokens` wires this through to the agent's history. Also fixed: `maxHistoryLength` was stored on `BaseAgent` but never passed to `History` — now both fields are correctly applied at construction time.
- [ ] **Context summarization** — When history must be trimmed, the current FIFO drop discards the oldest entries first — exactly the ones the model attends to most. Implement a `summarize()` strategy that compresses old turns into a single summary entry before dropping them.
- [x] **Fix system message missing from follow-up tool calls** — Fixed: `system: this.history.getSystemMessage()` added to ClaudeAgent follow-up call.
- [ ] **Progressive tool disclosure** — All tool definitions are sent on every API call including follow-up tool-result calls (`ClaudeAgent.ts:298`). With MCP or large tool sets this wastes significant tokens per hop. Send only tools relevant to the current step, or omit tools entirely on follow-up calls when no further tool use is expected.
- [ ] **Long-term / external memory** — History is in-memory only; nothing persists across restarts. Wire the existing `VectorStore` into History retrieval so agents can fetch relevant past context rather than carrying everything in the window.
- [ ] **Context quality / degradation detection** — No mechanism exists to detect adversarial tool results, contradictory information, or excessively noisy responses (context poisoning/distraction). Add at minimum a configurable max-token guard per tool result, especially relevant for MCP integrations where external servers return arbitrary content.

### Architecture Improvements
- [ ] Add retry mechanisms with backoff to executors
- [ ] Add ConditionalExecutor for branching workflows
- [ ] Add context passing through pipeline stages

### Code Quality
- [ ] Reduce use of 'any' types in `Tool.ts` - Replace `Record<string, any>` with proper interfaces
- [ ] Add proper validation - Validate inputs for agents and tools
- [ ] Fix test inconsistencies - Tests in BaseAgent.spec.ts and ClaudeAgent.spec.ts need alignment
- [ ] Complete OpenAI agent implementation
- [ ] Fix `isAgent()` check in PlanExecutor - use `instanceof BaseAgent` instead of duck-typing

### Features to Add
1. **Streaming responses** - Support streaming from LLM APIs
2. **Middleware system** - Add request/response processing hooks
3. **PDF parsing** - Add tools for PDF document processing
4. **Vector DB integration** - Add tools for vector database operations
5. **Graph visualization** - Visual representation of pipeline structure and metrics

### Documentation
- [ ] Expand main README with architecture overview
- [ ] Add JSDoc comments to remaining components

### Testing
- [ ] Increase test coverage for agents
- [ ] Add integration tests for graph pipelines
- [ ] Create consistent mocking strategy for LLM APIs

### DevOps
- [ ] CI/CD pipeline - Add GitHub Actions for testing and deployment
- [ ] Version management - Implement proper semantic versioning
