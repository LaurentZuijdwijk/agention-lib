# Agents

Agents are the core building block of Agention. Each agent wraps an LLM and provides a consistent interface for running prompts, using tools, and managing conversation history.

## Supported Providers

| Provider | Agent Class | Model Examples |
|----------|-------------|----------------|
| Anthropic | `ClaudeAgent` | `claude-sonnet-4-20250514`, `claude-opus-4-20250514` |
| Google | `GeminiAgent` | `gemini-2.0-flash` |
| OpenAI | `OpenAiAgent` | `gpt-4o`, `gpt-4-turbo` |
| Mistral | `MistralAgent` | `mistral-large-latest`, `mistral-medium` |
| OpenRouter | `OpenRouterAgent` | `anthropic/claude-opus-4-20250514`, `openai/gpt-5.6`, `openrouter/auto` |
| Ollama (local) | `OllamaAgent` | `llama3.2`, `qwen2.5`, `deepseek-r1` |
| llama.cpp (local) | `LlamaCppAgent` | any GGUF model loaded by `llama-server` |

## Installation & Imports

Install only the agents you need:

```bash
# Claude only
npm install @agentionai/agents @anthropic-ai/sdk

# OpenAI only  
npm install @agentionai/agents openai

# Gemini only
npm install @agentionai/agents @google/generative-ai

# Mistral only
npm install @agentionai/agents @mistralai/mistralai

# OpenRouter (one key, many providers)
npm install @agentionai/agents @openrouter/sdk

# Ollama (local — no API key needed, requires Ollama running on your machine)
npm install @agentionai/agents ollama

# llama.cpp (local — no API key needed, requires `llama-server` running on your machine)
npm install @agentionai/agents openai
```

Import using selective imports to avoid installing unnecessary dependencies:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { GeminiAgent } from '@agentionai/agents/gemini';
import { MistralAgent } from '@agentionai/agents/mistral';
import { OpenRouterAgent } from '@agentionai/agents/openrouter';
import { OllamaAgent } from '@agentionai/agents/ollama';
import { LlamaCppAgent } from '@agentionai/agents/llamacpp';
```

## Basic Usage

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5',
});

const response = await agent.execute('Hello!');
```

## Configuration Options

```typescript
const agent = new ClaudeAgent({
  // Required
  id: 'my-agent',                // Unique identifier
  name: 'My Agent',              // Display name for logging/metrics
  description: 'You are...',     // Sets agent behavior (becomes system prompt)
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5',

  // Optional
  tools: [tool1, tool2],         // Available tools
  maxTokens: 4096,               // Max response tokens
  
  // Sampling parameters (all vendors)
  temperature: 0.7,              // Control randomness (0.0-1.0)
  topP: 0.9,                     // Nucleus sampling
  topK: 40,                      // Top-k sampling (Claude, Gemini)
  stopSequences: ['STOP'],       // Custom stop tokens
  
  // Vendor-specific options (optional)
  vendorConfig: {
    anthropic: {
      disableParallelToolUse: false,
      metadata: { userId: 'user-123' }
    }
  }
});
```

## Authentication: API Keys vs. OAuth Tokens (Claude)

By default, `ClaudeAgent` sends `apiKey` to Anthropic as a standard API key (the `x-api-key` header). Anthropic also issues OAuth access tokens (e.g. from Claude Code / Claude.ai — these look like `sk-ant-oat...`), which must be sent differently, as a bearer `authToken`.

Rather than inferring the scheme from the token's prefix (an implementation detail that can change), set `authType` explicitly:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  model: 'claude-sonnet-4-5',
  apiKey: process.env.CLAUDE_OAUTH_TOKEN, // an sk-ant-oat... token
  authType: 'oauth',                      // sent as a bearer authToken instead of x-api-key
});
```

| `authType` | Default | Header sent to Anthropic | Use for |
|---|:---:|---|---|
| `'apiKey'` | ✅ | `x-api-key` | Standard Anthropic API keys (`sk-ant-api...`) |
| `'oauth'` |  | `Authorization: Bearer ...` | OAuth access tokens (`sk-ant-oat...`) |

`authType` can also be set via `vendorConfig.anthropic.authType`.

## Conversation History

By default, agents use **transient history** that clears after each `execute()` call. This saves costs and simplifies history management.

To maintain history across calls, create and pass a `History` object:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { History } from '@agentionai/agents/core';

const history = new History();

const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5',
}, history);

await agent.execute('My name is Alice.');
const response = await agent.execute('What is my name?');
// Agent remembers: "Your name is Alice"
```

Clear history to start fresh:

```typescript
history.clear();
```

::: tip Context management for long-running agents
In production, conversations grow and tool results accumulate. Use the history plugin system to keep the context window lean automatically — no manual trimming needed:

```typescript
import { compressionPlugin, toolResultMaskingPlugin } from '@agentionai/agents/history/plugins';

const maskingPlugin = toolResultMaskingPlugin({ keepRecentResults: 2 });
const history = new History()
  .use(maskingPlugin)
  .use(compressionPlugin(summaryAgent, { autoReduceWhen: { maxTokens: 8000 } }));
```

See [Context Management](/guide/context-management) for a full walkthrough.
:::

See [History Management](/guide/history) for persistence, sharing, and advanced plugin options.

## Using Different Providers

All agents share the same interface, making it easy to switch providers:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
import { MistralAgent } from '@agentionai/agents/mistral';
import { OllamaAgent } from '@agentionai/agents/ollama';

// Same interface, different provider
const claude = new ClaudeAgent({
  id: 'claude',
  name: 'Claude',
  description: 'You are a helpful assistant.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5',
});

const openai = new OpenAiAgent({
  id: 'openai',
  name: 'OpenAI',
  description: 'You are a helpful assistant.',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

const mistral = new MistralAgent({
  id: 'mistral',
  name: 'Mistral',
  description: 'You are a helpful assistant.',
  apiKey: process.env.MISTRAL_API_KEY!,
  model: 'mistral-large-latest',
});

const ollama = new OllamaAgent({
  id: 'ollama',
  name: 'Ollama',
  description: 'You are a helpful assistant.',
  model: 'llama3.2',
  apiKey: '',  // Ollama doesn't require an API key
});

// All work the same way
const response = await claude.execute('Hello');
```

## Listing Available Models

Every agent has `listModels()`, which asks the provider what it currently
offers. This is the live answer, as opposed to the hand-maintained model unions
in `model-types.ts` — useful for populating a model picker, checking that an id
still exists, or discovering which models a local server has loaded.

```typescript
const models = await claude.listModels();

for (const model of models) {
  console.log(model.id, model.displayName);
}

// The id drops straight back into an agent config
const agent = new ClaudeAgent({ ...config, model: models[0].id });
```

The result is the same `ModelInfo` shape on every provider:

| Field | Description |
|-------|-------------|
| `id` | Model identifier — the value you pass as `model` |
| `displayName` | Human-readable name, where the provider reports one |
| `created` | Release or creation date, where the provider reports one |
| `ownedBy` | Owning organisation, where the provider reports one |
| `contextLength` | Maximum input context in tokens, where the provider reports one |
| `maxOutputTokens` | Maximum tokens in a single response, where the provider reports one |
| `capabilities` | `{ chat?, tools?, vision?, thinking? }` — see below |
| `deprecatedAt` / `replacedBy` | Retirement date and successor, where the provider publishes them |
| `loaded` | Whether the model is in memory, on servers that distinguish offered from loaded |
| `raw` | The provider's unmodified entry, typed per provider |

Capability flags are **three-valued**. `true` and `false` are the provider's
answer; `undefined` means it does not report on that capability at all, which is
the common case — no provider covers all four. Filter with `!== false` for "not
known to be unsupported", `=== true` when you need positive confirmation:

```typescript
const models = await agent.listModels();

// Models this agent can actually drive
const usable = models.filter((m) => m.capabilities?.chat !== false);

// Models confirmed to take images
const vision = models.filter((m) => m.capabilities?.vision === true);
```

| Provider | `chat` | `tools` | `vision` | `thinking` |
|---|---|---|---|---|
| Claude | — | — | ✓ | ✓ |
| OpenAI | — | — | — | — |
| Mistral | ✓ | ✓ | ✓ | — |
| OpenRouter | ✓ | ✓ | ✓ | ✓ |
| Gemini | ✓ | — | — | ✓ |
| Ollama | — | — | — | — |
| llama.cpp | — | — | ✓ | — |

Claude reports no `tools` flag because every model the endpoint lists supports
tools — asserting `true` would be inventing data the API does not give, so it
stays undefined. Mistral does report a `reasoning` flag on the wire, but the
installed SDK's schema drops it before this library sees it (see below).

Only `id` is guaranteed — no two providers report the same set of fields:

| Provider | Reports | Notes |
|----------|---------|-------|
| Claude | `displayName`, `created` | Fully paginated; no context window in the response |
| OpenAI | `created`, `ownedBy` | Includes embedding, audio and image models |
| Mistral | `displayName`, `created`, `ownedBy`, `contextLength` | Base and fine-tuned models; `raw.capabilities` has the feature flags |
| OpenRouter | `displayName`, `created`, `contextLength`, `maxOutputTokens` | `raw` is the full `OpenRouterModelCard` — per-token pricing, `supportedParameters`, architecture |
| Gemini | `displayName`, `contextLength` | Direct call to `/v1beta/models`; the `models/` prefix is stripped from `id` |
| Ollama | `displayName`, `created` | `created` is the local `modified_at` — when the model was last pulled |
| llama.cpp | `created`, `ownedBy`, plus `contextLength` and `loaded` in router mode | See [below](#listing-models-on-llama-cpp) |
| Other OpenAI-compatible | `created`, `ownedBy` where the server sends them | Local servers often report nothing but the id |

Anything a provider reports beyond these fields is on `raw`, which is typed to
that provider's own model shape:

```typescript
// Which effort levels each Claude model accepts, straight from the API
const claudeModels = await claude.listModels();
const efforts = claudeModels[0].raw.capabilities?.effort;

// How the llama.cpp router would launch a model
const localModels = await llamacpp.listModels();
console.log(localModels[0].raw.status?.args);
```

`raw` is the provider's untouched response on every agent **except Mistral**,
whose SDK validates the response against a schema and silently drops fields it
does not know — as of `@mistralai/mistralai` 1.13.0 that includes the
`reasoning` and audio capability flags the API actually sends.

Failures — a bad key, an unreachable local server — are wrapped in
`ExecutionError`.

### A listed model is not always a callable model

Google keeps retired models in its listing, fully described and advertising
`generateContent`; calling one fails with `404 — "This model is no longer
available to new users"`. Nothing in the response distinguishes those entries
from live ones, so `GeminiAgent` carries a denylist and drops them:

```typescript
import { GEMINI_RETIRED_MODELS } from '@agentionai/agents/gemini';

await agent.listModels();                          // retired models excluded
await agent.listModels({ includeRetired: true });  // exactly what Google returns
console.log(GEMINI_RETIRED_MODELS);                // what gets dropped, and why
```

Retirement is permanent, so the list only ever grows and no entry ever needs
revisiting. It is also per-model, not per-family: when `gemini-2.5-flash`,
`gemini-2.5-pro` and `gemini-2.5-flash-lite` went, `gemini-2.5-flash-image`,
`gemini-2.5-pro-preview-tts` and `gemini-2.5-computer-use-preview-10-2025`
stayed — which is why ids are matched exactly rather than by prefix. Entries are
confirmed by probing `countTokens`, which is free and fails the same way.

Mistral is the well-behaved counter-example: it publishes `deprecatedAt` and
`replacedBy` ahead of time, so you can see a retirement coming.

## Ollama (Local Models)

`OllamaAgent` runs models locally via [Ollama](https://ollama.com) — no API key or internet connection required.

**Setup:**

```bash
# 1. Install Ollama from https://ollama.com/download

# 2. Pull a model
ollama pull llama3.2        # general use
ollama pull qwen2.5         # recommended for tool use

# 3. Install the npm package
npm install ollama
```

**Basic usage:**

```typescript
import { OllamaAgent } from '@agentionai/agents/ollama';

const agent = new OllamaAgent({
  id: 'local',
  name: 'Local Assistant',
  description: 'You are a helpful assistant.',
  model: 'llama3.2',
  apiKey: '',
});

const response = await agent.execute('What is the capital of France?');
```

**Configuration options specific to Ollama:**

```typescript
const agent = new OllamaAgent({
  id: 'local',
  name: 'Local Assistant',
  description: 'You are a helpful assistant.',
  model: 'qwen2.5',
  apiKey: '',

  // Point to a non-default Ollama server (default: http://localhost:11434)
  host: 'http://my-gpu-box:11434',

  // Enable extended thinking for models that support it (e.g. deepseek-r1)
  think: true,

  // Standard sampling params work too
  temperature: 0.7,
  maxTokens: 2048,
});
```

**Tool use:**

Tool use quality varies by model. `qwen2.5` and `llama3.2` have the best tool-call support:

```typescript
const agent = new OllamaAgent({
  id: 'tool-agent',
  name: 'Tool Agent',
  description: 'You are a helpful assistant.',
  model: 'qwen2.5',
  apiKey: '',
  tools: [myTool],
});
```

**Popular models:**

| Model | Best for |
|-------|----------|
| `llama3.2` | General chat |
| `qwen2.5` | Tool use, coding |
| `deepseek-r1` | Reasoning (use with `think: true`) |
| `mistral` | Instruction following |
| `codellama` | Code generation |

Any model string you have pulled locally is valid — the type allows arbitrary strings while offering autocomplete for common ones.

**Listing available models:**

```typescript
const models = await agent.listModels();
console.log(models.map((m) => m.id));
```

## llama.cpp (Local Models)

`LlamaCppAgent` talks to a locally-running [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) (`llama-server`), which exposes an OpenAI-compatible `/v1/chat/completions` API. It reuses the `openai` package under the hood, pointed at your server's `baseURL`.

**Setup:**

```bash
# 1. Build/install llama.cpp and download a GGUF model

# 2. Start the server (defaults to http://localhost:8080)
llama-server -m ./models/your-model.gguf

# 3. Install the npm package (LlamaCppAgent uses the OpenAI client)
npm install openai
```

**Basic usage:**

```typescript
import { LlamaCppAgent } from '@agentionai/agents/llamacpp';

const agent = new LlamaCppAgent({
  id: 'local',
  name: 'Local Assistant',
  description: 'You are a helpful assistant.',
  apiKey: '',                          // llama.cpp doesn't require an API key
  baseURL: 'http://localhost:8080/v1', // default
});

const response = await agent.execute('What is the capital of France?');
```

### Listing models on llama.cpp

```typescript
const models = await agent.listModels();
console.log(models.map((m) => m.id));
```

Started in **model-router mode**, `llama-server` lists every model it can serve,
not just the one it is running — an unloaded model has to be loaded before it
answers, which takes time and memory. `listModels()` surfaces that as `loaded`,
and fills `contextLength` from the context the model was actually loaded with
(`meta.n_ctx`, falling back to the trained ceiling `n_ctx_train`):

```typescript
const models = await agent.listModels();

const ready = models.filter((m) => m.loaded);
console.log(`${ready.length} of ${models.length} models in memory`);
```

A single-model `llama-server` reports no status, so `loaded` stays `undefined`
there — the one model it lists is by definition the loaded one, and `false`
would be actively misleading.

Everything else llama.cpp reports is on `raw`, typed as `LlamaCppModelCard`:

```typescript
// Only the models that can take an image
const visionModels = models.filter((m) =>
  m.raw.architecture?.input_modalities?.includes('image')
);

// How the router would launch this model, and its quantization
console.log(models[0].raw.status?.args, models[0].raw.meta?.ftype);
```

### Cutting reasoning short

`llama-server` exposes a proprietary control endpoint that can end a reasoning model's thinking phase early, mid-stream, instead of waiting for it to decide to stop on its own. `LlamaCppAgent.skipReasoning()` calls it for you:

```typescript
const stream = agent.executeStream('Solve this step by step: ...');

for await (const chunk of stream) {
  if (chunk.type === 'reasoning' && tookTooLong()) {
    await agent.skipReasoning();
  }
}
```

It targets whichever streamed completion is currently in flight, so call it while iterating `executeStream()`'s output. It's a no-op before the first stream has produced a chunk, and a failure is logged (when `debug: true`) rather than thrown — it's a best-effort side channel to a turn that should otherwise proceed normally. Failure includes both a network/HTTP error and the server's own rejection, which arrives as `{success: false, message: "..."}` inside an HTTP 200 (e.g. calling it after the completion already finished) — `skipReasoning()` checks the response body, not just `res.ok`, to catch that case too. Specific to `LlamaCppAgent`: other `OpenAICompatibleAgent` subclasses (vLLM, LM Studio, Cerebras, …) don't implement this endpoint.

`LlamaCppAgent` sends `reasoning_control: true` on every chat completions request (its `buildExtraRequestParams()`) — without it, `llama-server` silently ignores the `reasoning_end` control call and the model keeps thinking to completion. Nothing to configure; if you subclass `OpenAICompatibleAgent` directly for a llama.cpp server instead of using `LlamaCppAgent`, you'll need to set that field yourself.

## OpenRouter (Multi-Provider Router)

[OpenRouter](https://openrouter.ai) fronts dozens of upstream providers behind one
API key and one chat-completions-compatible endpoint. `OpenRouterAgent` drives it
through the official `@openrouter/sdk`, and adds what that endpoint alone cannot
give you: routing controls, per-run cost reporting, and reasoning that survives
tool calls.

**Setup:**

```bash
npm install @agentionai/agents @openrouter/sdk
```

```typescript
import { OpenRouterAgent } from '@agentionai/agents/openrouter';
```

The SDK is **ESM-only**, so it is loaded through a dynamic import. On CommonJS
that requires Node 20.19+ or 22.12+, where `require()` of an ES module works.

**Basic usage — model ids are prefixed by their upstream provider:**

```typescript
const agent = new OpenRouterAgent({
  id: 'router',
  name: 'Router',
  description: 'You are a helpful assistant.',
  apiKey: process.env.OPENROUTER_API_KEY!,
  model: 'anthropic/claude-opus-4-20250514',
});

const response = await agent.execute('Explain recursion');
```

`model: 'openrouter/auto'` (the default) routes automatically; anything missing
falls back to it.

### Routing control

OpenRouter's reason for existing is *routing* — choosing which upstream provider
serves a request. `vendorConfig.openrouter` (or the equivalent flat fields)
exposes that:

```typescript
const agent = new OpenRouterAgent({
  id: 'router',
  name: 'Router',
  description: 'You are a helpful assistant.',
  apiKey: process.env.OPENROUTER_API_KEY!,
  model: 'deepseek/deepseek-chat-v3:free',
  provider: {
    sort: 'throughput',              // price | throughput | latency | exacto
    // order: ['together', 'fireworks'], // explicit ordered provider slugs
    // only: ['together'],               // restrict to these providers
    // ignore: ['perplexity'],           // skip these providers
    allowFallbacks: true,            // move on when the primary is rate limited
    maxPrice: { prompt: '2', completion: '8' }, // USD per million tokens
    dataCollection: 'deny',          // only providers that don't store prompts
    zdr: true,                       // Zero Data Retention endpoints only
    quantizations: ['fp8'],          // quantization levels to accept
    preferredMaxLatency: 4,          // deprioritize p50 > 4s
    preferredMinThroughput: 100,     // deprioritize p50 < 100 tok/s
  },
});
```

The default `allowFallbacks: true` is what lets the router move past a provider
that is rate limited or down; set `false` when `order` names the only provider
you will accept. `retry` and `retryCodes` tune the client-side backoff policy (the
agent retries `408`/`409`/`429`/`5XX` with a two-minute ceiling, overriding the
SDK's default of `5XX` only and an hour-long loop; pass `{ strategy: 'none' }` to
opt out and handle 429s yourself).

### Fallback models and reasoning

When the primary model cannot serve the request — including a `:free` model's
daily quota — the router tries `models` in order:

```typescript
model: 'deepseek/deepseek-chat-v3:free',
models: ['qwen/qwen3-235b-a22b', 'openai/gpt-5.6'], // tried on failure
```

This is the one throttle that client-side backoff cannot fix. Reasoning models
are configured the same way:

```typescript
reasoning: { effort: 'high' },       // none | minimal | low | medium | high | xhigh | max
```

`reasoning_details` are round-tripped across tool calls, so multi-turn tool use
keeps working on reasoning models whose thinking blocks are signed — the same
guarantee DeepSeek's `reasoning_content` needs on the OpenAI-compatible path.

### Rate limits and retries

OpenRouter returns `429` from two places, and they need different answers.

**Its own platform limits.** `:free` models are capped at 20 requests/minute and
50 requests/day (1000/day once you have purchased $10 of credit). These 429s
carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.

**Upstream provider limits**, passed through. These carry a `Retry-After` header
when every attempted provider gave a retry hint, and no `X-RateLimit-*`.

The agent retries `408`/`409`/`429`/`5XX` with exponential backoff that honours
`Retry-After` and `retry-after-ms`, capped at two minutes total:

```typescript
retry: {
  strategy: 'backoff',
  backoff: {
    initialInterval: 500,
    maxInterval: 30_000,
    exponent: 1.5,
    maxElapsedTime: 120_000,
  },
  retryConnectionErrors: true,
},
retryCodes: ['408', '409', '429', '5XX'],
```

Both are overridable; `retry: { strategy: 'none' }` opts out entirely. These
defaults deliberately replace the SDK's own: `@openrouter/sdk` retries only
`5XX` on `chat.send()`, so a 429 never reaches the backoff it already
implements, and its default `maxElapsedTime` is an hour.

A 429 that outlives the retries throws a `RateLimitError`:

```typescript
import { RateLimitError } from '@agentionai/agents/openrouter';

try {
  await agent.execute('Hello');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.retryAfterMs, error.limit, error.remaining, error.resetAt);
  }
}
```

It extends `ApiError` with `statusCode: 429`, so code that already catches
`ApiError` keeps working. Every field is optional — an upstream 429 carries no
rate-limit headers to fill them from.

Backoff cannot wait out a **daily** quota, whose reset is hours away. Use
fallback `models` for that, and note that a run rejected while a provider is
merely busy is usually better served by `provider.allowFallbacks` than by
waiting.

### Plugins, attribution, and other options

```typescript
plugins: [],             // OpenRouter plugins — web search, file parsing, etc.
sessionId: 'user-42',    // sticky routing — keeps prompt caching hitting
promptCaching: true,     // cache system prompt + tools; OpenRouter translates the marker per backend
user: 'end-user-7',      // stable per-end-user id for abuse isolation
serviceTier: 'priority', // auto | default | fast | flex | priority | scale ('fast' aliases 'priority')
httpReferer: 'https://example.com',  // sent as HTTP-Referer
appTitle: 'My App',                  // sent as X-Title (leaderboards)
disableParallelToolUse: false,
```

### Cost reporting

`lastGeneration` records what OpenRouter reported for the most recent run —
something no other provider in this library exposes:

```typescript
await agent.execute('Hello');

console.log(agent.lastGeneration?.cost, 'credits'); // e.g. 0.0032
console.log(agent.lastGeneration?.model);           // what actually answered
console.log(agent.lastGeneration?.attempts);        // providers tried before success
```

`cost` is summed across the turn's API calls (a tool loop bills once per hop) and
is `undefined` for BYOK requests, which OpenRouter does not price.

The same figure is also on `agent.lastTokenUsage?.cost_usd` — the generic,
cross-provider field, alongside `input_tokens`/`output_tokens`/etc. Use
`lastGeneration` when you also need the generation id, model, or attempt
count; use `lastTokenUsage.cost_usd` for code that shouldn't care which
provider it's running against. Every other provider leaves it `undefined` —
none report cost today.

### Listing available models

`listModels()` follows OpenRouter's pagination and fills the standard fields from
OpenRouter's own metadata — `supportedParameters` and input modalities:

```typescript
const models = await agent.listModels();

const vision = models.filter((m) => m.capabilities?.vision === true);
console.log(models[0].raw.pricing?.prompt); // USD per million prompt tokens
```

### Streaming

`executeStream()` works like the other providers, with tool calls transparently
pausing and resuming the stream. Models that emit reasoning yield `"reasoning"`
chunks without extra config:

```typescript
for await (const chunk of agent.executeStream('What is 17 * 13?')) {
  if (chunk.type === 'text') process.stdout.write(chunk.content);
}
```

## Custom OpenAI-Compatible Agents

`OpenAICompatibleAgent` is the abstract base class that powers `LlamaCppAgent`. Use it directly to build your own typed agent for any server that speaks the OpenAI `/v1/chat/completions` protocol — vLLM, LM Studio, Together AI, Groq, Fireworks, and more.

**Why extend instead of using `LlamaCppAgent`?**

- Give the agent a meaningful vendor name that appears in error messages and metrics
- Add server-specific request parameters (sampling options, routing headers, etc.)
- Narrow the model type to a typed union for your platform
- Keep a clean import path (`@agentionai/agents/llamacpp` exports the base class too)

**Minimal example:**

```typescript
import {
  OpenAICompatibleAgent,
  OpenAICompatibleConfig,
} from '@agentionai/agents/llamacpp';
import { History } from '@agentionai/agents/core';

type VLLMConfig = Omit<OpenAICompatibleConfig, 'baseURL' | 'vendor'> & {
  baseURL?: string;
};

class VLLMAgent extends OpenAICompatibleAgent {
  constructor(config: VLLMConfig, history?: History) {
    super({
      ...config,
      vendor: 'llamacpp',                          // reuse the llamacpp vendor slot
      baseURL: config.baseURL ?? 'http://localhost:8000/v1',
      model: config.model ?? 'default',
    }, history);
  }

  protected getVendorName(): string {
    return 'vLLM';                                 // used in error messages
  }
}

const agent = new VLLMAgent({
  id: 'vllm',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  apiKey: '',  // Local server — no API key needed
});

const response = await agent.execute('What is 2 + 2?');
```

Verified live end-to-end against [Cerebras](https://inference-docs.cerebras.ai/), which speaks the same protocol:

```typescript
class CerebrasAgent extends OpenAICompatibleAgent {
  constructor(config: Omit<OpenAICompatibleConfig, 'baseURL' | 'vendor'>, history?: History) {
    super({
      ...config,
      vendor: 'llamacpp',
      baseURL: 'https://api.cerebras.ai/v1',
      model: config.model ?? 'gpt-oss-120b',
    }, history);
  }

  protected getVendorName(): string {
    return 'Cerebras';
  }
}
```

No special handling needed for Cerebras's reasoning-replay rejection (see [Reasoning](#reasoning) above) — the base class retries and adapts automatically.

**Adding vendor-specific request params:**

Override `buildExtraRequestParams()` to inject fields the OpenAI SDK will merge into the completions call. Useful for sampling options or provider-specific headers your server supports:

```typescript
class GroqAgent extends OpenAICompatibleAgent {
  // ...constructor omitted for brevity...

  protected getVendorName() { return 'Groq'; }

  protected buildExtraRequestParams() {
    return { reasoning_effort: 'default' };       // Groq-specific field
  }
}
```

**Full example:** `examples/openai-compatible.ts`

## Token Usage Tracking

Track token usage for cost monitoring:

```typescript
await agent.execute('Tell me a story');

const usage = agent.lastTokenUsage;
console.log(`Input: ${usage?.input_tokens}, Output: ${usage?.output_tokens}`);
```

## Cancellation

Every agent's `execute()` (and `executeStream()`, where available) takes an optional second argument carrying an `AbortSignal`:

```typescript
import { AbortError } from '@agentionai/agents/core';

const controller = new AbortController();

// Give up on the answer after five seconds
setTimeout(() => controller.abort(), 5_000);

try {
  const answer = await agent.execute('Write a long essay', {
    signal: controller.signal,
  });
} catch (error) {
  if (error instanceof AbortError) {
    console.log('cancelled');
  }
}
```

Aborting:

- **cancels the HTTP request in flight**, on every provider;
- **stops the tool loop** — no further provider call is made, and tools that have not started do not run;
- **rejects with an `AbortError`** (`error.name === "AbortError"`, `error.reason` is whatever you passed to `abort()`), rather than the provider-specific `ApiError` the same failure would otherwise produce;
- **emits `AgentEvent.ERROR`** with that same error, so existing error listeners see it.

The same signal is handed to every tool the run executes, as a third argument to the tool's own `execute`:

```typescript
const searchTool = new Tool({
  name: 'search',
  description: 'Search the web',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
  execute: async (input, _context, options) => {
    const response = await fetch(`https://example.com/?q=${input.q}`, {
      signal: options?.signal,
    });
    return response.json();
  },
});
```

MCP tools do this for you — the run's signal is passed to the MCP call, overriding any default `callOptions.signal` on the client. Sub-agent tools built with `Tool.fromAgent()` forward it to the sub-agent's own `execute()`.

**What history looks like afterwards.** A cancelled run stops before writing an assistant turn whose tool calls it will never answer, so a non-transient agent is left with a history you can execute against again. Turns that completed before the abort are kept.

**Provider notes:**

| Provider | How the signal is applied |
|----------|---------------------------|
| Anthropic, OpenAI, OpenRouter, llama.cpp / OpenAI-compatible | The SDK's per-request `signal` |
| Mistral | The SDK's per-request options — this also cuts short the inter-call rate-limit wait |
| Gemini | `SingleRequestOptions.signal`. Client-side only: Google still runs and bills the request |
| Ollama | The `ollama` package takes no per-request options, so a run with a signal gets its own client whose `fetch` attaches it |

## Streaming

`executeStream()` is available on `ClaudeAgent`, `OpenAiAgent`, `OpenRouterAgent`, and any `OpenAICompatibleAgent` subclass (including `LlamaCppAgent`). It returns an `AsyncGenerator<StreamChunk>` — the same type across all providers:

```typescript
type StreamChunk = {
  type: 'text' | 'reasoning';
  content: string;
};
```

`"text"` chunks are visible output tokens. `"reasoning"` chunks are internal thinking tokens produced by models that expose them (DeepSeek R1 via llama.cpp, Claude with extended thinking enabled, OpenAI o-series reasoning summaries).

**Basic usage:**

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
});

for await (const chunk of agent.executeStream('Explain recursion')) {
  if (chunk.type === 'text') process.stdout.write(chunk.content);
}
console.log('\nTokens:', agent.lastTokenUsage);
```

**Handling reasoning tokens separately:**

```typescript
for await (const chunk of agent.executeStream('What is 17 * 13?')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else {
    process.stderr.write(`[thinking] ${chunk.content}`);
  }
}
```

**Cutting reasoning short on llama.cpp.** `LlamaCppAgent.skipReasoning()` can end the thinking phase early, mid-stream — see [Cutting reasoning short](#cutting-reasoning-short).

**Enabling reasoning.** Reasoning chunks are only produced when the model is configured to emit them — otherwise you get `"text"` chunks only:

```typescript
// Claude — extended thinking. budgetTokens must be ≥ 1024 and < maxTokens.
const claude = new ClaudeAgent({
  id: 'assistant', name: 'Assistant', description: 'You think carefully.',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5',
  maxTokens: 8192,
  thinkingBudgetTokens: 4096,   // turns on thinking + `"reasoning"` chunks
});

// OpenAI — reasoning models (o-series / gpt-5.x). Requesting an effort also
// requests a reasoning summary, which is what streams as `"reasoning"` chunks.
// Accepted values depend on the model — see "Reasoning effort" below.
const openai = new OpenAiAgent({
  id: 'assistant', name: 'Assistant', description: 'You think carefully.',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.6-luna',
  reasoningEffort: 'medium',
});

// llama.cpp / OpenAI-compatible — emitted automatically by models that return
// `reasoning` (OpenRouter) or `reasoning_content` (DeepSeek, llama.cpp).
// No extra config required.
```

**Reasoning is preserved across tool calls.** Providers that require the assistant turn's reasoning to be replayed on the next request get it automatically — Claude's thinking blocks (with their signatures), and `reasoning_content` on the OpenAI-compatible path. The latter matters for DeepSeek's thinking mode, which rejects a multi-turn tool-calling conversation whose reasoning was dropped:

```
400 The reasoning_content in the thinking mode must be passed back to the API
```

Nothing to configure. The field is only sent when the model actually produced reasoning, so non-reasoning models are unaffected.

**Some servers reject it instead.** Cerebras's `/v1/chat/completions` 400s on any message carrying `reasoning_content` at all — the opposite requirement from DeepSeek, on the same OpenAI-compatible path. `OpenAICompatibleAgent` (and therefore any subclass, including `LlamaCppAgent`) handles this automatically: on a 400 where the request actually replayed reasoning, it retries once with the field stripped, and if that fixes it, remembers the result so later turns in the same agent's lifetime skip straight to the working request shape. No configuration or vendor-specific subclass needed — this makes any OpenAI-compatible server usable regardless of which way it disagrees with DeepSeek.

Note that with Claude thinking on, `temperature`/`topP`/`topK` are not sent — the API mandates default sampling.

### Recovering an interrupted turn

Streaming agents accumulate a turn as it arrives and only write it to history once the stream ends cleanly. That is the right default — a half-finished turn is frequently not replayable — but it means a dropped connection, a provider-side error or a token-limit stop would otherwise discard everything generated up to that point. On a local reasoning model that can be twenty minutes of compute.

So whatever was generated is always handed back, on `agent.lastPartialTurn` and on the thrown error's `partial`:

```typescript
try {
  for await (const chunk of agent.executeStream('Prove it rigorously')) {
    process.stdout.write(chunk.content);
  }
} catch (err) {
  const salvaged = agent.lastPartialTurn;   // also: (err as AgentError).partial
  if (salvaged) {
    console.error(`lost the turn after ${salvaged.reasoning.length} chars of reasoning`);
    fs.writeFileSync('trail.md', salvaged.reasoning);
  }
  throw err;
}
```

```typescript
type PartialTurn = {
  text: string;              // assistant text so far
  reasoning: string;         // reasoning/thinking text so far
  toolCalls: PartialToolCall[];  // arguments likely truncated mid-token
  reason: 'error' | 'aborted' | 'max_tokens' | 'abandoned';
  error?: unknown;           // the error that ended it, where one did
  meta?: Record<string, unknown>;
  at: Date;
};
```

`lastPartialTurn` is cleared at the start of every execution and only set when there is something to recover, so a set value always means unsaved work from the current run. The same object is emitted as `AgentEvent.PARTIAL_TURN` if you would rather be pushed it than poll:

```typescript
agent.on(AgentEvent.PARTIAL_TURN, (partial) => archive.write(partial));
```

`reason` says why the turn stopped. `"abandoned"` covers the case where nothing failed at all and the consumer simply stopped iterating (a `break` out of the `for await`) — the generator's cleanup still runs, so the trail is captured there too.

**It is deliberately not written to history.** A partial turn is often not replayable: Anthropic thinking blocks need the `signature` that arrives *after* the thinking text, so an interrupted block has none (`meta.signatures` reports what was received, so you can tell), and truncated tool-call JSON does not parse. Persisting that automatically would turn a recoverable error into a permanently broken conversation, so what to do with the trail is left to you — log it, show it, or feed it back as plain text in the next prompt.

Only the streaming path has this. `execute()` gets the whole turn or an error, with nothing in between.

#### Reasoning effort (OpenAI)

`reasoningEffort` is typed against the model you configured, because **which values a model accepts is model-dependent** — the families reject each other's minimum:

```typescript
new OpenAiAgent({ ...base, model: 'gpt-5-nano',  reasoningEffort: 'minimal' }); // ✅
new OpenAiAgent({ ...base, model: 'gpt-5-nano',  reasoningEffort: 'none' });    // ❌ compile error
new OpenAiAgent({ ...base, model: 'gpt-5.6-sol', reasoningEffort: 'none' });    // ✅
new OpenAiAgent({ ...base, model: 'gpt-5.6-sol', reasoningEffort: 'minimal' }); // ❌ 5.6 dropped it
```

| Model | Accepted efforts |
|-------|------------------|
| `o1`, `o1-pro`, `o3`, `o3-mini`, `o4-mini` | `low` `medium` `high` |
| `gpt-5`, `gpt-5-mini`, `gpt-5-nano` | `minimal` `low` `medium` `high` |
| `gpt-5-pro` | `high` only |
| `gpt-5.1` | `none` `low` `medium` `high` |
| `gpt-5.2`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5` | + `xhigh` |
| `gpt-5.6`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` | + `max` |
| `gpt-5.2-pro`, `gpt-5.4-pro`, `gpt-5.5-pro` | `medium` `high` `xhigh` |

Models not in the table — non-reasoning models, and anything newer than this release — accept the full range, so a stale table never blocks a new model. Dated snapshots (`gpt-5-nano-2025-08-07`) resolve like their alias.

**Turning reasoning off.** There is no universal "off" value, so `disableReasoning` resolves to the lowest effort your model accepts:

```typescript
const agent = new OpenAiAgent({
  id: 'fast', name: 'Fast', description: 'Answers directly.',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.6-luna',
  disableReasoning: true,   // → effort: 'none'  (would be 'minimal' on gpt-5-nano)
});
```

It takes precedence over `reasoningEffort`, and is a no-op on models without reasoning support — the parameter is omitted rather than sent, since models like `gpt-4.1-mini` reject it outright. Note that `o`-series models cannot disable reasoning at all; `low` is the floor.

**Tool calls are transparent** — the generator pauses to execute tools and then continues streaming the follow-up response. No special handling required:

```typescript
const agent = new OpenAiAgent({
  apiKey: process.env.OPENAI_API_KEY,
  id: 'weather',
  name: 'Weather Assistant',
  description: 'A helpful assistant.',
  tools: [getWeatherTool],
});

// Tool calls happen mid-stream; the generator resumes automatically
for await (const chunk of agent.executeStream('Weather in Amsterdam and Paris?')) {
  if (chunk.type === 'text') process.stdout.write(chunk.content);
}
```

**Events emitted during streaming:**

| Event | When |
|-------|------|
| `AgentEvent.BEFORE_EXECUTE` | Before first API call |
| `AgentEvent.CHUNK` | Each text delta |
| `AgentEvent.REASONING_CHUNK` | Each reasoning delta |
| `AgentEvent.TOOL_USE` | When tool calls are detected |
| `AgentEvent.TOOL_ERROR` | When a tool fails |
| `AgentEvent.DONE` | After the final response completes |
| `AgentEvent.ERROR` | On any error |

**Provider support:**

| Agent | Streaming | Reasoning chunks |
|-------|:---------:|:----------------:|
| `ClaudeAgent` | ✅ | ✅ — set `thinkingBudgetTokens` |
| `OpenAiAgent` | ✅ | ✅ — set `reasoningEffort` (reasoning models) |
| `OpenRouterAgent` | ✅ | ✅ — emitted automatically by reasoning models |
| `LlamaCppAgent` | ✅ | ✅ (DeepSeek R1 / `reasoning_content`) |
| `OpenAICompatibleAgent` subclasses | ✅ | ✅ |
| `OllamaAgent` | ❌ | — |
| `MistralAgent` | ❌ | — |
| `GeminiAgent` | ❌ | — |

**`execute()` is unchanged** — streaming is purely additive, no breaking changes.

**Full example:** `examples/streaming.ts`

## Multimodal / Vision

All four providers accept images in a single `execute()` call. Instead of passing a string, pass a `MessageContent[]` array that mixes text and image blocks:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { imageUrl, imageBase64 } from '@agentionai/agents/core';

const agent = new ClaudeAgent({
  id: 'vision',
  name: 'VisionAgent',
  description: 'You analyze images.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-opus-4-6',
});

// Remote image by URL
const response = await agent.execute([
  imageUrl('https://example.com/chart.png'),
  { type: 'text', text: 'Summarize this chart.' },
]);

// Local image as base64
import * as fs from 'fs';
const data = fs.readFileSync('./photo.jpg').toString('base64');
const response2 = await agent.execute([
  imageBase64(data, 'image/jpeg'),
  { type: 'text', text: 'What plant is this?' },
]);
```

**Provider support at a glance:**

| Provider | URL Images | Base64 |
|----------|:----------:|:------:|
| Claude | ✅ | ✅ |
| OpenAI | ✅ | ✅ |
| Gemini | ✅ | ✅ |
| Mistral | ✅ | ❌ |
| OpenRouter | ✅ | ✅ |
| Ollama | ❌ | ❌ |

[Full multimodal guide →](/guide/multimodal)

## Why are agents important?

Creating agent workflows allows us to build very advanced features and very powerful models instead of relying on vendor features and lock in. 

One example is custom reasoning workflows by combining agents with specific roles. This gives you full control over the reasoning process, unlike built-in model reasoning.

### Using Agents as Reasoning Tools

You can wrap specialized "reasoner" agents as tools for other agents, creating sophisticated multi-stage thinking:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { Tool } from '@agentionai/agents/core';

// Create a specialized reasoning agent
const reasoner = new ClaudeAgent({
  id: 'reasoner',
  name: 'Analytical Reasoner',
  description: `You are an analytical reasoning specialist. Break down complex 
questions into parts, identify assumptions, and evaluate different approaches.`,
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-4-5', // Fast, efficient model for analysis
  maxTokens: 2048,
});

// Wrap the reasoner as a tool
const reasoningTool = Tool.fromAgent(
  reasoner,
  'Use this to analyze complex questions and break them down systematically.'
);

// Main agent uses the reasoner when needed
const mainAgent = new ClaudeAgent({
  id: 'coordinator',
  name: 'Coordinator',
  description: 'You coordinate analysis and provide clear answers.',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5',
  tools: [reasoningTool],
});

const response = await mainAgent.execute('Explain quantum entanglement');
// Main agent can invoke the reasoner for analytical thinking
```

### Benefits of Hand-Tailored Reasoning

- **Full Control**: You decide when and how reasoning happens
- **Transparency**: See each step of the reasoning process
- **Cost Efficiency**: Use smaller models for specific reasoning tasks
- **Composability**: Chain multiple specialized agents together
- **Flexibility**: Mix different providers and models for optimal results


### OpenAI Reasoning Models

OpenAI offers models with built-in extended thinking (o1, gpt-5-nano). These use "reasoning tokens" for internal chain-of-thought before generating responses.

**Key considerations:**

- **4o models (recommended for most cases)**: `gpt-4o`, `gpt-4o-mini` don't have reasoning overhead and work great for tool use and agentic workflows
- **Reasoning models**: `gpt-5-nano` use extended thinking by default, consuming additional reasoning tokens without giving users enough control over the full pipeline.

- **Hand-tailored reasoning**: Best for complex workflows where you need control, transparency, and the ability to combine different specialized agents. This approach is unique in keeping cost under control.
- **4o models**: Best for general agentic workflows, tool use, and most production scenarios
- **Built-in reasoning (o1/gpt-5-nano)**: Best for standalone complex problems where the model needs deep analytical thinking

## Events

All agents extend `EventEmitter` and emit lifecycle events you can listen to. Import the event constants from `AgentEvent`:

```typescript
import { ClaudeAgent, AgentEvent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({ ... });

agent.on(AgentEvent.BEFORE_EXECUTE, (input) => {
  console.log('About to execute with input:', input);
});

agent.on(AgentEvent.DONE, (response, tokenUsage) => {
  console.log('Finished. Tokens used:', tokenUsage);
});

agent.on(AgentEvent.ERROR, (error) => {
  console.error('Agent error:', error.message);
});
```

### Agent Event Reference

| Event constant | Event name | Emitted when | Payload |
|---|---|---|---|
| `AgentEvent.BEFORE_EXECUTE` | `"before_execute"` | `execute()` is called | `input` |
| `AgentEvent.AFTER_EXECUTE` | `"after_execute"` | The LLM returns a response (may fire multiple times during tool loops) | `response` |
| `AgentEvent.DONE` | `"done"` | Execution fully completes (after all tool calls) | `response, tokenUsage` |
| `AgentEvent.TOOL_USE` | `"toolUse"` | The LLM requests one or more tool calls | `toolCalls` (provider-specific) |
| `AgentEvent.TOOL_ERROR` | `"tool_error"` | A tool throws an error during execution | `error` |
| `AgentEvent.ERROR` | `"error"` | Any error during execution | `error` |
| `AgentEvent.MAX_TOKENS_EXCEEDED` | `"max_tokens_exceeded"` | Response was cut off by token limit | `error` |

### Preventing Default Behaviour

The `BEFORE_EXECUTE` event payload includes a `preventDefault()` method (via `AgentEvent`) that you can call to cancel the execution:

```typescript
agent.on(AgentEvent.BEFORE_EXECUTE, (input) => {
  console.log('About to execute with input:', input);
  // Note: BEFORE_EXECUTE emits the raw input, not an AgentEvent instance.
  // To cancel execution, throw an error from a wrapper or use a guard before calling execute().
});
```

### Monitoring All Agents in a Pipeline

Because agents are event emitters, you can attach listeners to individual agents inside a pipeline to observe what's happening at each stage:

```typescript
const researcher = new ClaudeAgent({ id: 'researcher', ... });
const writer = new ClaudeAgent({ id: 'writer', ... });

researcher.on(AgentEvent.DONE, (_, usage) => {
  console.log(`Researcher used ${usage?.total_tokens} tokens`);
});

writer.on(AgentEvent.TOOL_USE, (toolCalls) => {
  console.log('Writer is calling tools:', toolCalls);
});

const pipeline = AgentGraph.sequential(researcher, writer);
await pipeline.execute('Write a report on quantum computing');
```

## Implementing GraphNode

All agents implement the `GraphNode` interface, making them compatible with pipelines:

```typescript
interface GraphNode<TInput, TOutput> {
  name?: string;
  nodeType?: GraphNodeType;
  execute(input: TInput): Promise<TOutput>;
}
```

This means you can use agents directly in pipelines, or combine them with other node types.
