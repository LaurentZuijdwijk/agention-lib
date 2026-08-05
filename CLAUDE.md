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
- [x] Added explicit OAuth token support to `ClaudeAgent` — new `authType?: "apiKey" | "oauth"` on `ClaudeSpecificConfig`/flat config (default `"apiKey"`). When `"oauth"`, `apiKey` is passed to the Anthropic SDK as `authToken` (bearer) instead of `apiKey` (`x-api-key` header), for OAuth access tokens like Claude Code's `sk-ant-oat...` tokens. Deliberately explicit rather than sniffing the token prefix, since prefixes are an implementation detail.

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
