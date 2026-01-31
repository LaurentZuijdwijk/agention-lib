# Retrieval-Augmented Generation (RAG)

RAG combines vector search with LLM reasoning to ground responses in actual data. This guide covers architectural patterns for building RAG systems with Agention.

## What is RAG?

RAG extends LLM capabilities by:

1. **Retrieving** relevant documents from a knowledge base
2. **Augmenting** the LLM prompt with retrieved context
3. **Generating** responses grounded in the data

```
Query ──► Embedding ──► Vector Search ──► Context ──► LLM ──► Response
```

## Five RAG Patterns

Agention provides multiple implementation patterns, each with different tradeoffs:

| Pattern | Best For | Token Efficiency | Flexibility |
|---------|----------|------------------|-------------|
| **History Injection** | Simple Q&A, full control | High | High |
| **Tool-Based Retrieval** | Conversational, dynamic | Medium | Medium |
| **Agent Delegation** | Token optimization | Very High | High |
| **Graph Pipelines** | Complex workflows | Configurable | Very High |
| **Vector Store Direct** | Programmatic control | Highest | Highest |

---

## 1. History Injection

Inject retrieved context directly into conversation history before calling the agent.

```typescript
import { ClaudeAgent } from '@agentionai/agents/claude';
import { History, text } from '@agentionai/agents/core';

const history = new History();

// Retrieve and inject context
const context = await getRelevantDocuments(userQuestion);
history.add(text('user', `Reference documents:\n${context}`));
history.add(text('user', userQuestion));

const response = await agent.execute('', history);
```

**Advantages:**
- Full control over context formatting
- Fewer API calls (no tool round-trips)
- Predictable behavior
- Works with any retrieval method

**Use when:**
- Simple Q&A where you always want context
- Precise prompt construction needed
- Minimizing API calls is important

---

## 2. Tool-Based Retrieval

Give agents retrieval tools. The agent decides when to search.

```typescript
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [
    vectorStore.toRetrievalTool('Search documentation'),
    weatherApiTool,
    databaseTool,
  ],
  description: 'Use tools to gather information before answering.',
});
```

**Retrieval sources:**
- Vector stores (semantic search)
- REST/GraphQL APIs (real-time data)
- Graph databases (relationships)
- SQL databases (structured queries)
- MCP servers (standardized tools)
- File systems (local documents)

**Advantages:**
- Agent decides when retrieval is necessary
- Natural conversational flow
- Multiple sources in a single agent
- Agent can refine queries

**Use when:**
- Not every message needs retrieval
- Agent should decide search strategy
- Multi-source retrieval needed
- External service integration

---

## 3. Agent Delegation

Use specialized sub-agents as tools to optimize token usage.

```typescript
// Lightweight retrieval specialist
const retriever = new ClaudeAgent({
  id: 'retriever',
  name: 'Document Retriever',
  description: 'Search and return relevant documents.',
  model: 'claude-haiku-4-5',  // Fast, cheap
  tools: [searchTool],
});

// Main agent delegates retrieval
const assistant = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  agents: [retriever],
  description: 'Use the retriever to find information, then answer.',
});
```

**Advantages:**
- Token efficiency (retrieval on cheaper models)
- Specialization (optimized for specific tasks)
- Reduced context (only results flow to main agent)
- Cost optimization

**Use when:**
- High-volume applications
- Complex retrieval requiring multiple searches
- Want to isolate retrieval logic

---

## 4. Graph Pipelines

Compose agents into workflows with precise control.

### Sequential Pipeline

```typescript
import { Pipeline } from '@agentionai/agents/core';

const ragPipeline = new Pipeline([
  queryAnalyzer,   // Understand intent
  retriever,       // Search
  responder,       // Generate answer
]);

const answer = await ragPipeline.execute(userQuestion);
```

### Parallel Multi-Source

```typescript
import { AgentGraph, Pipeline } from '@agentionai/agents/core';

const parallelRetrieval = AgentGraph.parallel(
  docsRetriever,
  faqRetriever,
  codeRetriever,
);

const pipeline = new Pipeline([parallelRetrieval, synthesizer]);
```

### Routing

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
- Precise execution flow
- Composable patterns
- Built-in metrics
- Easy to add evaluation/retry logic

**Use when:**
- Complex multi-stage workflows
- Multi-source retrieval with synthesis
- Need evaluation/retry loops
- Production systems requiring observability

---

## 5. Vector Store Direct

Use the vector store API directly for maximum control.

```typescript
// Direct search
const results = await vectorStore.search(query, { 
  limit: 10,
  filter: { category: 'technical' },
});

// Process results
const relevant = results.filter(r => r.score > 0.8);
const context = formatForLLM(relevant);

// Use with any approach
```

**Advantages:**
- Maximum flexibility
- Custom retrieval logic
- Works with any application workflow
- Supports complex filtering/re-ranking

**Use when:**
- Custom retrieval beyond simple similarity
- Integration with existing workflows
- Need filtering, re-ranking, or scoring

---

## Combining Patterns

Patterns compose naturally:

```typescript
// Direct search + history injection + tool fallback
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

All patterns support multi-tenancy through metadata filtering:

```typescript
// Tenant-isolated retrieval
const tenantTool = vectorStore.toRetrievalTool('Search knowledge base', {
  defaultFilter: { tenantId: 'acme-corp' },
  allowFilterOverride: false,
});

// Or with direct search
const results = await vectorStore.search(query, {
  filter: { tenantId, department },
});
```

---

## Pattern Selection

| Requirement | Pattern |
|-------------|---------|
| Simple Q&A, predictable | History Injection |
| Conversational, agent-driven | Tool-Based Retrieval |
| Cost optimization | Agent Delegation |
| Complex workflows | Graph Pipelines |
| Custom logic | Vector Store Direct |
| Production observability | Graph Pipelines + Metrics |

Most systems combine multiple patterns. Start simple, add complexity as needed.

---

## Examples

### Basic RAG

```typescript
import { LanceDBVectorStore, OpenAIEmbeddings, ClaudeAgent } from '@agentionai/agents/core';

// Setup
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
const store = await LanceDBVectorStore.create({
  name: 'docs',
  uri: './data',
  tableName: 'documents',
  embeddings,
});

// Add documents
await store.addDocuments([
  { id: '1', content: 'Product features...' },
  { id: '2', content: 'Pricing information...' },
]);

// Create agent with retrieval
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [store.toRetrievalTool('Search product documentation')],
});

const response = await agent.execute('What are the pricing tiers?');
```

### Pipeline RAG

```typescript
import { Pipeline } from '@agentionai/agents/core';

// Retriever agent
const retriever = new ClaudeAgent({
  id: 'retriever',
  description: 'Search for documents and return them verbatim.',
  model: 'claude-haiku-4-5',
  tools: [store.toRetrievalTool('Search documentation')],
});

// Answerer agent
const answerer = new ClaudeAgent({
  id: 'answerer',
  description: 'Answer based on provided context only.',
  model: 'claude-sonnet-4-5',
});

// RAG pipeline
const ragPipeline = new Pipeline([retriever, answerer]);
const answer = await ragPipeline.execute('What is the refund policy?');
```

---

## Further Reading

- [Vector Stores](/guide/vector-stores) - Storage and retrieval
- [Embeddings](/guide/embeddings) - Embedding providers
- [Chunking & Ingestion](/guide/chunking-and-ingestion) - Document processing
- [Graph Pipelines](/guide/graph-pipelines) - Workflow composition
- [Tools](/guide/tools) - Tool creation
- [History](/guide/history) - History management
