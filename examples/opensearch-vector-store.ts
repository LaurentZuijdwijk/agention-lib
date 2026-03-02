/**
 * OpenSearch Vector Store example
 *
 * Demonstrates how to use OpenSearchVectorStore for RAG (Retrieval-Augmented Generation)
 * with a Claude agent.
 *
 * Prerequisites:
 *   - A running OpenSearch instance (e.g. via Docker):
 *
 * docker run -p 9200:9200 -p 9600:9600 \
 *  -e "discovery.type=single-node" \
 *  -e 'OPENSEARCH_INITIAL_ADMIN_PASSWORD=MySearch@7742' \
 *  opensearchproject/opensearch:latest
 *
 *
 *   - Required env vars:
 *       OPENAI_API_KEY       — for OpenAI embeddings
 *       ANTHROPIC_API_KEY    — for the Claude agent
 *       OPENSEARCH_NODE      — OpenSearch endpoint (default: https://localhost:9200)
 *       OPENSEARCH_USERNAME  — username (default: admin)
 *       OPENSEARCH_PASSWORD  — password (default: admin)
 *
 * Run with:
 *   npm run example examples/opensearch-vector-store.ts
 */

import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenSearchVectorStore } from "../lib/vectorstore/OpenSearchVectorStore";
import { OpenAIEmbeddings } from "../lib/embeddings/OpenAIEmbeddings";

const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE ?? "https://localhost:9200";
const OPENSEARCH_USERNAME = process.env.OPENSEARCH_USERNAME ?? "admin";
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD ?? "admin";
const INDEX_NAME = "agention_example";

async function main() {
  console.log("OpenSearch Vector Store Example\n");
  console.log("================================\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is required for embeddings");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is required for the agent");
    process.exit(1);
  }

  // 1. Embeddings
  console.log("1. Creating OpenAI embeddings provider...");
  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
  console.log(
    `   Model: ${embeddings.model}, Dimensions: ${embeddings.dimensions}\n`
  );

  // 2. Vector store
  console.log(`2. Connecting to OpenSearch at ${OPENSEARCH_NODE}...`);
  const store = await OpenSearchVectorStore.create({
    name: "knowledge_base",
    node: OPENSEARCH_NODE,
    auth: { username: OPENSEARCH_USERNAME, password: OPENSEARCH_PASSWORD },
    ssl: { rejectUnauthorized: false }, // allow self-signed certs in dev
    indexName: INDEX_NAME,
    embeddings,
    spaceType: "cosinesimil",
    metadataFields: [
      { name: "category", type: "string" },
      { name: "source", type: "string" },
    ],
  });
  console.log(
    `   Index: "${store.getIndexName()}", Dimensions: ${store.getDimensions()}\n`
  );

  // 3. Ingest some documents
  console.log("3. Ingesting sample documents...");
  const documents = [
    {
      id: "doc-1",
      content:
        "OpenSearch is a distributed, open-source search and analytics engine. " +
        "It is a community-driven fork of Elasticsearch maintained by Amazon.",
      metadata: { source: "docs", category: "overview" },
    },
    {
      id: "doc-2",
      content:
        "The OpenSearch k-NN plugin enables approximate k-nearest-neighbour (ANN) search " +
        "using the HNSW algorithm. It supports cosine similarity, L2, and inner product space types.",
      metadata: { source: "docs", category: "knn" },
    },
    {
      id: "doc-3",
      content:
        "Agention-lib provides an OpenSearchVectorStore that wraps the k-NN plugin " +
        "and exposes a unified VectorStore interface for use in RAG pipelines.",
      metadata: { source: "agention", category: "vectorstore" },
    },
    {
      id: "doc-4",
      content:
        "Retrieval-Augmented Generation (RAG) is a pattern where an LLM is given relevant " +
        "context retrieved from a vector store before generating a response.",
      metadata: { source: "docs", category: "rag" },
    },
    {
      id: "doc-5",
      content:
        "HNSW (Hierarchical Navigable Small World) is a graph-based ANN algorithm. " +
        "The M parameter controls the number of bidirectional links per node, " +
        "and ef_construction controls graph quality at index build time.",
      metadata: { source: "docs", category: "knn" },
    },
  ];

  const ids = await store.addDocuments(documents);
  console.log(`   Indexed ${ids.length} documents\n`);

  // 4. Index overview & data snapshot
  console.log("4. Index overview & data snapshot");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = store.getClient() as any;

  // Fetch the full index definition (settings + mappings)
  const indexInfo = await rawClient.indices.get({ index: store.getIndexName() });
  const indexDef = indexInfo.body[store.getIndexName()];
  const knnSettings = indexDef?.settings?.index?.knn;
  const embeddingMapping = indexDef?.mappings?.properties?.embedding;
  const method = embeddingMapping?.method ?? {};

  console.log(`   Engine:     ${method.engine ?? "—"}`);
  console.log(`   Space type: ${method.space_type ?? "—"}`);
  console.log(`   Dimensions: ${embeddingMapping?.dimension ?? "—"}`);
  console.log(`   k-NN index: ${knnSettings ?? "—"}`);

  // List mapped metadata fields and their distinct values via terms aggs
  const metaProps = indexDef?.mappings?.properties?.metadata?.properties ?? {};
  const metaFieldNames = Object.keys(metaProps);

  if (metaFieldNames.length === 0) {
    console.log("   Metadata fields: (none)");
  } else {
    const aggs: Record<string, unknown> = {};
    for (const field of metaFieldNames) {
      const fieldType = (metaProps[field] as { type?: string }).type;
      // text fields from dynamic mapping need the .keyword sub-field for aggregations
      const aggField = fieldType === "keyword" ? `metadata.${field}` : `metadata.${field}.keyword`;
      aggs[field] = { terms: { field: aggField, size: 20 } };
    }
    const aggsResult = await rawClient.search({
      index: store.getIndexName(),
      body: { size: 0, aggs },
    });
    const aggsBody = aggsResult.body.aggregations ?? {};

    console.log("   Metadata fields:");
    for (const [field, v] of Object.entries(metaProps)) {
      const fieldType = (v as { type?: string }).type ?? "?";
      const buckets: Array<{ key: string; doc_count: number }> =
        aggsBody[field]?.buckets ?? [];
      const values = buckets.length > 0
        ? buckets.map((b) => `${b.key} (${b.doc_count})`).join(", ")
        : "(no values)";
      console.log(`     ${field} [${fieldType}]: ${values}`);
    }
  }

  // Data snapshot via match_all (no embedding needed)
  const snapshot = await rawClient.search({
    index: store.getIndexName(),
    body: { size: 10, query: { match_all: {} }, _source: ["id", "content", "namespace", "metadata"] },
  });
  const hits = snapshot.body.hits?.hits ?? [];
  console.log(`\n   Documents in index (${hits.length}):`);
  for (const hit of hits) {
    const src = hit._source;
    const ns = src.namespace ? ` [ns:${src.namespace}]` : "";
    const metaPairs = Object.entries(src.metadata ?? {})
      .map(([k, val]) => `${k}=${val}`)
      .join("  ");
    console.log(`   ${src.id}${ns}  ${metaPairs}`);
    console.log(`     "${src.content.substring(0, 80)}..."`);
  }
  console.log();

  // 5. Direct search
  console.log('5. Direct search: "how does vector search work in OpenSearch?"');
  const searchResults = await store.search(
    "how does vector search work in OpenSearch?",
    { limit: 3 }
  );
  console.log("   Top results:");
  for (const result of searchResults) {
    console.log(
      `   [${result.score.toFixed(3)}] (${
        result.document.metadata?.category
      }) ` +
        result.document.content.substring(0, 80) +
        "..."
    );
  }
  console.log();

  // 6. Metadata filter tests
  console.log("6. Metadata filter tests");
  console.log("   (All results show [score] (category|source) snippet)\n");

  function printResults(results: Awaited<ReturnType<typeof store.search>>) {
    if (results.length === 0) {
      console.log("   (no results)");
      return;
    }
    for (const r of results) {
      const m = r.document.metadata ?? {};
      console.log(
        `   [${r.score.toFixed(3)}] (${m.category}|${m.source}) ${r.document.content.substring(0, 70)}...`
      );
    }
  }

  function assertCategories(
    results: Awaited<ReturnType<typeof store.search>>,
    expected: string,
    label: string
  ) {
    const wrong = results.filter((r) => r.document.metadata?.category !== expected);
    const status = wrong.length === 0 ? "PASS" : `FAIL (${wrong.length} wrong)`;
    console.log(`   ${status}: ${label}`);
  }

  // 6a. Filter by category = "knn"
  console.log('   6a. category = "knn" (expect only knn docs)');
  const knnResults = await store.search("nearest neighbour algorithm", {
    limit: 5,
    filter: { category: "knn" },
  });
  printResults(knnResults);
  assertCategories(knnResults, "knn", "all results have category=knn");
  console.log();

  // 6b. Filter by source = "agention"
  console.log('   6b. source = "agention" (expect only agention docs)');
  const agentionResults = await store.search("vector store RAG", {
    limit: 5,
    filter: { source: "agention" },
  });
  printResults(agentionResults);
  const wrongSource = agentionResults.filter(
    (r) => r.document.metadata?.source !== "agention"
  );
  console.log(
    `   ${wrongSource.length === 0 ? "PASS" : "FAIL"}: all results have source=agention`
  );
  console.log();

  // 6c. Filter by category = "overview" (only 1 doc exists)
  console.log('   6c. category = "overview" (expect exactly 1 doc)');
  const overviewResults = await store.search("OpenSearch", {
    limit: 5,
    filter: { category: "overview" },
  });
  printResults(overviewResults);
  console.log(
    `   ${overviewResults.length === 1 ? "PASS" : "FAIL"}: got ${overviewResults.length} result(s), expected 1`
  );
  console.log();

  // 6d. Filter by non-existent category (expect 0 results)
  console.log('   6d. category = "nonexistent" (expect 0 results)');
  const emptyResults = await store.search("anything", {
    limit: 5,
    filter: { category: "nonexistent" },
  });
  printResults(emptyResults);
  console.log(
    `   ${emptyResults.length === 0 ? "PASS" : "FAIL"}: got ${emptyResults.length} result(s), expected 0`
  );
  console.log();

  // 7. Namespace demo
  console.log(
    "7. Namespace demo — adding a document to namespace 'internal'..."
  );
  await store.addDocuments(
    [
      {
        id: "internal-1",
        content: "This is an internal document not shown in public searches.",
        metadata: { source: "internal" },
      },
    ],
    { namespace: "internal" }
  );

  const publicResults = await store.search("internal document", {
    limit: 3,
    namespace: "public", // won't match the 'internal' doc
  });
  console.log(
    `   Search in namespace 'public' returned ${publicResults.length} results (expected 0 for the internal doc)\n`
  );

  // 8. Agent with retrieval tool
  console.log("8. Creating Claude agent with OpenSearch retrieval tool...");
  const searchTool = store.toRetrievalTool(
    "Search the knowledge base for information about OpenSearch, vector search, RAG, and Agention.",
    { defaultLimit: 3 }
  );

  const agent = new ClaudeAgent({
    name: "RAG Assistant",
    id: "rag_assistant",
    model: "claude-haiku-4-5",
    description:
      "You are a helpful assistant. Always use the search tool to retrieve relevant context " +
      "before answering questions. Base your answers on the search results.",
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    tools: [searchTool],
  });
  console.log("   Agent created\n");

  // 9. Ask the agent a question
  console.log(
    '9. Asking the agent: "What is the HNSW algorithm and how is it configured?"\n'
  );
  const answer = await agent.execute(
    "What is the HNSW algorithm and how is it configured?"
  );
  console.log(`Answer:\n${answer}\n`);

  // 10. Clean up (delete all docs from the index)
  console.log("10. Clearing the index...");
  await store.clear();
  console.log("   Done.\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
