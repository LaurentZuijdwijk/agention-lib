# Commands for agention-lib

## Build & Development
- `npm run build` - Build project (cleans dist folder then runs TypeScript compiler)
- `npm run watch` - TypeScript compiler in watch mode
- `npm run example` - Run example code
- `npm run docs` - Generate TypeDoc documentation
- `npm run jsdoc` - Generate JSDoc documentation

## Testing
- `npm test` - Run all tests
- `jest <path-to-file>` - Run specific test file (e.g., `jest lib/tools/Tool.spec.ts`)
- `npm run test:watch` - Run tests in watch mode

## Linting & Formatting
- `npm run lint` - Run ESLint on source files
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

## Code Style Guidelines
- **Types**: Use strict typing with explicit return types and interfaces
- **Classes**: PascalCase for classes/interfaces, camelCase for variables/methods
- **Imports**: Group imports by source
- **Documentation**: Write JSDoc comments for classes and methods
- **Error Handling**: Use try/catch with proper error propagation
- **Testing**: Write descriptive test blocks with proper mocking
- **Architecture**: Follow modular approach with base classes and inheritance

---

## Project Architecture

### Core Components

| Component | Location | Description |
|-----------|----------|-------------|
| `BaseAgent` | `lib/agents/BaseAgent.ts` | Abstract foundation for all LLM agents |
| `ClaudeAgent` | `lib/agents/anthropic/ClaudeAgent.ts` | Anthropic Claude implementation |
| `OpenAiAgent` | `lib/agents/openai/OpenAiAgent.ts` | OpenAI implementation (in progress) |
| `MistralAgent` | `lib/agents/mistral/MistralAgent.ts` | Mistral implementation |
| `Tool` | `lib/tools/Tool.ts` | Tool definition and execution |
| `History` | `lib/history/History.ts` | Conversation history management |
| `Team` | `lib/team/Team.ts` | Multi-agent coordination |

### Graph System (`lib/graph/`)

The graph module provides workflow orchestration patterns:

| Executor | Description |
|----------|-------------|
| `SequentialExecutor` | Chains agents, passing output to next |
| `ParallelExecutor` | Runs agents concurrently on same input |
| `Pipeline` | Chains any GraphNodes together |
| `MapExecutor` | Applies processor to each array item |
| `VotingSystem` | Judge selects best from multiple solutions |

**Key interfaces:**
- `GraphNode<TInput, TOutput>` - Base interface with `execute()`, `name`, and `nodeType`
- `GraphNodeType` - Type identifier: `"sequential" | "parallel" | "pipeline" | "map" | "voting" | "agent" | "custom"`

**Metrics & Observability:**
- `MetricsCollector` - Tracks timing, token usage, and pipeline structure
- `NodeExecutionMetrics` - Execution data for each node
- `PipelineMetrics` - Aggregate statistics for full pipeline runs
- Agents expose `lastTokenUsage` for metrics tracking

**Examples:** `examples/graph/` contains working examples for all executor types.

---

## Recent Changes

### Completed
- [x] Graph-based workflow system with 5 executor types
- [x] Metrics and observability (timing, token tracking, structure visualization)
- [x] Fixed filename typos (SequentialExecutor, MapExecutor)
- [x] Added `nodeType` property to all GraphNodes
- [x] Token usage tracking in ClaudeAgent (`lastTokenUsage` property)
- [x] Removed debug console.log statements from agents
- [x] Comprehensive tests for graph executors
- [x] Graph README and working examples

---

## TODO

### Architecture Improvements
- [ ] Add retry mechanisms with backoff to executors
- [ ] Add ConditionalExecutor for branching workflows
- [ ] Add RouterExecutor to route to different agents based on input
- [ ] Add context passing through pipeline stages

### Code Quality
- [ ] Reduce use of 'any' types - Replace with proper TypeScript interfaces
- [ ] Add proper validation - Validate inputs for agents and tools
- [ ] Fix test inconsistencies - Tests in BaseAgent.spec.ts and ClaudeAgent.spec.ts need alignment
- [ ] Complete OpenAI agent implementation

### Features to Add
1. **Streaming responses** - Support streaming from LLM APIs
2. **Middleware system** - Add request/response processing hooks
3. **PDF parsing** - Add tools for PDF document processing
4. **Vector DB integration** - Add tools for vector database operations
5. **Graph visualization** - Visual representation of pipeline structure and metrics

### Documentation
- [ ] Expand main README with architecture overview
- [ ] Add JSDoc comments to remaining components

### Testing
- [ ] Increase test coverage for agents
- [ ] Add integration tests for graph pipelines
- [ ] Create consistent mocking strategy for LLM APIs

### DevOps
- [ ] CI/CD pipeline - Add GitHub Actions for testing and deployment
- [ ] Version management - Implement proper semantic versioning
