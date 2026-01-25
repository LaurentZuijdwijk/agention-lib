# What is Agention?

Agention is a TypeScript library for building AI-powered agents and workflows. It provides a clean, modular architecture for working with LLMs from multiple providers.

## Why Agention?

### The Problem

Building with LLMs today means choosing between:

1. **Raw SDKs** - Full control, but you rebuild the same patterns every project: tool execution loops, conversation history, error handling, provider switching
2. **Heavy frameworks** - Lots of abstractions and magic, but you lose visibility into what's happening and fight the framework when you need control

### The Agention Approach

Agention sits in the middle: **enough structure to be productive, enough transparency to stay in control**.

- **No vendor lock-in** - Switch between Claude, OpenAI, Gemini, or Mistral with the same interface. Mix providers in a single workflow.
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

- **Multi-Provider Agents** - Built-in support for Claude, OpenAI, Gemini, and Mistral
- **Tool System** - Define tools with JSON Schema, agents use them automatically
- **Graph Pipelines** - Orchestrate complex workflows with sequential, parallel, and voting patterns
- **Conversation History** - Provider-agnostic history management
- **Metrics & Observability** - Track tokens, timing, and pipeline execution

## Installation

```bash
npm install @agentionai/agents
```

You'll also need to install the SDK for your chosen provider:

```bash
# For Claude
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai
```

## Environment Setup

Set your API key as an environment variable:

```bash
# Claude
export ANTHROPIC_API_KEY=your-key-here

# OpenAI
export OPENAI_API_KEY=your-key-here

# Mistral
export MISTRAL_API_KEY=your-key-here
```

## Your First Agent

```typescript
import { ClaudeAgent } from '@agentionai/agents';

const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  model: 'claude-sonnet-4-5',
});

const response = await agent.execute('Hello, how are you?');
console.log(response);
```

## Next Steps

- [Quickstart](/guide/quickstart) - Build a working example in 5 minutes
- [Agents](/guide/agents) - Learn about agent configuration and providers
- [Tools](/guide/tools) - Add capabilities to your agents
- [Graph Pipelines](/guide/graph-pipelines) - Build multi-agent workflows
