import { RecursiveChunker } from "./RecursiveChunker";

describe("RecursiveChunker", () => {
  describe("constructor", () => {
    it("should create with default separators", () => {
      const chunker = new RecursiveChunker({ chunkSize: 100 });
      expect(chunker.name).toBe("RecursiveChunker");
      expect(chunker.getSeparators()).toEqual(["\n\n", "\n", ". ", " "]);
    });

    it("should accept custom separators", () => {
      const chunker = new RecursiveChunker({
        chunkSize: 100,
        separators: ["---", "\n"],
      });
      expect(chunker.getSeparators()).toEqual(["---", "\n"]);
    });
  });

  describe("chunk", () => {
    it("should return empty array for empty text", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 100 });
      expect(await chunker.chunk("")).toEqual([]);
    });

    it("should return single chunk for small text", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 100 });
      const chunks = await chunker.chunk("Hello, world!");
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("Hello, world!");
    });

    it("should split on paragraph boundaries first", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 30 });
      const text =
        "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph.";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      // Each chunk should be smaller than the original text
      expect(chunks[0].content.length).toBeLessThan(text.length);
    });

    it("should fall back to line boundaries when paragraphs too large", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 30 });
      const text = "Line one\nLine two\nLine three\nLine four";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should fall back to sentence boundaries", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 40 });
      const text =
        "First sentence here. Second sentence here. Third sentence here.";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should force split very long words", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 10 });
      const text = "abcdefghijklmnopqrstuvwxyz";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should be at most chunkSize
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(10);
      }
    });

    it("should handle overlap with semantic splits", async () => {
      const chunker = new RecursiveChunker({
        chunkSize: 50,
        chunkOverlap: 10,
      });
      const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should keep metadata consistent", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 30 });
      const text = "Line one\nLine two\nLine three";
      const chunks = await chunker.chunk(text, {
        sourceId: "test",
        metadata: { author: "test" },
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].metadata.chunkIndex).toBe(i);
        expect(chunks[i].metadata.totalChunks).toBe(chunks.length);
        expect(chunks[i].metadata.sourceId).toBe("test");
        expect(chunks[i].metadata.author).toBe("test");
        expect(chunks[i].metadata.hash).toBeDefined();
      }
    });

    it("should link chunks correctly", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 20 });
      const text = "First part\nSecond part\nThird part";
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);

      // First chunk has no previous
      expect(chunks[0].metadata.previousChunkId).toBeNull();
      expect(chunks[0].metadata.nextChunkId).toBe(chunks[1].id);

      // Last chunk has no next
      const last = chunks[chunks.length - 1];
      expect(last.metadata.nextChunkId).toBeNull();

      // Middle chunks are linked both ways
      if (chunks.length > 2) {
        expect(chunks[1].metadata.previousChunkId).toBe(chunks[0].id);
        expect(chunks[1].metadata.nextChunkId).toBe(chunks[2].id);
      }
    });

    it("should detect section titles in markdown", async () => {
      const chunker = new RecursiveChunker({ chunkSize: 100 });
      const text =
        "# Introduction\n\nThis is the intro.\n\n## Methods\n\nThis is the methods section.";
      const chunks = await chunker.chunk(text);

      // At least one chunk should have a detected section title
      const titledChunks = chunks.filter((c) => c.metadata.sectionTitle);
      expect(titledChunks.length).toBeGreaterThan(0);
    });

    it("should handle real-world markdown document", async () => {
      const chunker = new RecursiveChunker({
        chunkSize: 200,
        chunkOverlap: 20,
      });

      const markdown = `# Project Documentation

## Overview

This is a sample project that demonstrates text chunking capabilities.
The system can handle various document formats and split them intelligently.

## Features

- Recursive splitting
- Semantic boundary detection
- Configurable overlap
- Metadata preservation

## Usage

To use this chunker, simply create an instance and call the chunk method:

\`\`\`typescript
const chunker = new RecursiveChunker({ chunkSize: 500 });
const chunks = await chunker.chunk(text);
\`\`\`

## Conclusion

This chunker provides a flexible way to split documents for vector storage.`;

      const chunks = await chunker.chunk(markdown, {
        sourceId: "readme",
        sourcePath: "/docs/README.md",
      });

      expect(chunks.length).toBeGreaterThan(1);

      // All chunks should have valid metadata
      for (const chunk of chunks) {
        expect(chunk.id).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.metadata.sourceId).toBe("readme");
        expect(chunk.metadata.hash).toHaveLength(64); // SHA-256 hex
      }
    });

    it("should apply chunkProcessor", async () => {
      const chunker = new RecursiveChunker({
        chunkSize: 30,
        chunkProcessor: (chunk) => ({
          ...chunk,
          content: chunk.content.toUpperCase(),
        }),
      });

      const text = "Line one\nLine two\nLine three";
      const chunks = await chunker.chunk(text);

      for (const chunk of chunks) {
        expect(chunk.content).toBe(chunk.content.toUpperCase());
      }
    });

    it("should filter with chunkProcessor returning null", async () => {
      const chunker = new RecursiveChunker({
        chunkSize: 30,
        chunkProcessor: (chunk) => {
          if (chunk.content.includes("two")) return null;
          return chunk;
        },
      });

      const text = "Line one\nLine two\nLine three";
      const chunks = await chunker.chunk(text);

      const contents = chunks.map((c) => c.content);
      expect(contents.some((c) => c.includes("two"))).toBe(false);

      // Verify indices are updated after filtering
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].metadata.chunkIndex).toBe(i);
        expect(chunks[i].metadata.totalChunks).toBe(chunks.length);
      }
    });
  });
});
