import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";
import { OpenAIEmbeddings } from "../lib/vectorstore/OpenAIEmbeddings";
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

/**
 * Split content into chunks for better retrieval
 */
function chunkContent(content: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const lines = content.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if (
      (currentChunk + line).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
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

    // Step 3: Load documentation files
    console.log("3. Loading documentation files from docs/guide/...");
    const docsPath = join(__dirname, "../docs/guide");
    const markdownFiles = loadMarkdownFiles(docsPath);
    console.log(`   Found ${markdownFiles.length} markdown files\n`);

    // Step 4: Process and chunk documents
    console.log("4. Processing and chunking documents...");
    const documents = [];
    let docId = 0;

    for (const file of markdownFiles) {
      const chunks = chunkContent(file.content);
      console.log(`   ${file.path}: ${chunks.length} chunks`);

      for (let i = 0; i < chunks.length; i++) {
        documents.push({
          id: `doc-${docId++}`,
          content: chunks[i],
          metadata: {
            source: file.path,
            chunk: i,
            totalChunks: chunks.length,
          },
        });
      }
    }
    console.log(`   Total documents: ${documents.length}\n`);

    // Step 5: Add documents to vector store
    console.log(
      "5. Adding documents to vector store (this may take a moment)..."
    );
    const ids = await store.addDocuments(documents);
    console.log(`   Successfully added ${ids.length} document chunks\n`);

    // Step 6: Test direct search
    console.log('6. Testing direct search for "pipeline"...');
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

    // Step 7: Create retrieval tool
    console.log("7. Creating retrieval tool for the agent...");
    const searchTool = store.toRetrievalTool(
      "Search the Agention documentation for information about agents, tools, pipelines, vector stores, and other features",
      { defaultLimit: 3 }
    );
    console.log(`   Tool name: ${searchTool.name}\n`);

    // Step 8: Create agent with the tool
    console.log("8. Creating Claude agent with search tool...");
    const agent = new ClaudeAgent({
      id: "rag-agent",
      name: "Documentation Assistant",
      description:
        "You are a helpful assistant that answers questions about Agention. Always use the search tool to find relevant documentation before answering. Base your answers on the search results and cite the source files.",
      apiKey: process.env.ANTHROPIC_API_KEY as string,
      tools: [searchTool],
      model: "claude-sonnet-4-20250514",
    });
    console.log("   Agent created\n");

    // Step 9: Interactive Q&A
    console.log("9. Interactive Q&A (type 'exit' to quit)\n");
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
