# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
