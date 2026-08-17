# Tools

Tools give agents the ability to perform actions beyond text generation. When you provide tools to an agent, it can decide when to use them based on the conversation.

## Defining a Tool

```typescript
import { Tool } from '@agentionai/agents/core';

const calculator = new Tool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Math expression to evaluate, e.g. "2 + 2"',
      },
    },
    required: ['expression'],
  },
  execute: async ({ expression }) => {
    const result = eval(expression); // Use a safe parser in production!
    return String(result);
  },
});
```

## Tool Properties

| Property | Description |
|----------|-------------|
| `name` | Unique identifier for the tool |
| `description` | Explains when to use this tool (shown to the LLM) |
| `inputSchema` | JSON Schema defining expected parameters |
| `execute` | Async function that executes the tool |

## Using Tools with Agents

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  id: 'calculator-assistant',
  name: 'Calculator Assistant',
  description: 'You are a helpful assistant with access to tools.',
  model: 'claude-sonnet-4-5',
  tools: [calculator, weatherTool, searchTool],
});

// The agent decides which tools to use
const response = await agent.execute('What is 15% of 230?');
```

## Input Schema

Tools use JSON Schema for input validation. Common patterns:

```typescript
// Simple string input
inputSchema: {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search query' },
  },
  required: ['query'],
}

// Multiple parameters
inputSchema: {
  type: 'object',
  properties: {
    city: { type: 'string', description: 'City name' },
    units: { 
      type: 'string', 
      enum: ['celsius', 'fahrenheit'],
      description: 'Temperature units',
    },
  },
  required: ['city'],
}

// Complex nested objects
inputSchema: {
  type: 'object',
  properties: {
    filters: {
      type: 'object',
      properties: {
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
        category: { type: 'string' },
      },
    },
  },
}
```

## Execute Function

The execute function receives validated input and must return a string:

```typescript
execute: async (input) => {
  // input is typed based on your schema
  const { city, units } = input;
  
  // Do the work
  const weather = await fetchWeather(city, units);
  
  // Return as string (will be shown to the LLM)
  return JSON.stringify(weather);
}
```

## Error Handling

Return error messages as strings - the agent will see and handle them:

```typescript
execute: async ({ url }) => {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    return `Error fetching URL: ${error.message}`;
  }
}
```

## Agents as Tools

One powerful pattern is using agents as tools for other agents. This enables hierarchical workflows where a "main" agent can delegate specialized tasks to sub-agents.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { OpenAiAgent } from '@agentionai/agents/openai';

// Create a specialized research agent with its own tools
const researchAssistant = new OpenAiAgent({
  id: 'research-assistant',
  name: 'PubMed Research Assistant',
  description: `You are a medical research expert with access to PubMed.
    Search for relevant papers and summarize findings.`,
  model: 'gpt-4o-mini',
  tools: [pubmedSearchTool, pubmedAbstractTool],
});

// Main agent can delegate research tasks to the assistant
const mainAgent = new ClaudeAgent({
  id: 'research-lead',
  name: 'Medical Research Lead',
  description: `You are a senior medical researcher. 
    Use your research assistant to find and analyze literature.`,
  model: 'claude-sonnet-4-5',
  agents: [researchAssistant],  // Sub-agents become available as tools
});

// The main agent can now call researchAssistant as a tool
const response = await mainAgent.execute(
  'Research the latest findings on CRISPR gene therapy for sickle cell disease'
);
```

This pattern allows you to:

- **Mix providers** - Use GPT-4 for research, Claude for synthesis
- **Specialize agents** - Each agent focuses on what it does best
- **Build hierarchies** - Create manager/worker agent structures
- **Encapsulate complexity** - Sub-agents handle their own tool orchestration

The main agent sees sub-agents as tools and decides when to invoke them based on the task at hand.

## Built-In (Provider-Defined) Tools

Some providers offer server-side tools that the model can call directly — the provider runs them as part of generating its response, rather than the agent executing them locally. Anthropic's web search, bash, and text editor tools are examples; OpenAI's web search, file search, and code interpreter, and OpenRouter's provider-agnostic web search/fetch tools work the same way.

These differ from regular `Tool` instances: they have no `execute` function or input schema, since the agent never runs them — it just forwards the tool's definition to the provider.

`ClaudeAgent`, `OpenAiAgent`, and `OpenRouterAgent` all accept them via `builtInTools` (flat config, or `vendorConfig.<vendor>.builtInTools`). Use the helpers from `lib/tools/BuiltInTool.ts`:

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { webSearchTool, bashTool, textEditorTool } from '@agentionai/agents/claude';

const agent = new ClaudeAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'You are a helpful research assistant with web access.',
  model: 'claude-sonnet-4-6',
  builtInTools: [
    webSearchTool({ maxUses: 5, allowedDomains: ['wikipedia.org'] }),
  ],
});

const response = await agent.execute('What happened in the news today?');
```

**OpenAI** (Responses API) — web search, file search over vector stores you've already uploaded to, and a sandboxed Python code interpreter:

```typescript
import { OpenAiAgent } from '@agentionai/agents/openai';
import {
  openAiWebSearchTool,
  openAiFileSearchTool,
  openAiCodeInterpreterTool,
} from '@agentionai/agents/openai';

const agent = new OpenAiAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'You are a helpful research assistant.',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.6-luna',
  builtInTools: [
    openAiWebSearchTool({ allowedDomains: ['wikipedia.org'] }),
    openAiFileSearchTool(['vs_abc123']),
    openAiCodeInterpreterTool(), // provisions its own sandboxed container
  ],
});
```

**OpenRouter** — `openRouterWebSearchTool()` and `openRouterWebFetchTool()` work identically across every tool-calling model OpenRouter fronts, unlike each upstream provider's own (differently-shaped) web search tool:

```typescript
import { OpenRouterAgent } from '@agentionai/agents/openrouter';
import { openRouterWebSearchTool } from '@agentionai/agents/openrouter';

const agent = new OpenRouterAgent({
  id: 'researcher',
  name: 'Researcher',
  description: 'You are a helpful research assistant.',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-sonnet-4-6',
  builtInTools: [openRouterWebSearchTool({ maxResults: 5 })],
});
```

You can mix built-in tools with regular locally-executed tools on any of the three:

```typescript
const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Assistant',
  description: 'You are a helpful assistant.',
  model: 'claude-sonnet-4-6',
  tools: [calculator, weatherTool],          // executed locally
  builtInTools: [webSearchTool(), bashTool()], // executed by Anthropic
});
```

If a provider adds a built-in tool not covered by the helpers, define it directly with `builtInTool()` — only `type` is required. Anthropic's tools also need `name` (the model's label for the tool); OpenAI's and OpenRouter's generally omit it:

```typescript
import { builtInTool } from '@agentionai/agents/claude';

builtInTools: [
  builtInTool({ type: 'code_execution_20250522', name: 'code_execution' }), // Anthropic
  builtInTool({ type: 'image_generation' }),                                // OpenAI — no name
],
```

## Events

Tools extend `EventEmitter` and fire events before and after execution. This lets you observe, log, or intercept tool calls without modifying the tool's logic.

```typescript
import { Tool, ToolEvent, ToolResultEvent } from '@agentionai/agents/core';

const myTool = new Tool({ ... });

myTool.on(ToolEvent.EXECUTE, (event: ToolEvent) => {
  console.log(`Tool "${event.target.name}" called by agent "${event.agentName}"`);
  console.log('Input:', event.input);
});

myTool.on(ToolResultEvent.RESULT, (event: ToolResultEvent) => {
  console.log(`Tool "${event.target.name}" returned:`, event.result);
});
```

### Tool Event Reference

| Event constant | Event name | Emitted when | Payload |
|---|---|---|---|
| `ToolEvent.EXECUTE` | `"execute"` | The tool is about to run | `ToolEvent` |
| `ToolResultEvent.RESULT` | `"toolResult"` | The tool has completed successfully | `ToolResultEvent` |

### ToolEvent Properties

| Property | Type | Description |
|---|---|---|
| `target` | `Tool` | The tool instance that was called |
| `input` | `Record<string, any>` | The input passed to the tool |
| `id` | `string` | Unique ID for this tool call |
| `agentId` | `string` | ID of the agent that invoked the tool |
| `agentName` | `string` | Name of the agent that invoked the tool |

`ToolResultEvent` extends `ToolEvent` and adds:

| Property | Type | Description |
|---|---|---|
| `result` | `any` | The value returned by the tool's `execute` function |

### Preventing Execution

Call `event.preventDefault()` on a `ToolEvent` to abort the tool call. The agent will receive an error message and should not retry with the same input:

```typescript
myTool.on(ToolEvent.EXECUTE, (event: ToolEvent) => {
  if (event.input.url.startsWith('file://')) {
    event.preventDefault(); // Block local file access
  }
});
```

Similarly, calling `preventDefault()` on a `ToolResultEvent` will suppress the result from being returned to the agent.

### Logging Tool Usage Across All Tools

Attach listeners to shared tool instances to centralise observability:

```typescript
const tools = [searchTool, calculatorTool, weatherTool];

for (const tool of tools) {
  tool.on(ToolEvent.EXECUTE, ({ target, agentName, input }) => {
    logger.info({ tool: target.name, agent: agentName, input });
  });
  tool.on(ToolResultEvent.RESULT, ({ target, result }) => {
    logger.info({ tool: target.name, result });
  });
}

const agent = new ClaudeAgent({ ..., tools });
```

## Best Practices

1. **Write clear descriptions** - The LLM uses these to decide when to use tools
2. **Use specific parameter names** - `searchQuery` is better than `q`
3. **Return structured data** - JSON strings are easy for the LLM to parse
4. **Handle errors gracefully** - Return error messages, don't throw
5. **Keep tools focused** - One tool, one purpose
6. **Use agents as tools** - For complex sub-tasks that benefit from LLM reasoning
