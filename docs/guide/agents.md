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
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
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

All agents support common parameters like `temperature`, `topP`, `topK`, and `stopSequences` for fine-tuned control over model outputs. Vendor-specific options can be passed via the `vendorConfig` property for advanced features unique to each provider. See [IMPLEMENTATION_SUMMARY.md](../../IMPLEMENTATION_SUMMARY.md) for details.

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
const claude = new ClaudeAgent({
  id: 'claude',
  name: 'Claude',
  description: 'You are a helpful assistant.',
  model: 'claude-sonnet-4-5',
});

const openai = new OpenAiAgent({
  id: 'openai',
  name: 'OpenAI',
  description: 'You are a helpful assistant.',
  model: 'gpt-4o',
});

const mistral = new MistralAgent({
  id: 'mistral',
  name: 'Mistral',
  description: 'You are a helpful assistant.',
  model: 'mistral-large-latest',
});

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



## Why are agents important?

Creating agent workflows allows us to build very advanced features and very powerful models instead of relying on vendor features and lock in. 

One example is custom reasoning workflows by combining agents with specific roles. This gives you full control over the reasoning process, unlike built-in model reasoning.

### Using Agents as Reasoning Tools

You can wrap specialized "reasoner" agents as tools for other agents, creating sophisticated multi-stage thinking:

```typescript
import { ClaudeAgent, Tool } from '@agentionai/agents';

// Create a specialized reasoning agent
const reasoner = new ClaudeAgent({
  id: 'reasoner',
  name: 'Analytical Reasoner',
  description: `You are an analytical reasoning specialist. Break down complex 
questions into parts, identify assumptions, and evaluate different approaches.`,
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
