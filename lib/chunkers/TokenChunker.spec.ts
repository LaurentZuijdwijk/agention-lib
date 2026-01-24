import { TokenChunker } from "./TokenChunker";

// Mock tokenx to avoid actual dependency in tests
jest.mock("tokenx", () => ({
  estimateTokenCount: jest.fn((text: string) => {
    // Simple mock: ~4 characters per token
    return Math.ceil(text.length / 4);
  }),
  splitByTokens: jest.fn((text: string, maxTokens: number) => {
    // Simple mock: split by estimated character count
    const charsPerChunk = maxTokens * 4;
    const chunks: string[] = [];

    if (text.length <= charsPerChunk) {
      return [text];
    }

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + charsPerChunk, text.length);

      // Try to break at word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end + 1;
    }

    return chunks.filter((c) => c.length > 0);
  }),
}));

describe("TokenChunker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create with valid config", () => {
      const chunker = new TokenChunker({ chunkSize: 100 });
      expect(chunker.name).toBe("TokenChunker");
      expect(chunker.getChunkSize()).toBe(100);
    });

    it("should throw if chunkSize is invalid", () => {
      expect(() => new TokenChunker({ chunkSize: 0 })).toThrow();
      expect(() => new TokenChunker({ chunkSize: -1 })).toThrow();
    });
  });

  describe("chunk", () => {
    it("should return empty array for empty text", async () => {
      const chunker = new TokenChunker({ chunkSize: 100 });
      const chunks = await chunker.chunk("");
      expect(chunks).toEqual([]);
    });

    it("should return single chunk for small text", async () => {
      const chunker = new TokenChunker({ chunkSize: 100 });
      const chunks = await chunker.chunk("Hello, world!");

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("Hello, world!");
    });

    it("should split text by token count", async () => {
      const chunker = new TokenChunker({ chunkSize: 10 }); // ~40 chars
      const text =
        "This is a test sentence that should be split into multiple chunks based on token count.";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should include tokenCount in metadata", async () => {
      const chunker = new TokenChunker({ chunkSize: 100 });
      const chunks = await chunker.chunk("Hello, world!");

      expect(chunks[0].metadata.tokenCount).toBeDefined();
      expect(typeof chunks[0].metadata.tokenCount).toBe("number");
    });

    it("should handle overlap", async () => {
      const chunker = new TokenChunker({
        chunkSize: 10,
        chunkOverlap: 2,
      });
      const text =
        "First part of the text. Second part of the text. Third part of the text.";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should maintain metadata consistency", async () => {
      const chunker = new TokenChunker({ chunkSize: 10 });
      const text =
        "Some longer text that will be split into multiple chunks for testing purposes.";
      const chunks = await chunker.chunk(text, {
        sourceId: "test-doc",
        sourcePath: "/test.txt",
        metadata: { custom: "value" },
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].metadata.chunkIndex).toBe(i);
        expect(chunks[i].metadata.totalChunks).toBe(chunks.length);
        expect(chunks[i].metadata.sourceId).toBe("test-doc");
        expect(chunks[i].metadata.sourcePath).toBe("/test.txt");
        expect(chunks[i].metadata.custom).toBe("value");
        expect(chunks[i].metadata.tokenCount).toBeDefined();
        expect(chunks[i].metadata.hash).toBeDefined();
      }
    });

    it("should link chunks correctly", async () => {
      const chunker = new TokenChunker({ chunkSize: 10 });
      const text =
        "First chunk content here. Second chunk content here. Third chunk content here.";
      const chunks = await chunker.chunk(text);

      if (chunks.length >= 2) {
        expect(chunks[0].metadata.previousChunkId).toBeNull();
        expect(chunks[0].metadata.nextChunkId).toBe(chunks[1].id);

        const last = chunks[chunks.length - 1];
        expect(last.metadata.nextChunkId).toBeNull();
        expect(last.metadata.previousChunkId).toBe(
          chunks[chunks.length - 2].id
        );
      }
    });

    it("should apply chunkProcessor", async () => {
      const chunker = new TokenChunker({
        chunkSize: 10,
        chunkProcessor: (chunk) => ({
          ...chunk,
          content: chunk.content.toUpperCase(),
          metadata: {
            ...chunk.metadata,
            processed: true,
          },
        }),
      });

      const text = "Some text that will be processed after chunking.";
      const chunks = await chunker.chunk(text);

      for (const chunk of chunks) {
        expect(chunk.content).toBe(chunk.content.toUpperCase());
        expect(chunk.metadata.processed).toBe(true);
      }
    });

    it("should filter chunks with processor returning null", async () => {
      const chunker = new TokenChunker({
        chunkSize: 10,
        chunkProcessor: (chunk) => {
          if (chunk.content.length < 10) return null;
          return chunk;
        },
      });

      const text =
        "This is some longer text. Short. Another longer piece of text here.";
      const chunks = await chunker.chunk(text);

      // All remaining chunks should be >= 10 chars
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe("estimateTokens", () => {
    it("should estimate token count for text", () => {
      const count = TokenChunker.estimateTokens("Hello, world!");
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });
  });
});
