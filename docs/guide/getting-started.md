# What is Agention?

Agention is a TypeScript library for building AI-powered agents and workflows. It provides a clean, modular architecture for working with LLMs from multiple providers.

## Why Agention?

### The Problem

Building with LLMs today means choosing between:

1. **Raw SDKs** - Full control, but you rebuild the same patterns every project: tool execution loops, conversation history, error handling, provider switching
2. **Heavy frameworks** - Lots of abstractions and magic, but you lose visibility into what's happening and fight the framework when you need control

### The Agention Approach

Agention sits in the middle: **enough structure to be productive, enough transparency to stay in control**.

- **No vendor lock-in** - Switch between Claude, OpenAI, Gemini, Mistral, or local models via Ollama and llama.cpp with the same interface. Mix providers in a single workflow.
- **Composable, not magical** - Agents are just objects. Pipelines are just arrays of agents. No hidden state, no surprising behavior.
- **Hand-tailored reasoning** - Build custom reasoning workflows by composing specialized agents, instead of relying on opaque built-in "thinking" features you can't control or optimize.
- **TypeScript-native** - Proper types throughout, not bolted on as an afterthought.

### Who Is This For?

Agention is for developers who:

- Want to build multi-step AI workflows without learning a complex framework
- Need to switch or combine LLM providers without rewriting code
- Prefer explicit code over configuration files and YAML
- Want transparency into token usage, timing, and agent decisions

## Key Features

- **Multi-Provider Agents** - Built-in support for Claude, OpenAI, Gemini, Mistral, and local models via Ollama and llama.cpp
- **Tool System** - Define tools with JSON Schema, agents use them automatically
- **Graph Pipelines** - Orchestrate complex workflows with sequential, parallel, and voting patterns
- **Conversation History** - Provider-agnostic history management
- **Metrics & Observability** - Track tokens, timing, and pipeline execution
- **Evaluation** - Score agents and pipelines against datasets with `@agentionai/eval`

## Installation

Install only what you need using selective imports:

```bash
# Install core library + Claude SDK
npm install @agentionai/agents @anthropic-ai/sdk

# Or for OpenAI
npm install @agentionai/agents openai

# Or for Gemini
npm install @agentionai/agents @google/generative-ai

# Or for Mistral
npm install @agentionai/agents @mistralai/mistralai

# Or for local models via Ollama (no API key needed)
npm install @agentionai/agents ollama

# Or for local models via llama.cpp (no API key needed)
npm install @agentionai/agents openai
```

This approach ensures you only install the agent SDKs you actually use, reducing bundle size and installation time.

## Environment Setup

Set your API key as an environment variable:

```bash
# Claude
export ANTHROPIC_API_KEY=your-key-here

# OpenAI
export OPENAI_API_KEY=your-key-here

# Mistral
export MISTRAL_API_KEY=your-key-here

# Ollama / llama.cpp run locally — no API key needed
```

## Your First Agent

```typescript
// Import only Claude - no other agent SDKs required!
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,  // Required: Your API key
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  model: 'claude-sonnet-4-5',
});

const response = await agent.execute('Hello, how are you?');
console.log(response);
```

::: tip API Key Configuration
All agents require an API key. You can either:
- Pass it via the `apiKey` parameter
- Set it as an environment variable (the SDK will automatically detect it)

Environment variable names:
- Claude: `ANTHROPIC_API_KEY`
- OpenAI: `OPENAI_API_KEY`
- Gemini: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- Mistral: `MISTRAL_API_KEY`
- Ollama / llama.cpp: none — they run locally
:::

### Selective Imports

Import only the agents you need:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';     // Requires @anthropic-ai/sdk
import { OpenAiAgent } from '@agentionai/agents/openai';     // Requires openai
import { GeminiAgent } from '@agentionai/agents/gemini';     // Requires @google/generative-ai
import { MistralAgent } from '@agentionai/agents/mistral';   // Requires @mistralai/mistralai
import { OllamaAgent } from '@agentionai/agents/ollama';     // Requires ollama (local, no API key)
import { LlamaCppAgent } from '@agentionai/agents/llamacpp'; // Requires openai (local, no API key)
```

Or import everything (requires all SDKs):

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';
```

## Next Steps

- [Quickstart](/guide/quickstart) - Build a working example in 5 minutes
- [Agents](/guide/agents) - Learn about agent configuration and providers
- [Tools](/guide/tools) - Add capabilities to your agents
- [Graph Pipelines](/guide/graph-pipelines) - Build multi-agent workflows
- [Evaluation](/guide/evals) - Score and compare agents against datasets
