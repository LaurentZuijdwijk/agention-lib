# Modular AI Agents Library

## Project Overview
A TypeScript library for creating and orchestrating modular and atomic AI agents that can be composed into flexible workflows. Each agent is a self-contained unit that can process input, interact with tools, and produce output while maintaining its own context and history.

## Core Concepts

### Atomic Agent
The fundamental building block of the library. An atomic agent is a stateless processor that combines:
- Typed inputs and outputs
- Access to specific tools
- A core instruction/prompt
- Execution history
- Metadata (name, description, etc.)

### Tools
Reusable capabilities that agents can leverage:
- HTTP requests
- File system operations
- Database interactions
- Custom function execution
- Other agent invocations

### Agent Graph
A directed graph where:
- Nodes are atomic agents
- Edges define data flow between agents
- Support for parallel and sequential execution
- Dynamic routing based on agent outputs

## Technical Architecture

### Core Interfaces

```typescript
interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  execute(input: TInput): Promise<TOutput>;
}

interface AgentContext {
  history: HistoryEntry[];
  memory: Record<string, unknown>;
}

interface AtomicAgent<TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  instruction: string;
  tools: Tool<any, any>[];

  execute(input: TInput, context: AgentContext): Promise<TOutput>;
  updateContext(context: Partial<AgentContext>): void;
}

interface AgentGraph {
  agents: Map<string, AtomicAgent<any, any>>;
  edges: Map<string, {from: string; to: string; transform?: (data: any) => any}>;

  addAgent(agent: AtomicAgent<any, any>): void;
  connect(fromId: string, toId: string, transform?: (data: any) => any): void;
  execute(input: any): Promise<any>;
}
```

### Key Features

#### 1. Type Safety
- Fully typed inputs and outputs
- Type checking for tool compatibility
- Runtime type validation
- Generic type constraints for agent composition

#### 2. History Management
- Automatic tracking of agent executions
- Customizable history retention
- Query and analysis capabilities
- Context sharing between agents

#### 3. Tool Management
- Plugin system for adding new tools
- Tool dependency injection
- Tool execution middleware
- Error handling and retry logic

#### 4. Graph Execution
- Parallel execution where possible
- Error propagation and handling
- Cycle detection
- Dynamic routing based on conditions
- Progress monitoring and observability

## Usage Examples

### Creating an Atomic Agent

```typescript
const summarizer = new AtomicAgent<string, string>({
  id: 'text-summarizer',
  title: 'Text Summarizer',
  description: 'Summarizes input text using AI',
  instruction: 'Summarize the following text concisely...',
  tools: [llmTool, tokenCounterTool]
});
```

### Building a Graph

```typescript
const graph = new AgentGraph();

graph.addAgent(webScraper);
graph.addAgent(summarizer);
graph.addAgent(translator);

graph.connect('web-scraper', 'summarizer');
graph.connect('summarizer', 'translator',
  (summary) => ({ text: summary, targetLang: 'es' }));

const result = await graph.execute('https://example.com');
```

## Implementation Guidelines

### 1. Error Handling
- Clear error types and hierarchies
- Graceful failure handling
- Retry mechanisms
- Error propagation through graph

### 2. Testing
- Unit tests for atomic agents
- Integration tests for graphs
- Tool mocking capabilities
- Test helpers and fixtures

### 3. Performance
- Lazy loading of tools and agents
- Caching mechanisms
- Resource cleanup
- Memory management

### 4. Extensibility
- Plugin system for new tool types
- Custom agent implementations
- Middleware integration
- Event system for monitoring

## Development Roadmap

### Phase 1: Core Framework
- Basic agent implementation
- Essential tools
- Simple graph execution
- Type system foundation

### Phase 2: Advanced Features
- History management
- Complex routing
- Parallel execution
- Enhanced type safety

### Phase 3: Tools and Integration
- Common tool implementations
- Framework integrations
- Documentation and examples
- Performance optimization

## Best Practices

### Agent Design
- Keep agents atomic and focused
- Clear input/output contracts
- Meaningful descriptions
- Reusable tool combinations

### Graph Design
- Avoid deep chains where possible
- Consider error paths
- Use transforms for data preparation
- Monitor execution complexity

### Tool Development
- Strong typing
- Clear documentation
- Error handling
- Resource management

## Notes and Considerations

### Security
- Tool permission management
- Input validation
- Secure context handling
- Rate limiting

### Scalability
- Agent pooling
- Distributed execution
- Resource constraints
- State management

### Monitoring
- Execution metrics
- Error tracking
- Performance monitoring
- Debug capabilities

# TODOs
[] events for tools and agents
[] input validation for tools
[] better error handling
[] try out chatgpt api
