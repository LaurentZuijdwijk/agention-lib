/**
 * VoyageAI Embeddings Example
 *
 * Demonstrates how to use VoyageAI embeddings with the vector store.
 *
 * Prerequisites:
 * - Set VOYAGE_API_KEY environment variable
 * - Run with: npm run example -- examples/voyage-embeddings.ts
 */
import "dotenv/config";
import { VoyageAIEmbeddings } from "../lib/embeddings/VoyageAIEmbeddings";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";

async function main() {
  console.log("=== VoyageAI Embeddings Example ===\n");

  // Check for required API key
  if (!process.env.VOYAGE_API_KEY) {
    console.error("Error: VOYAGE_API_KEY environment variable is not set");
    console.log("\nPlease set your VoyageAI API key:");
    console.log("  export VOYAGE_API_KEY=your-api-key-here");
    process.exit(1);
  }

  // Create VoyageAI embeddings instance
  console.log("Creating VoyageAI embeddings with voyage-4 model...");
  const embeddings = new VoyageAIEmbeddings({
    model: "voyage-4",
    inputType: "document", // Use "document" for indexing, "query" for searching
  });

  console.log(`Model: ${embeddings.model}`);
  console.log(`Dimensions: ${embeddings.dimensions}\n`);

  // Example: Generate embeddings directly
  console.log("Generating embeddings for sample texts...");
  const texts = [
    "VoyageAI provides state-of-the-art embedding models",
    "Vector databases enable semantic search capabilities",
    "The voyage-4 model offers excellent performance",
  ];

  const vectors = await embeddings.embed(texts);
  console.log(`Generated ${vectors.length} embeddings`);
  console.log(`First embedding dimensions: ${vectors[0].length}\n`);

  // Example: Using with LanceDB Vector Store
  console.log("Creating LanceDB vector store with VoyageAI embeddings...");
  const store = await LanceDBVectorStore.create({
    name: "voyage_demo",
    uri: "./data/voyage-example",
    tableName: "documents",
    embeddings,
    metadataFields: [
      { name: "category", type: "string" as const },
      { name: "source", type: "string" as const },
    ],
  });

  // Add documents (embeddings generated automatically)
  console.log("Adding documents to vector store...");
  await store.addDocuments([
    {
      id: "doc1",
      content: "VoyageAI specializes in embedding models for semantic search",
      metadata: { category: "ai", source: "docs" },
    },
    {
      id: "doc2",
      content: "voyage-4 is their latest general-purpose embedding model",
      metadata: { category: "models", source: "docs" },
    },
    {
      id: "doc3",
      content: "voyage-code-3 is optimized for code search and understanding",
      metadata: { category: "models", source: "docs" },
    },
  ]);

  console.log("Documents added successfully!\n");

  // Perform semantic search
  console.log("Performing semantic search...");
  const query = "What is the latest VoyageAI model?";
  const results = await store.search(query, { limit: 2 });

  console.log(`\nQuery: "${query}"`);
  console.log("Results:");
  results.forEach((result, i) => {
    console.log(
      `${i + 1}. [Score: ${result.score.toFixed(4)}] ${result.content}`
    );
    console.log(`   Metadata:`, result.metadata);
  });

  console.log("\n=== Example Complete ===");
}

main().catch(console.error);
