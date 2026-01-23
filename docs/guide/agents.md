# Agents

Agents are the core building block of Agention. Each agent wraps an LLM and provides a consistent interface for running prompts, using tools, and managing conversation history.

## Supported Providers

| Provider | Agent Class | Model Examples |
|----------|-------------|----------------|
| Anthropic | `ClaudeAgent` | `claude-sonnet-4-20250514`, `claude-opus-4-20250514` |
| Google | `GeminiAgent` | `gemini-2.0-flash` |
| OpenAI | `OpenAiAgent` | `gpt-4o`, `gpt-4-turbo` |
| Mistral | `MistralAgent` | `mistral-large-latest`, `mistral-medium` |

## Basic Usage

```typescript
import { ClaudeAgent } from '@agentionai/agents';

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful assistant.',
});

const response = await agent.execute('Hello!');
```

## Configuration Options

```typescript
const agent = new ClaudeAgent({
  // Required
  model: 'claude-sonnet-4-20250514',

  // Optional
  name: 'my-agent',              // Identifier for logging/metrics
  systemPrompt: 'You are...',    // Sets agent behavior
  tools: [tool1, tool2],         // Available tools
  maxTokens: 4096,               // Max response tokens
});
```

## Conversation History

Agents maintain conversation history across multiple `execute()` calls:

```typescript
await agent.execute('My name is Alice.');
const response = await agent.execute('What is my name?');
// Agent remembers: "Your name is Alice"
```

Clear history to start fresh:

```typescript
agent.clearHistory();
```

## Using Different Providers

All agents share the same interface, making it easy to switch providers:

```typescript
import { ClaudeAgent, OpenAiAgent, MistralAgent } from '@agentionai/agents';

// Same interface, different provider
const claude = new ClaudeAgent({ model: 'claude-sonnet-4-20250514' });
const openai = new OpenAiAgent({ model: 'gpt-4o' });
const mistral = new MistralAgent({ model: 'mistral-large-latest' });

// All work the same way
const response = await claude.execute('Hello');
```

## Token Usage Tracking

Track token usage for cost monitoring:

```typescript
await agent.execute('Tell me a story');

const usage = agent.lastTokenUsage;
console.log(`Input: ${usage?.inputTokens}, Output: ${usage?.outputTokens}`);
```

## Implementing GraphNode

All agents implement the `GraphNode` interface, making them compatible with pipelines:

```typescript
interface GraphNode<TInput, TOutput> {
  name: string;
  nodeType: GraphNodeType;
  execute(input: TInput): Promise<ExecutionResult<TOutput>>;
}
```

This means you can use agents directly in pipelines, or combine them with other node types.
