# Agents

Agents are the core building block of Agention. Each agent wraps an LLM and provides a consistent interface for running prompts, using tools, and managing conversation history.

## Supported Providers

| Provider | Agent Class | Model Examples |
|----------|-------------|----------------|
| Anthropic | `ClaudeAgent` | `claude-sonnet-4-20250514`, `claude-opus-4-20250514` |
| Google | `GeminiAgent` | `gemini-2.0-flash` |
| OpenAI | `OpenAiAgent` | `gpt-4o`, `gpt-4-turbo` |
| Mistral | `MistralAgent` | `mistral-large-latest`, `mistral-medium` |
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
console.log(models.map((m) => m.name));
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

**Listing available models:**

```typescript
const models = await agent.listModels();
console.log(models.map((m) => m.id));
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

## Streaming

`executeStream()` is available on `ClaudeAgent`, `OpenAiAgent`, and any `OpenAICompatibleAgent` subclass (including `LlamaCppAgent`). It returns an `AsyncGenerator<StreamChunk>` — the same type across all providers:

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

Note that with Claude thinking on, `temperature`/`topP`/`topK` are not sent — the API mandates default sampling.

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
