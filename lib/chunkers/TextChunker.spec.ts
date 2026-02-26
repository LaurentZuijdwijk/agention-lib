import { TextChunker } from "./TextChunker";

describe("TextChunker", () => {
  describe("constructor", () => {
    it("should create a chunker with valid config", () => {
      const chunker = new TextChunker({ chunkSize: 100 });
      expect(chunker.name).toBe("TextChunker");
      expect(chunker.getChunkSize()).toBe(100);
      expect(chunker.getChunkOverlap()).toBe(0);
    });

    it("should accept overlap configuration", () => {
      const chunker = new TextChunker({ chunkSize: 100, chunkOverlap: 20 });
      expect(chunker.getChunkOverlap()).toBe(20);
    });

    it("should throw if chunkSize is 0", () => {
      expect(() => new TextChunker({ chunkSize: 0 })).toThrow(
        "chunkSize must be greater than 0"
      );
    });

    it("should throw if chunkSize is negative", () => {
      expect(() => new TextChunker({ chunkSize: -10 })).toThrow(
        "chunkSize must be greater than 0"
      );
    });

    it("should throw if chunkOverlap is negative", () => {
      expect(
        () => new TextChunker({ chunkSize: 100, chunkOverlap: -1 })
      ).toThrow("chunkOverlap must be non-negative");
    });

    it("should throw if chunkOverlap >= chunkSize", () => {
      expect(
        () => new TextChunker({ chunkSize: 100, chunkOverlap: 100 })
      ).toThrow("chunkOverlap must be less than chunkSize");
    });
  });

  describe("chunk", () => {
    it("should return empty array for empty text", async () => {
      const chunker = new TextChunker({ chunkSize: 100 });
      const chunks = await chunker.chunk("");
      expect(chunks).toEqual([]);
    });

    it("should return single chunk for text smaller than chunkSize", async () => {
      const chunker = new TextChunker({ chunkSize: 100 });
      const text = "Hello, world!";
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].metadata.index).toBe(0);
      expect(chunks[0].metadata.total).toBe(1);
    });

    it("should split text into multiple chunks", async () => {
      const chunker = new TextChunker({ chunkSize: 10 });
      const text = "abcdefghij1234567890ABCDEFGHIJ";
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].content).toBe("abcdefghij");
      expect(chunks[1].content).toBe("1234567890");
      expect(chunks[2].content).toBe("ABCDEFGHIJ");
    });

    it("should handle overlap correctly", async () => {
      const chunker = new TextChunker({ chunkSize: 10, chunkOverlap: 3 });
      const text = "abcdefghij1234567890";
      const chunks = await chunker.chunk(text);

      // With size=10 and overlap=3, step=7
      // Chunk 0: 0-10 "abcdefghij"
      // Chunk 1: 7-17 "hij1234567"
      // Chunk 2: 14-20 "567890"
      expect(chunks).toHaveLength(3);
      expect(chunks[0].content).toBe("abcdefghij");
      expect(chunks[1].content).toBe("hij1234567");
      expect(chunks[2].content).toBe("567890");

      // Verify overlap
      expect(chunks[0].content.slice(-3)).toBe(chunks[1].content.slice(0, 3));
    });

    it("should set metadata correctly", async () => {
      const chunker = new TextChunker({ chunkSize: 10 });
      const text = "abcdefghij1234567890";
      const chunks = await chunker.chunk(text, {
        sourceId: "test-doc",
        sourcePath: "/test/doc.txt",
        metadata: { custom: "value" },
      });

      expect(chunks).toHaveLength(2);

      // First chunk
      expect(chunks[0].metadata.index).toBe(0);
      expect(chunks[0].metadata.total).toBe(2);
      expect(chunks[0].metadata.prev_id).toBeNull();
      expect(chunks[0].metadata.next_id).toBe(chunks[1].id);
      expect(chunks[0].metadata.source_id).toBe("test-doc");
      expect(chunks[0].metadata.source_path).toBe("/test/doc.txt");
      expect(chunks[0].metadata.custom).toBe("value");
      expect(chunks[0].metadata.char_count).toBe(10);
      expect(chunks[0].metadata.hash).toBeDefined();

      // Second chunk
      expect(chunks[1].metadata.index).toBe(1);
      expect(chunks[1].metadata.prev_id).toBe(chunks[0].id);
      expect(chunks[1].metadata.next_id).toBeNull();
    });

    it("should generate unique IDs", async () => {
      const chunker = new TextChunker({ chunkSize: 10 });
      const text = "abcdefghij1234567890";
      const chunks = await chunker.chunk(text);

      const ids = chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should compute hash for deduplication", async () => {
      const chunker = new TextChunker({ chunkSize: 100 });

      const chunks1 = await chunker.chunk("Hello, world!");
      const chunks2 = await chunker.chunk("Hello, world!");

      expect(chunks1[0].metadata.hash).toBe(chunks2[0].metadata.hash);
    });

    it("should detect markdown section titles", async () => {
      const chunker = new TextChunker({ chunkSize: 100 });
      const text = "# Introduction\n\nThis is the introduction section.";
      const chunks = await chunker.chunk(text);

      expect(chunks[0].metadata.section).toBe("Introduction");
    });

    it("should apply custom chunkProcessor", async () => {
      const chunker = new TextChunker({
        chunkSize: 10,
        chunkProcessor: (chunk) => ({
          ...chunk,
          content: chunk.content.toUpperCase(),
        }),
      });

      const text = "abcdefghij1234567890";
      const chunks = await chunker.chunk(text);

      expect(chunks[0].content).toBe("ABCDEFGHIJ");
      expect(chunks[1].content).toBe("1234567890");
    });

    it("should filter chunks when processor returns null", async () => {
      const chunker = new TextChunker({
        chunkSize: 10,
        chunkProcessor: (chunk) => {
          // Filter out chunks starting with numbers
          if (/^\d/.test(chunk.content)) return null;
          return chunk;
        },
      });

      const text = "abcdefghij1234567890ABCDEFGHIJ";
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe("abcdefghij");
      expect(chunks[1].content).toBe("ABCDEFGHIJ");

      // Verify re-linking after filter
      expect(chunks[0].metadata.index).toBe(0);
      expect(chunks[0].metadata.total).toBe(2);
      expect(chunks[0].metadata.next_id).toBe(chunks[1].id);
      expect(chunks[1].metadata.prev_id).toBe(chunks[0].id);
    });

    it("should use custom idGenerator", async () => {
      const chunker = new TextChunker({
        chunkSize: 10,
        idGenerator: (_content, index, sourceId) =>
          `${sourceId ?? "doc"}-${index}`,
      });

      const chunks = await chunker.chunk("abcdefghij1234567890", {
        sourceId: "my-doc",
      });

      expect(chunks[0].id).toBe("my-doc-0");
      expect(chunks[1].id).toBe("my-doc-1");
    });

    it("should handle text exactly equal to chunkSize", async () => {
      const chunker = new TextChunker({ chunkSize: 10 });
      const text = "abcdefghij";
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it("should handle async chunkProcessor", async () => {
      const chunker = new TextChunker({
        chunkSize: 10,
        chunkProcessor: async (chunk) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { ...chunk, content: chunk.content + "!" };
        },
      });

      const chunks = await chunker.chunk("abcdefghij");
      expect(chunks[0].content).toBe("abcdefghij!");
    });
  });
});
