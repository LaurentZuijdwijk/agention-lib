# Retrieval-Augmented Generation (RAG)

RAG combines the knowledge retrieval capabilities of vector databases with the reasoning power of LLMs. This guide covers the architectural patterns and approaches for building RAG systems with Agention.

## What is RAG?

Retrieval-Augmented Generation addresses a fundamental limitation of LLMs: they only know what was in their training data. RAG extends LLM capabilities by:

1. **Retrieving** relevant documents from a knowledge base based on the user's query
2. **Augmenting** the LLM prompt with retrieved context
3. **Generating** responses grounded in actual data

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAG Pipeline                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Query ──► Embedding ──► Vector Search ──► Retrieved Docs       │
│                                    │                             │
│                                    ▼                             │
│              LLM ◄── Augmented Prompt ◄── Context Assembly       │
│               │                                                  │
│               ▼                                                  │
│           Response                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Five Approaches to RAG in Agention

Agention provides multiple patterns for implementing RAG, each with different tradeoffs. You can mix and match these approaches based on your requirements.

| Approach | Best For | Token Efficiency | Flexibility |
|----------|----------|------------------|-------------|
| **History Injection** | Simple Q&A, full control | High | High |
| **Tool-Based Retrieval** | Dynamic retrieval decisions | Medium | Medium |
| **Agent Delegation** | Token optimization, specialization | Very High | High |
| **Graph Pipelines** | Complex multi-stage workflows | Configurable | Very High |
| **Vector Store Direct** | Programmatic control | Highest | Highest |

---

## 1. History Injection

Unlike frameworks that hide conversation state, Agention's history is fully accessible and transparent. You can inject retrieved context directly into the conversation history before calling the agent.

**How it works:** Retrieve documents, format them, add to history, then call the agent. The agent sees context as part of the conversation.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { History, text } from '@agentionai/agents/core';

const history = new History();

// Inject context directly into history
const context = await getRelevantDocuments(userQuestion);
history.add(text('user', `Reference documents:\n${context}`));
history.add(text('user', userQuestion));

const response = await agent.execute('', history);
```

**Advantages:**
- Full control over context formatting and positioning
- Fewer API calls (no tool round-trips)
- Predictable behavior—context is always included
- Works with any retrieval method (vector search, SQL, APIs)

**When to use:**
- Simple Q&A systems where you always want context
- When you need precise control over prompt construction
- When minimizing API calls is important

**Persistence:** Since history is a first-class object, RAG conversations can be persisted to Redis, files, or custom backends and resumed later.

See [History Management](/guide/history) for details on history persistence.

---

## 2. Tool-Based Retrieval

Give agents tools to retrieve information from any source—vector stores, APIs, databases, MCP servers, or custom backends. The agent decides when and how to search.

**How it works:** Define tools that fetch information. The agent invokes them as needed based on the conversation.

```typescript
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [
    vectorStore.toRetrievalTool('Search documentation'),
    weatherApiTool,
    graphDbExplorerTool,
    mcpServerTool,
  ],
  description: 'Use available tools to gather information before answering.',
});
```

**Retrieval sources:**

| Source | Example Use Case |
|--------|------------------|
| **Vector stores** | Semantic search over documents, embeddings |
| **REST/GraphQL APIs** | Real-time data, external services, weather, stocks |
| **Graph databases** | Relationship traversal, knowledge graphs, entity lookup |
| **SQL databases** | Structured queries, business data |
| **MCP servers** | Standardized tool protocol, external integrations |
| **File systems** | Local documents, logs, configurations |

**Advantages:**
- Agent decides when retrieval is necessary
- Natural conversational flow
- Multiple sources in a single agent
- Agent can refine queries based on initial results

**When to use:**
- Conversational assistants where not every message needs retrieval
- When the agent should decide search strategy
- Multi-source retrieval (docs + APIs + databases)
- Integration with external services via MCP

See [Tools](/guide/tools) for creating custom retrieval tools.

---

## 3. Agent Delegation

Use sub-agents as specialized tools to optimize token usage and retrieval precision. A lightweight retrieval agent handles search, while the main agent focuses on synthesis.

**How it works:** Wrap a retrieval-focused agent as a tool for the main agent. The retrieval agent uses cheaper/faster models and handles the search loop, returning only relevant results.

```typescript
// Lightweight retrieval specialist
const retriever = new ClaudeAgent({
  id: 'retriever',
  name: 'Document Retriever',
  description: 'Search and return relevant documents for a query.',
  model: 'claude-haiku-4-5',  // Fast, cheap model
  tools: [searchTool],
});

// Main agent delegates retrieval
const assistant = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  agents: [retriever],  // Retriever available as a tool
  description: 'Use the retriever to find information, then synthesize answers.',
});
```

**Advantages:**
- **Token efficiency:** Retrieval loops happen on cheaper models
- **Specialization:** Each agent optimized for its task
- **Reduced context:** Only final results flow to the main agent
- **Cost optimization:** Use Haiku for retrieval, Sonnet/Opus for synthesis

**When to use:**
- High-volume applications where cost matters
- Complex retrieval requiring multiple searches
- When you want to isolate retrieval logic

See [Tools](/guide/tools) for details on agents as tools.

---

## 4. Graph Pipelines

Use graph executors for precise control over multi-stage RAG workflows. Define exactly how data flows between retrieval, processing, and generation stages.

**How it works:** Compose agents into pipelines with sequential, parallel, routing, or voting patterns.

### Sequential Pipeline

Chain stages: query analysis → retrieval → response generation.

```typescript
import { Pipeline } from '@agentionai/agents/core';

const ragPipeline = new Pipeline([
  queryAnalyzer,   // Understand intent, extract topics
  retriever,       // Search based on analysis
  responder,       // Generate final answer
]);

const answer = await ragPipeline.execute(userQuestion);
```

### Parallel Multi-Source

Search multiple knowledge bases simultaneously, then synthesize.

```typescript
import { AgentGraph, Pipeline } from '@agentionai/agents/core';

const parallelRetrieval = AgentGraph.parallel(
  docsRetriever,
  faqRetriever,
  codeRetriever,
);

const pipeline = new Pipeline([parallelRetrieval, synthesizer]);
```

### Routing and Evaluation

Route queries to specialized retrievers or evaluate and retry.

```typescript
import { RouterExecutor } from '@agentionai/agents/core';

const router = new RouterExecutor({
  routes: [
    { condition: (q) => q.includes('API'), node: apiDocsRetriever },
    { condition: (q) => q.includes('error'), node: troubleshootingRetriever },
    { condition: () => true, node: generalRetriever },
  ],
});
```

**Advantages:**
- **Precise control:** Define exact execution flow
- **Composability:** Mix sequential, parallel, routing patterns
- **Observability:** Built-in metrics for each pipeline stage
- **Flexibility:** Easy to add evaluation, retry, or fallback logic

**When to use:**
- Complex RAG requiring multiple stages
- Multi-source retrieval with synthesis
- When you need evaluation/retry loops
- Production systems requiring observability

See [Graph Pipelines](/guide/graph-pipelines) for all executor types and patterns.

---

## 5. Vector Store Direct

Use the vector store API directly for maximum programmatic control. Handle retrieval in your application code, then pass results to agents however you prefer.

```typescript
// Direct search
const results = await vectorStore.search(query, { 
  limit: 10,
  filter: { category: 'technical' },
});

// Process results in application code
const relevant = results.filter(r => r.score > 0.8);
const context = formatForLLM(relevant);

// Use with any approach: history injection, custom prompts, etc.
```

**Advantages:**
- Maximum flexibility
- Can integrate with any application logic
- Supports complex filtering and post-processing
- Works with custom retrieval strategies (hybrid search, re-ranking)

**When to use:**
- Custom retrieval logic beyond simple similarity search
- Integration with existing application workflows
- When you need filtering, re-ranking, or custom scoring

---

## Combining Approaches

These patterns compose naturally. A production system might:

1. Use **direct vector search** with custom re-ranking
2. Pass results via **history injection** for control
3. Have the agent use **tool-based retrieval** for follow-up searches
4. Wrap everything in a **graph pipeline** for observability

```typescript
// Example: History injection + tool fallback
const history = new History();

// Pre-inject high-confidence results
const initial = await vectorStore.search(question, { limit: 3 });
if (initial[0]?.score > 0.85) {
  history.add(text('user', `Context:\n${formatContext(initial)}`));
}

// Agent can search for more if needed
const agent = new ClaudeAgent({
  tools: [searchTool],
  description: 'Context may be provided. Search for more if needed.',
});

await agent.execute(question, history);
```

---

## Multi-Tenant RAG

All approaches support multi-tenancy through metadata filtering:

```typescript
// Tenant-isolated retrieval tool
const tenantTool = vectorStore.toRetrievalTool('Search knowledge base', {
  defaultFilter: { tenantId: 'acme-corp' },
  allowFilterOverride: false,  // Enforce isolation
});

// Or with direct search
const results = await vectorStore.search(query, {
  filter: { tenantId, department },
});
```

---

## Choosing an Approach

| Requirement | Recommended Approach |
|-------------|---------------------|
| Simple Q&A, predictable behavior | History Injection |
| Conversational, agent-driven | Tool-Based Retrieval |
| Cost optimization, high volume | Agent Delegation |
| Complex workflows, multi-source | Graph Pipelines |
| Custom logic, maximum control | Vector Store Direct |
| Production with observability | Graph Pipelines + Metrics |

Most production systems combine multiple approaches. Start simple with history injection or tool-based retrieval, then add complexity as needed.

---

## Further Reading

- [Vector Stores](/guide/vector-stores) — Storage, search, and retrieval tools
- [Chunking & Ingestion](/guide/chunking-and-ingestion) — Document processing
- [Graph Pipelines](/guide/graph-pipelines) — Workflow composition and metrics
- [Tools](/guide/tools) — Tool creation and agent delegation
- [History Management](/guide/history) — Persistence and sharing
- [Examples](/guide/examples) — Working implementations
