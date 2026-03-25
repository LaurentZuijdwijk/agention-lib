# Chunking and Ingestion

Document chunking and ingestion are essential for building RAG (Retrieval-Augmented Generation) applications. Chunking breaks large documents into manageable pieces that fit within LLM context windows, while the ingestion pipeline orchestrates embedding and storage.

## Overview

The chunking and ingestion system includes:

- **Document Parsers** - Extract text from PDFs, Word docs, HTML, and more
- **Chunkers** - Split text into pieces using different strategies
- **IngestionPipeline** - Orchestrates chunking, embedding, and storage
- **Metadata Tracking** - Maintains context and linking between chunks
- **Progress Monitoring** - Real-time updates during processing

## Chunking Strategies

Choose the right chunker based on your document type and use case.

### TextChunker

Simple character-based splitting with optional overlap. Best for uniform content like logs or transcripts.

```typescript
import { TextChunker } from '@agentionai/agents/core';

const chunker = new TextChunker({
  chunkSize: 1000,      // Characters per chunk
  chunkOverlap: 200,    // Character overlap between chunks
});

const chunks = await chunker.chunk(text, {
  sourceId: 'doc-123',
  sourcePath: '/docs/readme.md',
});

console.log(`Created ${chunks.length} chunks`);
```

**Use when:**
- Processing uniform-length text
- Overlap is important for context preservation
- You want predictable chunk sizes

### RecursiveChunker

Intelligent splitting on semantic boundaries (paragraphs → sentences → words). Best for structured documents like markdown or documentation.

```typescript
import { RecursiveChunker } from '@agentionai/agents/core';

const chunker = new RecursiveChunker({
  chunkSize: 1000,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '. ', ' '],  // Try in order
});

const chunks = await chunker.chunk(text, {
  sourceId: 'doc-123',
  metadata: { type: 'documentation' },
});
```

The chunker tries separators in order, falling back to smaller ones as needed:

1. `\n\n` - Paragraphs (largest semantic unit)
2. `\n` - Lines
3. `. ` - Sentences
4. ` ` - Words
5. Character-based fallback

**Use when:**
- Processing markdown, articles, or documentation
- Semantic coherence is important
- Documents have clear structure

### TokenChunker

Token-aware splitting using the `tokenx` library. Ensures chunks fit within LLM token limits with ~96% accuracy.

```typescript
import { TokenChunker } from '@agentionai/agents/core';

const chunker = new TokenChunker({
  chunkSize: 500,       // Tokens per chunk (not characters)
  chunkOverlap: 50,     // Token overlap
});

const chunks = await chunker.chunk(text);

// Each chunk includes token count in metadata
console.log(chunks[0].metadata.token_count);  // e.g., 487
```

**Use when:**
- You have strict token budget constraints
- Working with multiple languages (token count varies)
- Precise LLM context management is critical

### ElementChunker

Groups **structured elements** (from document parsers like Unstructured) into chunks that respect semantic boundaries — titles, paragraphs, tables — rather than splitting raw text by character count.

```typescript
import { ElementChunker } from '@agentionai/agents/chunkers';

const chunker = new ElementChunker({
  chunkSize: 1000,
  breakOnTypes: ['Title'],                          // always start a new chunk on these types
  excludeTypes: ['Image', 'PageBreak', 'Footer'],   // skip decorative elements
});

// Primary use: via IngestionPipeline.ingestFile with a document parser
// The pipeline calls chunkElements() automatically when elements are present.

// Direct use with a parsed document's element list:
const chunks = await chunker.chunkElements(doc.elements, {
  sourceId: 'report-2024',
  sourcePath: '/docs/report.pdf',
});

// Fallback: also works as a regular chunker on plain text
const chunks = await chunker.chunk(plainText);
```

Each chunk's metadata includes two extra fields:

| Field | Type | Description |
|---|---|---|
| `element_types` | `string[]` | Deduplicated types of elements merged into this chunk |
| `page` | `number \| undefined` | Page number from the first element that provides one |

**Use when:**
- Ingesting PDFs, Word docs, or HTML via Unstructured or a similar parser
- You want chunk boundaries to align with document structure (section headings, table rows, etc.)
- You want element type metadata for filtering or re-ranking at retrieval time

## Chunk Metadata

Each chunk includes rich metadata for tracking and linking:

```typescript
interface ChunkMetadata {
  // Position & linking
  index: number;              // Position in sequence
  total: number;              // Total chunk count
  prev_id: string | null;     // Link to previous chunk
  next_id: string | null;     // Link to next chunk

  // Source tracking
  start: number;              // Character position in original text
  end: number;                // Character position in original text
  source_id?: string;         // Document identifier
  source_path?: string;       // File path

  // Content info
  char_count: number;         // Number of characters
  token_count?: number;       // Estimated tokens (TokenChunker only)
  hash: string;               // SHA-256 hash for deduplication

  // Structure
  section?: string;           // Detected section heading
  page?: number;              // Page number (e.g., PDF page)

  // Custom metadata
  [key: string]: unknown;     // User-provided values
}
```

When stored in LanceDB, these fields are automatically packed into a `chunk_metadata` struct column. User-defined metadata (like `author`, `category`) is stored as separate top-level columns declared via `metadataFields`.

> **Note:** Use `snake_case` for metadata field names (e.g. `tenant_id`, not `tenantId`). LanceDB uses DataFusion for SQL filtering, which normalizes unquoted identifiers to lowercase. Mixed-case column names will fail to match during filtering.

## Chunk Processing

Apply transformations or filters to chunks after splitting:

```typescript
const chunker = new TextChunker({
  chunkSize: 500,
  chunkProcessor: async (chunk, index, allChunks) => {
    // Filter out very short chunks
    if (chunk.content.length < 50) {
      return null;  // Skip this chunk
    }

    // Add custom metadata
    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        wordCount: chunk.content.split(/\s+/).length,
        processedAt: new Date().toISOString(),
      },
    };
  },
});

const chunks = await chunker.chunk(text);
```

Processors can:
- Filter chunks based on content
- Add computed metadata
- Transform content (e.g., normalize whitespace)
- Return `null` to skip a chunk

## Ingestion Pipeline

The pipeline orchestrates the full workflow: chunk → embed → store.

### Basic Ingestion

```typescript
import { IngestionPipeline, RecursiveChunker, LanceDBVectorStore } from '@agentionai/agents/core';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

// Create pipeline components
const chunker = new RecursiveChunker({
  chunkSize: 1000,
  chunkOverlap: 100,
});

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

const store = await LanceDBVectorStore.create({
  name: 'my-documents',
  uri: './data/documents',
  tableName: 'chunks',
  embeddings,
  // Use snake_case for field names — LanceDB normalizes SQL identifiers to lowercase
  metadataFields: [
    { name: 'source', type: 'string' },
    { name: 'category', type: 'string' },
  ],
});

// Create pipeline
const pipeline = new IngestionPipeline(chunker, embeddings, store);

// Ingest a document
const result = await pipeline.ingest(documentText, {
  sourceId: 'doc-001',
  sourcePath: '/docs/guide.md',
  batchSize: 50,
  onProgress: ({ phase, processed, total }) => {
    console.log(`${phase}: ${processed}/${total}`);
  },
});

console.log(`Stored ${result.chunksStored} chunks in ${result.duration}ms`);
```

### Batch Ingestion

Process multiple documents efficiently:

```typescript
const documents = [
  {
    text: 'Document 1 content...',
    options: {
      sourceId: 'doc-1',
      metadata: { author: 'Alice' },
    },
  },
  {
    text: 'Document 2 content...',
    options: {
      sourceId: 'doc-2',
      metadata: { author: 'Bob' },
    },
  },
];

const result = await pipeline.ingestMany(documents, {
  batchSize: 100,
  onProgress: ({ phase, processed, total }) => {
    console.log(`${phase}: ${processed}/${total}`);
  },
});

console.log(`Total chunks stored: ${result.chunksStored}`);
```

### Pre-chunked Data

If you've already chunked your data:

```typescript
const chunks = await chunker.chunk(text);

// Do custom processing or filtering...

const result = await pipeline.ingestChunks(chunks, {
  batchSize: 50,
});
```

## Progress Monitoring

Track ingestion progress across three phases:

```typescript
const result = await pipeline.ingest(text, {
  onProgress: (event) => {
    console.log(`Phase: ${event.phase}`);              // "chunking" | "embedding" | "storing"
    console.log(`Processed: ${event.processed}`);      // Items done in this phase
    console.log(`Total: ${event.total}`);              // Total items in this phase
    console.log(`Batch: ${event.currentBatch}/${event.totalBatches}`);  // For batch phases

    // Update UI progress bar
    const progress = (event.processed / event.total) * 100;
    updateProgressBar(progress);
  },
});
```

Phases:

1. **chunking** - Text is split into chunks
2. **embedding** - Chunks are embedded in batches
3. **storing** - Embeddings are stored in the vector database

## Error Handling

Control how errors are handled during ingestion:

```typescript
const result = await pipeline.ingest(text, {
  onError: (error, chunk) => {
    console.error(`Error on chunk ${chunk.id}:`, error.message);

    // Return 'skip' to continue with next chunk
    // Return 'abort' to stop entire ingestion
    if (error.message.includes('rate limit')) {
      return 'skip';  // Skip rate-limited chunks
    } else {
      return 'abort';  // Stop on other errors
    }
  },
});

// Check for errors in result
if (!result.success) {
  console.log(`Ingestion aborted. Errors: ${result.errors.length}`);
}

result.errors.forEach(({ chunk, error }) => {
  console.error(`Failed: ${chunk.id} - ${error.message}`);
});
```

## Ingestion Result

The pipeline returns detailed metrics:

```typescript
interface IngestionResult {
  success: boolean;           // Completed without abort
  chunksProcessed: number;    // Total chunks created
  chunksSkipped: number;      // Duplicates or filtered
  chunksStored: number;       // Successfully stored
  errors: Array<{             // Errors encountered
    chunk: Chunk;
    error: Error;
  }>;
  duration: number;           // Total time in ms
}
```

## Duplicate Detection

Skip chunks that already exist in the store:

```typescript
const result = await pipeline.ingest(text, {
  skipDuplicates: true,  // Enable duplicate detection
});

console.log(`Skipped ${result.chunksSkipped} duplicate chunks`);
```

Note: Requires the vector store to support hash-based lookup.

## Custom ID Generation

Control how chunk IDs are generated:

```typescript
const chunker = new TextChunker({
  chunkSize: 500,
  idGenerator: (content, index, sourceId) => {
    // Generate custom IDs
    const timestamp = Date.now();
    return `${sourceId}-${timestamp}-${index}`;
  },
});
```

## Advanced: Custom Chunking

Implement your own chunker by extending the base class:

```typescript
import { Chunker, ChunkerConfig } from '@agentionai/agents/core';

class MyChunker extends Chunker {
  readonly name = 'MyChunker';

  protected splitText(text: string): string[] {
    // Implement your splitting logic
    return [];
  }
}

const chunker = new MyChunker({ chunkSize: 1000 });
```

## Best Practices

1. **Choose the right chunker** - TextChunker for uniform data, RecursiveChunker for structured docs, TokenChunker for LLM constraints
2. **Set appropriate overlap** - 10-20% overlap helps with context preservation
3. **Monitor progress** - Use callbacks for user feedback and debugging
4. **Handle errors gracefully** - Decide whether to skip or abort on errors
5. **Track source information** - Include `sourceId` and `sourcePath` for traceability
6. **Use batch processing** - Larger batches are more efficient but use more memory
7. **Add custom metadata** - Include document type, author, timestamp, etc. for filtering
8. **Test chunk size** - Different content types may need different sizes

## Comparison

| Feature | TextChunker | RecursiveChunker | TokenChunker | ElementChunker |
|---------|------------|------------------|--------------|----------------|
| **Speed** | Very fast | Fast | Fast | Fast |
| **Semantic awareness** | No | Yes | No | Yes (structure-aware) |
| **Token aware** | No | No | Yes | No |
| **Requires parser** | No | No | No | Recommended |
| **Best for** | Logs, transcripts | Markdown, documentation | LLM context limits | PDFs, Word, HTML via Unstructured |
| **Complexity** | Low | Medium | Medium | Low |

## Document Parsers

Before chunking, you typically need to **extract text from real files** — PDFs, Word documents, HTML pages, and more. The parser layer handles this and returns a normalised `ParsedDocument` that feeds directly into the pipeline.

Three backends are available, each as its own sub-path import so you only pay the install cost for what you use.

### UnstructuredLocalParser

Uses the open-source [Unstructured](https://github.com/Unstructured-IO/unstructured) Python library locally via the [`@epilogo/unstructured-io-node`](https://www.npmjs.com/package/@epilogo/unstructured-io-node) bridge. No API key required — Python 3.8+ must be available.

```bash
npm install @epilogo/unstructured-io-node
```

```typescript
import { UnstructuredLocalParser } from '@agentionai/agents/parsers/unstructured-local';

const parser = new UnstructuredLocalParser();

// Parse standalone
const doc = await parser.parse('/docs/report.pdf', {
  strategy: 'hi_res',   // 'auto' | 'fast' | 'hi_res' | 'ocr_only'
  languages: ['eng'],
});

console.log(doc.elements?.length, 'elements');
// e.g. [{ type: 'Title', text: '...', metadata: { page_number: 1 } }, ...]

// Or pipe directly into the ingestion pipeline
const result = await pipeline.ingestFile('/docs/report.pdf', parser, {
  strategy: 'auto',
  sourceId: 'report-2024',
  skipDuplicates: true,
});
```

### UnstructuredAPIParser

Calls the [Unstructured REST API](https://docs.unstructured.io/) — either the hosted cloud service or a self-hosted instance. Uses the official [`unstructured-client`](https://www.npmjs.com/package/unstructured-client) npm package.

```bash
npm install unstructured-client
```

```typescript
import { UnstructuredAPIParser } from '@agentionai/agents/parsers/unstructured-api';

// Self-hosted (no API key needed):
// docker run -p 8000:8000 downloads.unstructured.io/unstructured-io/unstructured-api
const parser = new UnstructuredAPIParser({
  serverUrl: 'http://localhost:8000',
});

// Or use the hosted service:
// const parser = new UnstructuredAPIParser({ apiKey: process.env.UNSTRUCTURED_API_KEY });

const doc = await parser.parse('/docs/report.pdf', { strategy: 'fast' });

// Batch multiple files in one call
const result = await pipeline.ingestFiles(
  ['/docs/a.pdf', '/docs/b.docx'],
  parser,
  { strategy: 'auto', skipDuplicates: true }
);
```

### LlamaIndexParser

Wraps any [LlamaIndex](https://ts.llamaindex.ai/) reader — `PDFReader`, `DocxReader`, `HTMLReader`, `LlamaParseReader`, and more.

```bash
npm install @llamaindex/readers
```

```typescript
import { LlamaIndexParser } from '@agentionai/agents/parsers/llamaindex';
import { PDFReader } from '@llamaindex/readers/pdf';

const parser = new LlamaIndexParser(new PDFReader());
const doc = await parser.parse('/docs/report.pdf');

await pipeline.ingestFile('/docs/report.pdf', parser);
```

Use `LlamaParseReader` for cloud-based OCR and layout AI:

```typescript
import { LlamaParseReader } from 'llamaindex';

const parser = new LlamaIndexParser(
  new LlamaParseReader({ resultType: 'markdown' }),
  'LlamaParse'
);
```

### Parsed elements

All parsers return a `ParsedDocument` with structured elements you can inspect or use for custom chunking:

```typescript
interface ParsedDocument {
  text: string;              // full plain text (ready for chunking)
  elements?: ParsedElement[]; // structured breakdown when available
}

interface ParsedElement {
  type: string;              // 'Title' | 'NarrativeText' | 'Table' | 'Image' | …
  text: string;
  metadata?: Record<string, unknown>; // page_number, coordinates, etc.
}
```

### Element-aware chunking with ElementChunker

When a parser returns structured elements, use `ElementChunker` instead of a text-based chunker. It groups elements into chunks respecting semantic boundaries rather than raw character counts.

```typescript
import { ElementChunker, IngestionPipeline } from '@agentionai/agents/chunkers';

const pipeline = new IngestionPipeline(
  new ElementChunker({
    chunkSize: 1000,
    breakOnTypes: ['Title'],                          // always start a new chunk
    excludeTypes: ['Image', 'PageBreak', 'Footer'],  // skip decorative elements
  }),
  embeddings,
  store,
);

// ingestFile automatically calls chunkElements() when:
//   1. The pipeline's chunker is an ElementChunker, AND
//   2. The parser returned a structured elements list
await pipeline.ingestFile('/docs/report.pdf', new UnstructuredLocalParser());
```

Each chunk's metadata gets two extra fields:
- `element_types: string[]` — deduplicated list of element types in this chunk
- `page?: number` — page number from the first element that has one

Falls back to plain text splitting automatically if the parser returns no elements (e.g. `LlamaIndexParser`).

### Pipeline convenience methods

`IngestionPipeline` has two helpers that combine parsing, chunking, embedding, and storage:

```typescript
// Single file
await pipeline.ingestFile(filePath, parser, {
  strategy: 'auto',        // ParseOptions
  sourceId: 'my-doc',      // ChunkOptions
  skipDuplicates: true,    // IngestionOptions
  onProgress: ({ phase, processed, total }) =>
    console.log(`${phase}: ${processed}/${total}`),
});

// Multiple files (parsed sequentially, embedded and stored in one batch)
await pipeline.ingestFiles(['/a.pdf', '/b.docx', '/c.html'], parser, {
  strategy: 'fast',
  skipDuplicates: true,
});
```

## Examples

See the complete example implementations:

```bash
# Chunking and basic pipeline
npm run example -- examples/ingestion-pipeline.ts

# Document parsers (Unstructured local, API, and LlamaIndex)
npm run example -- examples/document-parsers.ts
```

The parsers example demonstrates:
- All three parser backends
- Standalone parsing and pipeline integration
- Inspecting structured elements
- Batch file ingestion with `ingestFiles()`
- Search on ingested documents
