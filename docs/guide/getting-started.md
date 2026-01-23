# What is Agention?

Agention is a TypeScript library for building AI-powered agents and workflows. It provides a clean, modular architecture for working with LLMs from multiple providers.

## Key Features

- **Multi-Provider Agents** - Built-in support for Claude, OpenAI, and Mistral
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
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
});

const response = await agent.execute('Hello, how are you?');
console.log(response);
```

## Next Steps

- [Quickstart](/guide/quickstart) - Build a working example in 5 minutes
- [Agents](/guide/agents) - Learn about agent configuration and providers
- [Tools](/guide/tools) - Add capabilities to your agents
- [Graph Pipelines](/guide/graph-pipelines) - Build multi-agent workflows
