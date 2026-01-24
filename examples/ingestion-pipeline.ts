/**
 * Ingestion Pipeline Example
 *
 * Demonstrates how to use the chunkers and ingestion pipeline
 * to process documents and store them in a vector database.
 */

import * as fs from "fs";
import * as path from "path";

import {
  TextChunker,
  RecursiveChunker,
  TokenChunker,
  IngestionPipeline,
} from "../lib";
import { OpenAIEmbeddings } from "../lib/vectorstore/OpenAIEmbeddings";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";

async function main() {
  console.log("=== Text Chunker Examples ===\n");

  // Sample document
  const sampleDoc = `# Introduction

This is a sample document that demonstrates the text chunking capabilities.
The chunker will split this document into smaller pieces for vector storage.

## Features

The chunking system supports multiple strategies:

1. TextChunker - Simple character-based splitting with overlap
2. RecursiveChunker - Smart splitting on semantic boundaries
3. TokenChunker - Token-aware splitting for LLM compatibility

## Usage

To use a chunker, simply create an instance with your desired configuration
and call the chunk method with your text.

### Example Code

Here's how you might use the RecursiveChunker:

\`\`\`typescript
const chunker = new RecursiveChunker({
  chunkSize: 500,
  chunkOverlap: 50,
});

const chunks = await chunker.chunk(document);
\`\`\`

## Conclusion

Text chunking is an essential step in building RAG applications.
Choose the right chunker based on your use case and document types.`;

  // Example 1: TextChunker
  console.log("1. TextChunker (character-based)");
  console.log("-".repeat(40));

  const textChunker = new TextChunker({
    chunkSize: 200,
    chunkOverlap: 20,
  });

  const textChunks = await textChunker.chunk(sampleDoc, {
    sourceId: "sample-doc",
    sourcePath: "/docs/sample.md",
  });

  console.log(`Created ${textChunks.length} chunks`);
  console.log(`First chunk (${textChunks[0].metadata.charCount} chars):`);
  console.log(textChunks[0].content.substring(0, 100) + "...\n");

  // Example 2: RecursiveChunker
  console.log("2. RecursiveChunker (semantic boundaries)");
  console.log("-".repeat(40));

  const recursiveChunker = new RecursiveChunker({
    chunkSize: 300,
    chunkOverlap: 30,
    separators: ["\n\n", "\n", ". ", " "],
  });

  const recursiveChunks = await recursiveChunker.chunk(sampleDoc, {
    sourceId: "sample-doc",
    metadata: { type: "documentation" },
  });

  console.log(`Created ${recursiveChunks.length} chunks`);
  for (let i = 0; i < Math.min(3, recursiveChunks.length); i++) {
    const chunk = recursiveChunks[i];
    console.log(
      `  Chunk ${i}: ${chunk.metadata.charCount} chars, section: ${chunk.metadata.sectionTitle ?? "N/A"}`
    );
  }
  console.log();

  // Example 3: TokenChunker
  console.log("3. TokenChunker (token-aware)");
  console.log("-".repeat(40));

  const tokenChunker = new TokenChunker({
    chunkSize: 100, // 100 tokens
    chunkOverlap: 10,
  });

  const tokenChunks = await tokenChunker.chunk(sampleDoc, {
    sourceId: "sample-doc",
  });

  console.log(`Created ${tokenChunks.length} chunks`);
  for (let i = 0; i < Math.min(3, tokenChunks.length); i++) {
    const chunk = tokenChunks[i];
    console.log(
      `  Chunk ${i}: ~${chunk.metadata.tokenCount} tokens, ${chunk.metadata.charCount} chars`
    );
  }
  console.log();

  // Example 4: Chunk with custom processor
  console.log("4. Chunker with custom processor (filtering)");
  console.log("-".repeat(40));

  const filteringChunker = new TextChunker({
    chunkSize: 150,
    chunkProcessor: (chunk) => {
      // Filter out very short chunks
      if (chunk.content.trim().length < 50) {
        console.log(`  Filtered out short chunk: "${chunk.content.trim().substring(0, 30)}..."`);
        return null;
      }
      // Add custom metadata
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          processedAt: new Date().toISOString(),
        },
      };
    },
  });

  const filteredChunks = await filteringChunker.chunk(sampleDoc);
  console.log(`Created ${filteredChunks.length} chunks after filtering\n`);

  // Example 5: Chunk linking
  console.log("5. Chunk linking (previous/next)");
  console.log("-".repeat(40));

  const linkedChunks = await textChunker.chunk("First part. Second part. Third part. Fourth part.", {
    sourceId: "linked-doc",
  });

  for (const chunk of linkedChunks) {
    console.log(`  ${chunk.id}:`);
    console.log(`    prev: ${chunk.metadata.previousChunkId ?? "null"}`);
    console.log(`    next: ${chunk.metadata.nextChunkId ?? "null"}`);
  }
  console.log();

  // Example 6: Full ingestion pipeline (requires API keys)
  console.log("6. Full Ingestion Pipeline");
  console.log("-".repeat(40));

  if (!process.env.OPENAI_API_KEY) {
    console.log("Skipping ingestion pipeline (OPENAI_API_KEY not set)");
    console.log("Set OPENAI_API_KEY to run the full pipeline example.\n");
  } else {
    try {
      // Create components
      const embeddings = new OpenAIEmbeddings({
        model: "text-embedding-3-small",
      });

      const store = await LanceDBVectorStore.create({
        name: "ingestion-demo",
        uri: "./data/ingestion-demo",
        tableName: "documents",
        embeddings,
      });

      const pipeline = new IngestionPipeline(
        new RecursiveChunker({ chunkSize: 500, chunkOverlap: 50 }),
        embeddings,
        store
      );

      // Ingest the sample document
      const result = await pipeline.ingest(sampleDoc, {
        sourceId: "sample-doc",
        sourcePath: "/docs/sample.md",
        metadata: {
          author: "demo",
          createdAt: new Date().toISOString(),
        },
        batchSize: 10,
        onProgress: ({ phase, processed, total }) => {
          console.log(`  ${phase}: ${processed}/${total}`);
        },
      });

      console.log("\nIngestion complete:");
      console.log(`  Chunks processed: ${result.chunksProcessed}`);
      console.log(`  Chunks stored: ${result.chunksStored}`);
      console.log(`  Duration: ${result.duration}ms`);
      console.log(`  Errors: ${result.errors.length}`);

      // Test search
      console.log("\nTesting search...");
      const searchResults = await store.search("chunking strategies", {
        limit: 3,
      });

      console.log(`Found ${searchResults.length} results:`);
      for (const result of searchResults) {
        console.log(`  - Score: ${result.score.toFixed(3)}`);
        console.log(`    Content: ${result.document.content.substring(0, 80)}...`);
      }
    } catch (error) {
      console.error("Pipeline error:", error);
    }
  }

  // Example 7: Batch ingestion
  console.log("\n7. Batch Document Ingestion");
  console.log("-".repeat(40));

  if (!process.env.OPENAI_API_KEY) {
    console.log("Skipping batch ingestion (OPENAI_API_KEY not set)\n");
  } else {
    try {
      const embeddings = new OpenAIEmbeddings({
        model: "text-embedding-3-small",
      });

      const store = await LanceDBVectorStore.create({
        name: "batch-demo",
        uri: "./data/batch-demo",
        tableName: "documents",
        embeddings,
      });

      const pipeline = new IngestionPipeline(
        new RecursiveChunker({ chunkSize: 300 }),
        embeddings,
        store
      );

      // Simulate multiple documents
      const documents = [
        {
          text: "Document 1: Introduction to machine learning concepts and algorithms.",
          options: { sourceId: "doc-1", metadata: { category: "ml" } },
        },
        {
          text: "Document 2: Deep learning fundamentals including neural networks and backpropagation.",
          options: { sourceId: "doc-2", metadata: { category: "dl" } },
        },
        {
          text: "Document 3: Natural language processing techniques for text analysis.",
          options: { sourceId: "doc-3", metadata: { category: "nlp" } },
        },
      ];

      const result = await pipeline.ingestMany(documents, {
        batchSize: 5,
        onProgress: ({ phase, processed, total }) => {
          console.log(`  ${phase}: ${processed}/${total}`);
        },
      });

      console.log("\nBatch ingestion complete:");
      console.log(`  Total chunks: ${result.chunksStored}`);
      console.log(`  Duration: ${result.duration}ms`);
    } catch (error) {
      console.error("Batch ingestion error:", error);
    }
  }

  console.log("\n=== Examples Complete ===");
}

main().catch(console.error);
