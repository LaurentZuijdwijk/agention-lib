# Tools

Tools give agents the ability to perform actions beyond text generation. When you provide tools to an agent, it can decide when to use them based on the conversation.

## Defining a Tool

```typescript
import { Tool } from '@agentionai/agents';

const calculator = new Tool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  input_schema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Math expression to evaluate, e.g. "2 + 2"',
      },
    },
    required: ['expression'],
  },
  handler: async ({ expression }) => {
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
| `input_schema` | JSON Schema defining expected parameters |
| `handler` | Async function that executes the tool |

## Using Tools with Agents

```typescript
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
input_schema: {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search query' },
  },
  required: ['query'],
}

// Multiple parameters
input_schema: {
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
input_schema: {
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

## Handler Function

The handler receives validated input and must return a string:

```typescript
handler: async (input) => {
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
handler: async ({ url }) => {
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
import { ClaudeAgent, OpenAiAgent } from '@agentionai/agents';

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

## Best Practices

1. **Write clear descriptions** - The LLM uses these to decide when to use tools
2. **Use specific parameter names** - `searchQuery` is better than `q`
3. **Return structured data** - JSON strings are easy for the LLM to parse
4. **Handle errors gracefully** - Return error messages, don't throw
5. **Keep tools focused** - One tool, one purpose
6. **Use agents as tools** - For complex sub-tasks that benefit from LLM reasoning
