# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-09

### Added
- **Reasoning tokens and timing in `TokenUsage`** — `agent.lastTokenUsage` now carries,
  alongside the existing token counts:
  - `reasoning_tokens` — reported separately by OpenAI (`output_tokens_details` /
    `completion_tokens_details`) and Gemini (`thoughtsTokenCount`). Always a subset of
    `output_tokens`, never an addition to it. Anthropic and Mistral report no separate
    count, so the field stays absent there.
  - `timeToFirstTokenMs` — request send to first token (prompt upload plus processing).
  - `generationMs` — time generating the response after the first token.
  - `totalMs` — total wall-clock time in provider API calls.
  - `inputTokensPerSecond` / `outputTokensPerSecond` — throughput derived from the above.

  Durations are measured locally around each API call. Streaming (`executeStream()`)
  splits first-token from generation time; an unstreamed call only yields `totalMs`, and
  `outputTokensPerSecond` then falls back to an end-to-end rate. Providers that report
  their own timings take precedence — Ollama's nanosecond `total_duration` /
  `load_duration` / `prompt_eval_duration` / `eval_duration`, and llama.cpp's `timings`
  object (`prompt_ms` / `predicted_ms`). Across a tool-use loop, counts and durations are
  summed and the rates recomputed from those totals. Fields that stay unknown are omitted
  rather than set to `undefined`.
- `examples/usage-metrics.ts` — prints the full metric set for an unstreamed call, a
  streamed call, and a tool loop against a local llama.cpp server.

### Changed
- `lastTokenUsage` now lives on `BaseAgent` instead of being redeclared on each agent,
  along with new protected helpers (`accumulateUsage()`, `startTurnTimer()`,
  `markFirstToken()`, `resetTokenUsage()`) that replace the accumulation block previously
  duplicated across all six agents. Custom agents extending `BaseAgent` should drop their
  own `lastTokenUsage` declaration and call `accumulateUsage()`.
- **Gemini token counts** — `output_tokens` now includes thought tokens. Gemini excludes
  them from `candidatesTokenCount` but counts them in `totalTokenCount`, so
  `input_tokens + output_tokens` previously did not equal `total_tokens` for thinking
  models. Code reading `output_tokens` from a Gemini thinking model will see a larger
  number than before; `reasoning_tokens` reports the thoughts on their own.

### Note
- Graph metrics (`MetricsTokenUsage`) and visualizer payloads (`VizTokenUsage`) still
  carry token counts only; the new fields are agent-level for now.

## [1.1.0] - 2026-08-05

### Added
- `MCPClient` hardened for long-lived, production use (`lib/mcp/`). All additions
  are optional; `fromStdio`/`fromUrl`/`connect`/`getTools`/`disconnect` are
  unchanged.
  - Cancellation and per-call timeouts via `callOptions`, `setCallOptions()`,
    and the new public `callTool()`. Transport-level failures (timeouts,
    aborts) now throw `MCPCallError` with the original error on `.cause`.
  - Tool-level failures (`isError: true`) now throw `MCPToolError` instead of
    being returned as if they'd succeeded, unless `throwOnToolError: false`
    is set, in which case the rendered error content is returned instead.
  - Non-text content (image, audio, resource blocks) is rendered instead of
    silently dropped, with a `formatResult` hook for hosts that want to
    handle raw content blocks themselves (e.g. for multimodal messages).
  - Automatic reconnection with exponential backoff; `MCPClient` is now an
    `EventEmitter` (`connected`/`disconnected`/`reconnecting`/`reconnected`/
    `toolsChanged`/`error`) with `getState()`/`isConnected()`.
  - `tools/list_changed` notifications trigger an automatic refresh; `Tool`
    identity is preserved across refreshes for unchanged definitions.
  - `authProvider` is now structurally typed instead of `unknown`.
- `reasoningEffort` on `OpenAiAgent` widened from `"low" | "medium" | "high"`
  to the full range OpenAI documents (`none`/`minimal`/`low`/`medium`/`high`/
  `xhigh`/`max`), and is now typed per model — e.g. `reasoningEffort: "none"`
  is a compile error on `gpt-5-nano` (which takes `minimal` instead). Values
  are drawn from a verified support table (`OPENAI_REASONING_SUPPORT` in
  `lib/agents/model-types.ts`) covering the o-series, gpt-5.x, and `-pro`
  model families; models outside the table fall back to the full effort
  range so newer models are never blocked.
- `OpenAIModel` refreshed with the previously-missing `gpt-5.1` through
  `gpt-5.6` families (incl. `-pro` variants and the `gpt-5.6-sol`/`-terra`/
  `-luna` split), plus `o1-pro`, `o3`, `o4-mini`, `gpt-4.1-mini`, and
  `gpt-4.1-nano`.

### Fixed
- Reasoning produced by OpenAI-compatible models (llama.cpp, DeepSeek,
  OpenRouter) is now preserved in history and replayed on the next request.
  Previously it was streamed to the caller but dropped before the next API
  call, which caused DeepSeek's thinking mode to reject multi-turn
  tool-calling conversations with `400: The reasoning_content in the
  thinking mode must be passed back to the API`.
- `OpenAiAgent`'s `disableReasoning` flag did nothing in `execute()` — a
  conditional spread was immediately overwritten by an unconditional
  `reasoning` key on the next line. It also previously sent `reasoning: {
  effort: null }`, which is not an "off" switch (the API treats `null` as
  *unset* and falls back to the model's own default); it now resolves to the
  lowest effort the configured model actually accepts.


## [1.0.2] - 2026-08-02

### Changed
- README/docs: added a "Built with Agention" section linking to
  [Marshall](https://marshall.agention.ai/), a coding agent built on this library.
- Bumped dev-dependency versions to resolve `npm audit` advisories (non-breaking
  patch updates only — babel, handlebars/typedoc, brace-expansion, js-yaml,
  linkify-it, lodash, markdown-it, picomatch, postcss, form-data, yaml).

## [1.0.1] - 2026-06-23

### Fixed
- `OpenAICompatibleAgent.executeStream()` now recognises OpenRouter's `delta.reasoning`
  field in addition to the DeepSeek/llama.cpp `delta.reasoning_content` spelling, so
  reasoning models served through OpenRouter (e.g. via `LlamaCppAgent` pointed at the
  OpenRouter endpoint) emit `AgentEvent.REASONING_CHUNK` events and yield
  `{ type: "reasoning" }` chunks instead of silently dropping the chain-of-thought.
  When both fields are present, `reasoning` takes precedence.

## [1.0.0] - 2026-06-22

First stable release. The public API across agents, tools, history, and the graph
system is now considered stable and will follow semantic versioning.

### Added
- **Streaming** — `executeStream()` on `ClaudeAgent`, `OpenAiAgent`, and any
  `OpenAICompatibleAgent` subclass (including `LlamaCppAgent`). Returns an
  `AsyncGenerator<StreamChunk>` where each chunk is `{ type: "text" | "reasoning"; content: string }`.
  Tool calls are handled transparently — the generator continues streaming after each
  round-trip. New `AgentEvent.CHUNK` and `AgentEvent.REASONING_CHUNK` events are emitted
  alongside the existing lifecycle events. `execute()` is unchanged; streaming is purely additive.
- **Reasoning / extended thinking in streams:**
  - `ClaudeAgent` — new `thinkingBudgetTokens` config (flat or `vendorConfig.anthropic`)
    enables Anthropic extended thinking and surfaces thinking tokens as `"reasoning"` chunks.
    Thinking blocks (and their signatures) are preserved across tool-call round-trips as the
    API requires; `temperature`/`topP`/`topK` are omitted while thinking is enabled.
  - `OpenAiAgent` — setting `reasoningEffort` now also requests a reasoning summary, which
    streams as `"reasoning"` chunks for reasoning models (o-series / gpt-5).
  - `OpenAICompatibleAgent` — emits `"reasoning"` chunks for models that return
    `reasoning_content` (e.g. DeepSeek R1).
- First-class reasoning content in normalized history — new `ThinkingContent` type, `thinking()`
  helper, and `isThinkingContent()` guard; `anthropicTransformer` round-trips thinking and
  redacted-thinking blocks.
- `StreamChunk` type exported from `@agentionai/agents` and `@agentionai/agents/llamacpp`.
- `examples/streaming.ts` — demonstrates streaming across all three providers, including
  visible Claude reasoning.

### Fixed
- `ClaudeAgent.executeStream` now re-throws `AgentError` subclasses (e.g.
  `MaxTokensExceededError`) with their type preserved instead of re-wrapping them in a generic
  `ExecutionError`, matching the other streaming agents.

## [0.14.0] - 2026-06-21

### Added
- `OpenAICompatibleAgent` (`lib/agents/openai-compatible/`) — abstract base class for any server exposing an OpenAI-compatible `/v1/chat/completions` API. Subclass it to build typed agents for vLLM, LM Studio, Together AI, Groq, and similar providers. Exported from both `@agentionai/agents` and `@agentionai/agents/llamacpp`.
- `LlamaCppAgent` now extends `OpenAICompatibleAgent`, reducing its implementation to a constructor and a `getVendorName()` override. All behaviour is unchanged.
- `buildExtraRequestParams()` hook on `OpenAICompatibleAgent` — override to inject vendor-specific fields into the completions request (e.g. `reasoning_effort`, routing headers).
- Full test suite for `OpenAICompatibleAgent` (22 tests covering constructor, `listModels`, tool definitions, execute happy paths, tool calls, all error paths, `parseUsage`, and `buildExtraRequestParams`).
- `examples/openai-compatible.ts` — demonstrates `LlamaCppAgent` (zero config) and a custom `VLLMAgent` subclass with tools.
- Docs: new "Custom OpenAI-Compatible Agents" section in the agents guide; README local-models section updated.

### Fixed
- `MaxTokensExceededError` (and other `AgentError` subclasses) thrown inside `handleResponse` are now correctly re-thrown from `execute()` instead of being double-wrapped in `ExecutionError`.

## [0.13.0] - 2026-06-07

### Added
- `LlamaCppAgent` (`lib/agents/llamacpp/`, vendor `"llamacpp"`, entry point `@agentionai/agents/llamacpp`) — talks to a local `llama-server` via its OpenAI-compatible `/v1/chat/completions` API using the `openai` SDK with a custom `baseURL`. Includes `listModels()` for discovering locally-available models.
- `chatCompletionsTransformer` in `lib/history/transformers.ts` — handles the OpenAI Chat Completions message format, the shared target for any OpenAI-compatible local server.
- `lib/tools/BuiltInTool.ts` — passthrough support for Anthropic's server-side/built-in tools (`webSearchTool`, `bashTool`, `textEditorTool`, `builtInTool`). `ClaudeAgent` accepts them via `builtInTools` (flat config or `vendorConfig.anthropic.builtInTools`) and merges them with regular tool definitions.
- `LlamaCppModel` type and `LlamaCppSpecificConfig` / `LlamaCppMeta`.

### Fixed
- `ClaudeAgent.handleResponse` no longer throws on empty-string text blocks or on responses that contain only server-side tool blocks (`server_tool_use` / `web_search_tool_result`) followed by trailing text — it now checks for the presence of text blocks rather than the truthiness of the joined text.
- `chatCompletionsTransformer.toProvider` no longer silently drops image content (`image_url` / `image_base64`) from user messages.
- `ClaudeAgent.handleResponse` now extracts text from anywhere in `response.content` (not just index 0), so responses containing `server_tool_use` / `web_search_tool_result` blocks are handled correctly.

## [0.12.0] - 2026-04-25

### Added
- `OllamaAgent` (`lib/agents/ollama/`) for locally-hosted models via Ollama, including `listModels()` (via `client.list()`).

## [0.11.1] - 2026-04-19

### Added
- `claude-opus-4-7` and `claude-opus-4-6` model types.

## [0.11.0] - 2026-03-10

### Added
- OpenSearch vector store integration and working example.

### Fixed
- `History` trimming is now deferred during an agent's `execute()` loop, preventing premature trimming mid-execution.

## [0.10.1] - 2026-03-10

### Added
- Session anchors — `History.setSessionAnchor()` is now called at the start of every `execute()`, and orphaned tool-call/result pairs are sanitized from history.

### Fixed
- `RedisHistory` options handling.

## [0.10.0] - 2026-03-01

### Added
- Multi-provider multimodal support — `ImageUrlContent` / `ImageBase64Content` types, `BaseAgent.addImage()` helper, and `execute()` accepting `string | MessageContent[]` across all agents, with all provider transformers updated to handle image content.

## [0.9.0] - 2026-02-28

### Added
- History plugin system (`lib/history/plugins/`) — `history.use(plugin)`, `compressionPlugin` (rolling LLM summary) and `toolResultMaskingPlugin` (read-time masking of tool results).
