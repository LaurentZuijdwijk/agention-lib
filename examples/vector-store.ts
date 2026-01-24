import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";
import { OpenAIEmbeddings } from "../lib/vectorstore/OpenAIEmbeddings";
import { RecursiveChunker, IngestionPipeline, OpenAiAgent } from "../lib";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { createInterface } from "node:readline/promises";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Recursively load all markdown files from a directory
 */
function loadMarkdownFiles(
  dir: string,
  baseDir?: string
): Array<{ path: string; content: string }> {
  const base = baseDir || dir;
  const files: Array<{ path: string; content: string }> = [];

  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively load from subdirectories
      files.push(...loadMarkdownFiles(fullPath, base));
    } else if (item.endsWith(".md")) {
      // Load markdown file
      const content = readFileSync(fullPath, "utf-8");
      const relativePath = fullPath.replace(base + "/", "");
      files.push({ path: relativePath, content });
    }
  }

  return files;
}

async function vectorStoreExample() {
  console.log("Vector Store Example with RAG Agent\n");
  console.log("====================================\n");

  // Check for required API keys
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is required for embeddings");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is required for the agent");
    process.exit(1);
  }

  try {
    // Step 1: Create embeddings provider
    console.log("1. Creating OpenAI embeddings provider...");
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
    console.log(
      `   Model: ${embeddings.model}, Dimensions: ${embeddings.dimensions}\n`
    );

    // Step 2: Create vector store
    console.log("2. Creating LanceDB vector store...");
    const store = await LanceDBVectorStore.create({
      name: "knowledge_base",
      uri: "./examples/data/vectors",
      tableName: "agention_docs",
      embeddings,
    });
    console.log("   Store created successfully\n");

    // Step 3: Create chunker
    console.log("3. Creating RecursiveChunker for semantic splitting...");
    const chunker = new RecursiveChunker({
      chunkSize: 1000,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", ". ", " "],
    });
    console.log("   Chunker created\n");

    // Step 4: Create ingestion pipeline
    console.log("4. Creating ingestion pipeline...");
    const pipeline = new IngestionPipeline(chunker, embeddings, store);
    console.log("   Pipeline ready\n");

    // Step 5: Load and ingest documentation files
    console.log("5. Loading documentation files from docs/guide/...");
    const docsPath = join(__dirname, "../docs/guide");
    const markdownFiles = loadMarkdownFiles(docsPath);
    console.log(`   Found ${markdownFiles.length} markdown files\n`);

    // Step 6: Ingest documents using pipeline
    console.log("6. Ingesting documents (this may take a moment)...");

    const documents = markdownFiles.map((file) => ({
      text: file.content,
      options: {
        sourceId: file.path,
        sourcePath: file.path,
        metadata: {
          source: file.path,
          type: "documentation",
        },
      },
    }));

    const result = await pipeline.ingestMany(documents, {
      batchSize: 10,
      skipDuplicates: true, // Skip chunks that already exist (by content hash)
      onProgress: ({ phase, processed, total }) => {
        console.log(`   ${phase}: ${processed}/${total}`);
      },
    });

    console.log("\n   Ingestion complete:");
    console.log(`   - Chunks processed: ${result.chunksProcessed}`);
    console.log(`   - Chunks skipped (duplicates): ${result.chunksSkipped}`);
    console.log(`   - Chunks stored: ${result.chunksStored}`);
    console.log(`   - Duration: ${result.duration}ms`);
    console.log(`   - Errors: ${result.errors.length}\n`);

    // Step 7: Test direct search
    console.log('7. Testing direct search for "pipeline"...');
    const searchResults = await store.search(
      "How do I chain agents together?",
      {
        limit: 3,
      }
    );
    console.log("   Top results:");
    for (const result of searchResults) {
      console.log(
        `   - [${result.score.toFixed(3)}] ${result.document.metadata?.source}`
      );
      console.log(`     ${result.document.content.substring(0, 100)}...\n`);
    }

    // Step 8: Create retrieval and navigation tools
    console.log("8. Creating tools for the agent...");
    const searchTool = store.toRetrievalTool(
      "Search the Agention documentation for information about agents, tools, pipelines, vector stores, and other features",
      { defaultLimit: 3 }
    );
    const getChunkTool = store.toGetChunkByIdTool(
      "Retrieve a specific chunk by ID. Use this to get more context by reading previous or next chunks. Check the metadata.previousChunkId and metadata.nextChunkId fields from search results."
    );
    console.log(`   Search tool: ${searchTool.name}`);
    console.log(`   Get chunk tool: ${getChunkTool.name}\n`);

    // Step 9: Create agent with the tools
    console.log("9. Creating Claude agent with search and navigation tools...");
    const agent = new OpenAiAgent({
      id: "rag-agent",
      name: "Documentation Assistant",
      description:
        "You are a helpful assistant that answers questions about Agention. Always use the search tool to find relevant documentation before answering. If you need more context, use the get_chunk tool with previousChunkId or nextChunkId to read surrounding chunks. Base your answers on the search results and cite the source files.",
      apiKey: process.env.OPENAI_API_KEY as string,
      tools: [searchTool, getChunkTool],
      model: "gpt-4.1-nano",
    });
    console.log("   Agent created\n");

    // Step 10: Interactive Q&A
    console.log("10. Interactive Q&A (type 'exit' to quit)\n");
    console.log("   Try asking:\n");
    console.log("   - What are the different types of executors?");
    console.log("   - How do I create a pipeline?");
    console.log("   - What embedding models are supported?");
    console.log("   - How do vector stores work?\n");

    while (true) {
      const question = await rl.question("You: ");

      if (question.toLowerCase() === "exit") {
        console.log("\nGoodbye!");
        break;
      }

      if (!question.trim()) {
        continue;
      }

      console.log("\nAssistant: Searching documentation...\n");

      const response = await agent.execute(question);
      console.log(`Assistant: ${response}\n`);
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    rl.close();
    process.exit(1);
  }
}

vectorStoreExample();
