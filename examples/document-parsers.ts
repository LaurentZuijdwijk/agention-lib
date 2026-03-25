/**
 * Document Parsers Example
 *
 * Demonstrates the three document parser backends and how they plug into
 * the IngestionPipeline via ingestFile() / ingestFiles().
 *
 * Prerequisites (install only what you plan to use):
 *   npm install @epilogo/unstructured-io-node   # local Python backend
 *   npm install unstructured-client              # hosted/self-hosted API
 *   npm install @llamaindex/readers              # LlamaIndex readers
 *
 * Run with:
 *   npm run example -- examples/document-parsers.ts
 */
import "dotenv/config";
import path from "path";
import { RecursiveChunker, ElementChunker, IngestionPipeline } from "../lib";
import { OpenAIEmbeddings } from "../lib/embeddings/OpenAIEmbeddings";
import { LanceDBVectorStore } from "../lib/vectorstore/LanceDBVectorStore";

// ─── helpers ────────────────────────────────────────────────────────────────

function separator(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

// ─── shared pipeline ─────────────────────────────────────────────────────────

/**
 * Build a pipeline that uses ElementChunker when the parser returns structured
 * elements (Unstructured), or falls back to RecursiveChunker for plain text.
 *
 * ElementChunker respects element boundaries (Title, NarrativeText, Table…)
 * and stores element_types in chunk metadata. Swap it for RecursiveChunker if
 * you prefer character-based splitting.
 */
async function buildPipeline(
  tableName: string,
  parser?: import("../lib/parsers/DocumentParser").DocumentParser
): Promise<IngestionPipeline> {
  const chunker = new ElementChunker({
    chunkSize: 512,
    breakOnTypes: ["Title"],
    excludeTypes: ["Image", "PageBreak", "Header", "Footer"],
  });

  const embeddings = new OpenAIEmbeddings();
  const store = await LanceDBVectorStore.create({
    name: tableName,
    uri: "./tmp/parsers-demo",
    tableName,
    embeddings,
  });

  // Pass the parser to the pipeline so ingestFile/ingestFiles
  // don't require it at every call site.
  return new IngestionPipeline(chunker, embeddings, store, parser);
}

// ─── Example 1: UnstructuredLocalParser ──────────────────────────────────────

async function exampleLocal() {
  separator("1 · UnstructuredLocalParser  (@epilogo/unstructured-io-node)");

  // Import only when needed — keeps the dependency optional.
  const { UnstructuredLocalParser } = await import(
    "../lib/parsers/UnstructuredLocalParser"
  );

  const parser = new UnstructuredLocalParser();
  console.log(`Parser: ${parser.name}`);

  // Parse a PDF locally using the Python unstructured library.
  // ensureEnvironmentSetup() is called automatically on first use.
  const filePath = path.resolve("./examples/data/sample.pdf");

  console.log(`Parsing ${filePath} …`);
  const doc = await parser.parse(filePath, {
    strategy: "auto",   // "auto" | "fast" | "hi_res" | "ocr_only"
    languages: ["eng"],
  });

  console.log(`  text length  : ${doc.text.length} chars`);
  console.log(`  elements     : ${doc.elements?.length ?? "n/a"}`);

  if (doc.elements?.length) {
    console.log("\n  First 3 elements:");
    doc.elements.slice(0, 3).forEach((el, i) => {
      const page = el.metadata?.["page_number"] ? ` (p.${el.metadata["page_number"]})` : "";
      console.log(`    [${i}] ${el.type}${page}: ${el.text.slice(0, 80)} …`);
    });
  }

  // Build a pipeline with the parser baked in — no need to pass it per call.
  console.log("\n  Ingesting via pipeline …");
  const pipeline = await buildPipeline("local-parser-demo", parser);
  const result = await pipeline.ingestFile(filePath, {
    strategy: "auto",
    sourceId: "sample-pdf",
    skipDuplicates: true,
    onProgress: ({ phase, processed, total }) =>
      console.log(`    [${phase}] ${processed}/${total}`),
  });

  console.log(`  Stored ${result.chunksStored} chunks in ${result.duration}ms`);
}

// ─── Example 2: UnstructuredAPIParser ────────────────────────────────────────

async function exampleAPI() {
  separator("2 · UnstructuredAPIParser  (unstructured-client)");

  const { UnstructuredAPIParser } = await import(
    "../lib/parsers/UnstructuredAPIParser"
  );

  // Option A — self-hosted open-source API server (no key needed):
  //   docker run -p 8000:8000 downloads.unstructured.io/unstructured-io/unstructured-api
  const parser = new UnstructuredAPIParser({
    serverUrl: process.env.UNSTRUCTURED_API_URL ?? "http://localhost:8000",
    // apiKey: process.env.UNSTRUCTURED_API_KEY,  // for the hosted service
  });

  console.log(`Parser: ${parser.name}`);

  const filePath = path.resolve("./examples/data/sample.pdf");

  console.log(`Parsing ${filePath} via API …`);
  const doc = await parser.parse(filePath, { strategy: "fast" });

  console.log(`  text length  : ${doc.text.length} chars`);
  console.log(`  elements     : ${doc.elements?.length ?? "n/a"}`);

  // Batch multiple files — parser is on the pipeline, not repeated per call.
  console.log("\n  Batch-ingesting multiple files …");
  const pipeline = await buildPipeline("api-parser-demo", parser);
  const result = await pipeline.ingestFiles(
    [filePath],
    {
      strategy: "fast",
      skipDuplicates: true,
      onProgress: ({ phase, processed, total }) =>
        console.log(`    [${phase}] ${processed}/${total}`),
    }
  );
  console.log(`  Stored ${result.chunksStored} chunks in ${result.duration}ms`);
}

// ─── Example 3: LlamaIndexParser ─────────────────────────────────────────────

async function exampleLlamaIndex() {
  separator("3 · LlamaIndexParser  (@llamaindex/readers)");

  const { LlamaIndexParser } = await import("../lib/parsers/LlamaIndexParser");

  // Use any LlamaIndex reader — PDFReader, DocxReader, HTMLReader, etc.
  // Here we import dynamically so the dep is truly optional.
  const { PDFReader } = await import("@llamaindex/readers/pdf");
  const reader = new PDFReader();

  const parser = new LlamaIndexParser(reader);
  console.log(`Parser: ${parser.name}`);

  const filePath = path.resolve("./examples/data/sample.pdf");

  console.log(`Parsing ${filePath} …`);
  const doc = await parser.parse(filePath);

  console.log(`  text length  : ${doc.text.length} chars`);
  console.log(`  elements     : ${doc.elements?.length ?? "n/a"}`);

  console.log("\n  Ingesting via pipeline …");
  const pipeline = await buildPipeline("llamaindex-parser-demo", parser);
  const result = await pipeline.ingestFile(filePath, {
    sourceId: "sample-pdf-llama",
    skipDuplicates: true,
    onProgress: ({ phase, processed, total }) =>
      console.log(`    [${phase}] ${processed}/${total}`),
  });
  console.log(`  Stored ${result.chunksStored} chunks in ${result.duration}ms`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Document Parsers Demo");
  console.log("Each parser is loaded lazily — only the ones you call are required.\n");

  // Run whichever examples are relevant to the deps you have installed.
  // Comment out any that aren't applicable.

  try {
    await exampleLocal();
  } catch (err) {
    console.warn(`  [skipped] local parser: ${(err as Error).message}`);
  }

  try {
    await exampleAPI();
  } catch (err) {
    console.warn(`  [skipped] API parser: ${(err as Error).message}`);
  }

  try {
    await exampleLlamaIndex();
  } catch (err) {
    console.warn(`  [skipped] LlamaIndex parser: ${(err as Error).message}`);
  }
}

main().catch(console.error);
