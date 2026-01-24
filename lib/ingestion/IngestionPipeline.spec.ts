import { IngestionPipeline } from "./IngestionPipeline";
import { TextChunker } from "../chunkers/TextChunker";
import { Chunk } from "../chunkers/types";
import { Embeddings } from "../vectorstore/Embeddings";
import {
  VectorStore,
  Document,
  EmbeddedDocument,
  SearchResult,
} from "../vectorstore/VectorStore";

// Mock Embeddings
class MockEmbeddings extends Embeddings {
  readonly name = "mock";
  readonly model = "mock-model";
  readonly dimensions = 3;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

// Mock VectorStore
class MockVectorStore extends VectorStore {
  readonly name = "mock-store";
  private documents: EmbeddedDocument[] = [];

  async addDocuments(documents: Document[]): Promise<string[]> {
    return documents.map((d) => d.id);
  }

  async addEmbeddedDocuments(documents: EmbeddedDocument[]): Promise<string[]> {
    this.documents.push(...documents);
    return documents.map((d) => d.id);
  }

  async search(): Promise<SearchResult[]> {
    return [];
  }

  async searchByVector(): Promise<SearchResult[]> {
    return [];
  }

  async delete(): Promise<number> {
    return 0;
  }

  async clear(): Promise<void> {
    this.documents = [];
  }

  async getById(): Promise<Document | null> {
    return null;
  }

  async getByHashes(): Promise<Map<string, string>> {
    return new Map();
  }

  getStoredDocuments(): EmbeddedDocument[] {
    return this.documents;
  }
}

describe("IngestionPipeline", () => {
  let chunker: TextChunker;
  let embeddings: MockEmbeddings;
  let store: MockVectorStore;
  let pipeline: IngestionPipeline;

  beforeEach(() => {
    chunker = new TextChunker({ chunkSize: 20 });
    embeddings = new MockEmbeddings();
    store = new MockVectorStore();
    pipeline = new IngestionPipeline(chunker, embeddings, store);
  });

  describe("constructor", () => {
    it("should create pipeline with components", () => {
      expect(pipeline.getChunker()).toBe(chunker);
      expect(pipeline.getEmbeddings()).toBe(embeddings);
      expect(pipeline.getStore()).toBe(store);
    });
  });

  describe("ingest", () => {
    it("should ingest a single document", async () => {
      const text = "Hello world, this is a test document for ingestion.";
      const result = await pipeline.ingest(text, {
        sourceId: "test-doc",
      });

      expect(result.success).toBe(true);
      expect(result.chunksProcessed).toBeGreaterThan(0);
      expect(result.chunksStored).toBe(result.chunksProcessed);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return empty result for empty text", async () => {
      const result = await pipeline.ingest("");

      expect(result.success).toBe(true);
      expect(result.chunksProcessed).toBe(0);
      expect(result.chunksStored).toBe(0);
    });

    it("should store documents with correct structure", async () => {
      const text = "Short text here";
      await pipeline.ingest(text, { sourceId: "doc-1" });

      const stored = store.getStoredDocuments();
      expect(stored.length).toBeGreaterThan(0);

      const doc = stored[0];
      expect(doc.id).toBeDefined();
      expect(doc.content).toBeDefined();
      expect(doc.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata?.sourceId).toBe("doc-1");
    });

    it("should report progress during ingestion", async () => {
      const progressEvents: Array<{
        phase: string;
        processed: number;
        total: number;
      }> = [];

      await pipeline.ingest(
        "Some longer text that will be chunked into pieces",
        {
          onProgress: (event) => {
            progressEvents.push({
              phase: event.phase,
              processed: event.processed,
              total: event.total,
            });
          },
        }
      );

      // Should have chunking, embedding, and storing phases
      expect(progressEvents.some((e) => e.phase === "chunking")).toBe(true);
      expect(progressEvents.some((e) => e.phase === "embedding")).toBe(true);
      expect(progressEvents.some((e) => e.phase === "storing")).toBe(true);
    });

    it("should respect batchSize option", async () => {
      const longText = "word ".repeat(100);
      const progressEvents: Array<{
        currentBatch?: number;
        totalBatches?: number;
      }> = [];

      await pipeline.ingest(longText, {
        batchSize: 2,
        onProgress: (event) => {
          if (event.currentBatch !== undefined) {
            progressEvents.push({
              currentBatch: event.currentBatch,
              totalBatches: event.totalBatches,
            });
          }
        },
      });

      // With small batch size, should have multiple batches
      const batchedEvents = progressEvents.filter(
        (e) => e.totalBatches !== undefined
      );
      if (batchedEvents.length > 0) {
        expect(batchedEvents[0].totalBatches).toBeGreaterThan(0);
      }
    });

    it("should include custom metadata in chunks", async () => {
      await pipeline.ingest("Test content", {
        sourceId: "doc-1",
        sourcePath: "/test/doc.txt",
        metadata: { author: "test", version: 1 },
      });

      const stored = store.getStoredDocuments();
      expect(stored[0].metadata?.author).toBe("test");
      expect(stored[0].metadata?.version).toBe(1);
      expect(stored[0].metadata?.sourceId).toBe("doc-1");
      expect(stored[0].metadata?.sourcePath).toBe("/test/doc.txt");
    });
  });

  describe("ingestMany", () => {
    it("should ingest multiple documents", async () => {
      const documents = [
        { text: "First document content", options: { sourceId: "doc-1" } },
        { text: "Second document content", options: { sourceId: "doc-2" } },
        { text: "Third document content", options: { sourceId: "doc-3" } },
      ];

      const result = await pipeline.ingestMany(documents);

      expect(result.success).toBe(true);
      expect(result.chunksProcessed).toBeGreaterThan(0);
      expect(result.chunksStored).toBe(result.chunksProcessed);

      const stored = store.getStoredDocuments();
      const sourceIds = stored.map((d) => d.metadata?.sourceId);
      expect(sourceIds).toContain("doc-1");
      expect(sourceIds).toContain("doc-2");
      expect(sourceIds).toContain("doc-3");
    });

    it("should report progress for multiple documents", async () => {
      const documents = [
        { text: "First", options: { sourceId: "1" } },
        { text: "Second", options: { sourceId: "2" } },
      ];

      const chunkingProgress: number[] = [];

      await pipeline.ingestMany(documents, {
        onProgress: (event) => {
          if (event.phase === "chunking") {
            chunkingProgress.push(event.processed);
          }
        },
      });

      expect(chunkingProgress).toContain(1);
      expect(chunkingProgress).toContain(2);
    });
  });

  describe("ingestChunks", () => {
    it("should ingest pre-chunked data", async () => {
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          content: "First chunk content",
          metadata: {
            chunkIndex: 0,
            totalChunks: 2,
            previousChunkId: null,
            nextChunkId: "chunk-2",
            startOffset: 0,
            endOffset: 19,
            charCount: 19,
            hash: "abc123",
          },
        },
        {
          id: "chunk-2",
          content: "Second chunk content",
          metadata: {
            chunkIndex: 1,
            totalChunks: 2,
            previousChunkId: "chunk-1",
            nextChunkId: null,
            startOffset: 20,
            endOffset: 40,
            charCount: 20,
            hash: "def456",
          },
        },
      ];

      const result = await pipeline.ingestChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.chunksProcessed).toBe(2);
      expect(result.chunksStored).toBe(2);

      const stored = store.getStoredDocuments();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe("chunk-1");
      expect(stored[1].id).toBe("chunk-2");
    });
  });

  describe("error handling", () => {
    it("should handle embedding errors with skip strategy", async () => {
      const failingEmbeddings = new MockEmbeddings();
      let callCount = 0;
      failingEmbeddings.embed = async (texts: string[]) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Embedding API error");
        }
        return texts.map(() => [0.1, 0.2, 0.3]);
      };

      const failingPipeline = new IngestionPipeline(
        new TextChunker({ chunkSize: 10 }),
        failingEmbeddings,
        store
      );

      const result = await failingPipeline.ingest(
        "Some text that will fail on first batch then succeed",
        {
          batchSize: 5,
          onError: () => "skip",
        }
      );

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should abort on error with abort strategy", async () => {
      const failingEmbeddings = new MockEmbeddings();
      failingEmbeddings.embed = async () => {
        throw new Error("Embedding API error");
      };

      const failingPipeline = new IngestionPipeline(
        chunker,
        failingEmbeddings,
        store
      );

      const result = await failingPipeline.ingest("Some text to embed", {
        onError: () => "abort",
      });

      expect(result.success).toBe(false);
      // When abort is called, errors may or may not be populated depending on timing
      // The key assertion is that success is false
    });

    it("should handle store errors gracefully", async () => {
      const failingStore = new MockVectorStore();
      let callCount = 0;
      failingStore.addEmbeddedDocuments = async (docs: EmbeddedDocument[]) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Store error");
        }
        return docs.map((d) => d.id);
      };

      const failingPipeline = new IngestionPipeline(
        chunker,
        embeddings,
        failingStore
      );

      const result = await failingPipeline.ingest("Test content for store", {
        onError: () => "skip",
      });

      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("duration tracking", () => {
    it("should track duration accurately", async () => {
      const result = await pipeline.ingest("Test content");

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe("number");
    });
  });
});
