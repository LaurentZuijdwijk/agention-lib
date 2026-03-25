import { ElementChunker } from "./ElementChunker";
import { Chunker } from "./Chunker";
import { ParsedElement } from "../parsers/types";
import { IngestionPipeline } from "../ingestion/IngestionPipeline";
import { TextChunker } from "./TextChunker";
import { Embeddings } from "../embeddings/Embeddings";
import {
  VectorStore,
  Document,
  EmbeddedDocument,
  SearchResult,
} from "../vectorstore/VectorStore";

// ─── test doubles ────────────────────────────────────────────────────────────

class MockEmbeddings extends Embeddings {
  readonly name = "mock";
  readonly model = "mock-model";
  readonly dimensions = 3;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class MockVectorStore extends VectorStore {
  readonly name = "mock-store";
  stored: EmbeddedDocument[] = [];
  async addDocuments(docs: Document[]): Promise<string[]> { return docs.map(d => d.id); }
  async addEmbeddedDocuments(docs: EmbeddedDocument[]): Promise<string[]> {
    this.stored.push(...docs);
    return docs.map(d => d.id);
  }
  async search(): Promise<SearchResult[]> { return []; }
  async searchByVector(): Promise<SearchResult[]> { return []; }
  async delete(): Promise<number> { return 0; }
  async clear(): Promise<void> { this.stored = []; }
  async getById(): Promise<Document | null> { return null; }
  async getByHashes(): Promise<Map<string, string>> { return new Map(); }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function el(type: string, text: string, page?: number): ParsedElement {
  return { type, text, metadata: page != null ? { page_number: page } : {} };
}

// ─── constructor ─────────────────────────────────────────────────────────────

describe("ElementChunker — constructor", () => {
  it("extends Chunker", () => {
    expect(new ElementChunker({ chunkSize: 100 })).toBeInstanceOf(Chunker);
  });

  it("has correct name", () => {
    expect(new ElementChunker({ chunkSize: 100 }).name).toBe("ElementChunker");
  });

  it("throws when chunkSize <= 0", () => {
    expect(() => new ElementChunker({ chunkSize: 0 })).toThrow();
  });
});

// ─── chunkElements — basic grouping ──────────────────────────────────────────

describe("ElementChunker.chunkElements — basic grouping", () => {
  it("returns empty array for empty element list", async () => {
    const chunker = new ElementChunker({ chunkSize: 100 });
    expect(await chunker.chunkElements([])).toEqual([]);
  });

  it("returns empty array when all elements have empty text", async () => {
    const chunker = new ElementChunker({ chunkSize: 100 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", ""),
      el("NarrativeText", "   "),
    ]);
    expect(chunks).toHaveLength(0);
  });

  it("groups small elements into a single chunk", async () => {
    const chunker = new ElementChunker({ chunkSize: 200 });
    const elements = [
      el("NarrativeText", "First sentence."),
      el("NarrativeText", "Second sentence."),
      el("NarrativeText", "Third sentence."),
    ];
    const chunks = await chunker.chunkElements(elements);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("First sentence.\n\nSecond sentence.\n\nThird sentence.");
  });

  it("splits into multiple chunks when elements exceed chunkSize", async () => {
    const chunker = new ElementChunker({ chunkSize: 20 });
    const elements = [
      el("NarrativeText", "First block."),   // 12 chars
      el("NarrativeText", "Second block."),  // 13 chars — won't fit with first
      el("NarrativeText", "Third block."),   // 12 chars
    ];
    const chunks = await chunker.chunkElements(elements);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("joins grouped elements with double newline", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([
      el("Title", "Heading"),
      el("NarrativeText", "Body text here."),
    ]);
    // Title is in breakOnTypes by default so it starts fresh — but no prior group
    expect(chunks[0].content).toContain("Heading");
    expect(chunks[0].content).toContain("Body text here.");
  });
});

// ─── breakOnTypes ─────────────────────────────────────────────────────────────

describe("ElementChunker.chunkElements — breakOnTypes", () => {
  it("flushes current group when a Title element is encountered (default)", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "Intro paragraph with enough text."),
      el("Title", "Section Two"),
      el("NarrativeText", "Section two content."),
    ]);
    // Should produce at least 2 chunks: intro | title+content
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk must NOT contain "Section Two"
    expect(chunks[0].content).not.toContain("Section Two");
  });

  it("custom breakOnTypes splits on the specified type", async () => {
    const chunker = new ElementChunker({
      chunkSize: 500,
      breakOnTypes: ["Header"],
    });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "Before header."),
      el("Header", "Chapter 1"),
      el("NarrativeText", "After header."),
    ]);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].content).not.toContain("Chapter 1");
  });

  it("does not break when breakOnTypes is empty", async () => {
    const chunker = new ElementChunker({ chunkSize: 500, breakOnTypes: [] });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "A."),
      el("Title", "B."),
      el("NarrativeText", "C."),
    ]);
    expect(chunks).toHaveLength(1);
  });
});

// ─── excludeTypes ─────────────────────────────────────────────────────────────

describe("ElementChunker.chunkElements — excludeTypes", () => {
  it("skips excluded element types", async () => {
    const chunker = new ElementChunker({
      chunkSize: 500,
      excludeTypes: ["Image", "PageBreak"],
    });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "Real content."),
      el("Image", "alt text"),
      el("PageBreak", ""),
      el("NarrativeText", "More content."),
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).not.toContain("alt text");
  });
});

// ─── large element splitting ──────────────────────────────────────────────────

describe("ElementChunker.chunkElements — large element splitting", () => {
  it("splits a single oversized element into multiple chunks", async () => {
    const chunker = new ElementChunker({ chunkSize: 30 });
    const longText = "Alpha beta gamma delta. Epsilon zeta eta theta. Iota kappa lambda mu.";
    const chunks = await chunker.chunkElements([el("NarrativeText", longText)]);
    expect(chunks.length).toBeGreaterThan(1);
    // All text should be present across chunks
    const combined = chunks.map(c => c.content).join(" ");
    expect(combined).toContain("Alpha");
    expect(combined).toContain("kappa");
  });

  it("force-splits when no separator works", async () => {
    const chunker = new ElementChunker({ chunkSize: 5 });
    const noSpaces = "abcdefghijklmnopqrstuvwxyz";
    const chunks = await chunker.chunkElements([el("NarrativeText", noSpaces)]);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(c.content.length).toBeLessThanOrEqual(5));
  });
});

// ─── metadata ────────────────────────────────────────────────────────────────

describe("ElementChunker.chunkElements — metadata", () => {
  it("stores element_types in chunk metadata", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([
      el("Title", "Heading"),
      el("NarrativeText", "Body."),
    ]);
    const types = chunks.flatMap(c => c.metadata["element_types"] as string[]);
    expect(types).toContain("Title");
    expect(types).toContain("NarrativeText");
  });

  it("deduplicates element_types within a chunk", async () => {
    const chunker = new ElementChunker({ chunkSize: 500, breakOnTypes: [] });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "A."),
      el("NarrativeText", "B."),
    ]);
    const types = chunks[0].metadata["element_types"] as string[];
    expect(types.filter(t => t === "NarrativeText")).toHaveLength(1);
  });

  it("stores page number from first element with page_number metadata", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "Page content.", 3),
    ]);
    expect(chunks[0].metadata.page).toBe(3);
  });

  it("sets source_id and source_path from options", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([el("NarrativeText", "Text.")], {
      sourceId: "doc-abc",
      sourcePath: "/docs/report.pdf",
    });
    expect(chunks[0].metadata.source_id).toBe("doc-abc");
    expect(chunks[0].metadata.source_path).toBe("/docs/report.pdf");
  });

  it("sets correct index and total", async () => {
    const chunker = new ElementChunker({ chunkSize: 10 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "First chunk text."),
      el("NarrativeText", "Second chunk text."),
    ]);
    chunks.forEach((c, i) => {
      expect(c.metadata.index).toBe(i);
      expect(c.metadata.total).toBe(chunks.length);
    });
  });

  it("links chunks with prev_id and next_id", async () => {
    const chunker = new ElementChunker({ chunkSize: 10 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "First chunk text here."),
      el("NarrativeText", "Second chunk text here."),
    ]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.prev_id).toBeNull();
    expect(chunks[0].metadata.next_id).toBe(chunks[1].id);
    expect(chunks[1].metadata.prev_id).toBe(chunks[0].id);
    expect(chunks[chunks.length - 1].metadata.next_id).toBeNull();
  });

  it("each chunk has a unique id", async () => {
    const chunker = new ElementChunker({ chunkSize: 10 });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "First block of content."),
      el("NarrativeText", "Second block of content."),
      el("NarrativeText", "Third block of content."),
    ]);
    const ids = chunks.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("computes a hash for each chunk", async () => {
    const chunker = new ElementChunker({ chunkSize: 500 });
    const chunks = await chunker.chunkElements([el("NarrativeText", "Content.")]);
    expect(typeof chunks[0].metadata.hash).toBe("string");
    expect(chunks[0].metadata.hash.length).toBe(64); // SHA-256 hex
  });
});

// ─── text fallback (chunk()) ──────────────────────────────────────────────────

describe("ElementChunker — text fallback via chunk()", () => {
  it("chunks plain text when called via chunk()", async () => {
    const chunker = new ElementChunker({ chunkSize: 50 });
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
    const chunks = await chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(0);
  });
});

// ─── chunkProcessor ──────────────────────────────────────────────────────────

describe("ElementChunker — chunkProcessor", () => {
  it("applies chunkProcessor to filter chunks", async () => {
    const chunker = new ElementChunker({
      chunkSize: 500,
      chunkProcessor: (chunk) => (chunk.content.includes("keep") ? chunk : null),
    });
    const chunks = await chunker.chunkElements([
      el("NarrativeText", "Please keep this."),
      el("Title", "Remove this title"),
      el("NarrativeText", "And keep this too."),
    ]);
    expect(chunks.every(c => c.content.includes("keep"))).toBe(true);
  });
});

// ─── IngestionPipeline integration ───────────────────────────────────────────

describe("IngestionPipeline with ElementChunker", () => {
  let store: MockVectorStore;

  beforeEach(() => {
    store = new MockVectorStore();
  });

  it("uses chunkElements path when parser returns elements", async () => {
    const elementChunker = new ElementChunker({ chunkSize: 200 });
    const chunkElementsSpy = jest.spyOn(elementChunker, "chunkElements");

    const pipeline = new IngestionPipeline(elementChunker, new MockEmbeddings(), store);

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({
        text: "Title\n\nBody text.",
        elements: [
          { type: "Title", text: "Title" },
          { type: "NarrativeText", text: "Body text." },
        ],
      }),
    } as unknown as InstanceType<typeof DocumentParser>;

    await pipeline.ingestFile("/doc.pdf", parser);
    expect(chunkElementsSpy).toHaveBeenCalled();
  });

  it("falls back to text chunking when parser has no elements", async () => {
    const elementChunker = new ElementChunker({ chunkSize: 200 });
    const chunkElementsSpy = jest.spyOn(elementChunker, "chunkElements");

    const pipeline = new IngestionPipeline(elementChunker, new MockEmbeddings(), store);

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({ text: "Plain text only." }),
    } as unknown as InstanceType<typeof DocumentParser>;

    const result = await pipeline.ingestFile("/doc.pdf", parser);
    expect(chunkElementsSpy).not.toHaveBeenCalled();
    expect(result.chunksStored).toBeGreaterThan(0);
  });

  it("uses chunkElements path in ingestFiles when parser returns elements", async () => {
    const elementChunker = new ElementChunker({ chunkSize: 200 });
    const chunkElementsSpy = jest.spyOn(elementChunker, "chunkElements");

    const pipeline = new IngestionPipeline(elementChunker, new MockEmbeddings(), store);

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({
        text: "Title\n\nBody text.",
        elements: [
          { type: "Title", text: "Title" },
          { type: "NarrativeText", text: "Body text." },
        ],
      }),
    } as unknown as InstanceType<typeof DocumentParser>;

    await pipeline.ingestFiles(["/a.pdf", "/b.pdf"], parser);
    expect(chunkElementsSpy).toHaveBeenCalledTimes(2);
  });

  it("element types appear in stored chunk metadata for ingestFiles", async () => {
    const pipeline = new IngestionPipeline(
      new ElementChunker({ chunkSize: 500 }),
      new MockEmbeddings(),
      store
    );

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({
        text: "Title\n\nBody.",
        elements: [
          { type: "Title", text: "Title" },
          { type: "NarrativeText", text: "Body." },
        ],
      }),
    } as unknown as InstanceType<typeof DocumentParser>;

    await pipeline.ingestFiles(["/a.pdf", "/b.pdf"], parser);
    const types = store.stored.flatMap(d => d.metadata?.["element_types"] as string[] ?? []);
    expect(types).toContain("Title");
    expect(types).toContain("NarrativeText");
  });

  it("uses standard text chunker (not ElementChunker) even with elements", async () => {
    const textChunker = new TextChunker({ chunkSize: 200 });
    const pipeline = new IngestionPipeline(textChunker, new MockEmbeddings(), store);

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({
        text: "Some text.",
        elements: [{ type: "NarrativeText", text: "Some text." }],
      }),
    } as unknown as InstanceType<typeof DocumentParser>;

    const result = await pipeline.ingestFile("/doc.pdf", parser);
    expect(result.chunksStored).toBeGreaterThan(0);
  });

  it("element types appear in stored chunk metadata", async () => {
    const pipeline = new IngestionPipeline(
      new ElementChunker({ chunkSize: 500 }),
      new MockEmbeddings(),
      store
    );

    const { DocumentParser } = await import("../parsers/DocumentParser");
    const parser = {
      name: "mock-parser",
      parse: jest.fn().mockResolvedValue({
        text: "Title\n\nBody.",
        elements: [
          { type: "Title", text: "Title" },
          { type: "NarrativeText", text: "Body." },
        ],
      }),
    } as unknown as InstanceType<typeof DocumentParser>;

    await pipeline.ingestFile("/doc.pdf", parser);
    const types = store.stored.flatMap(d => d.metadata?.["element_types"] as string[] ?? []);
    expect(types).toContain("Title");
    expect(types).toContain("NarrativeText");
  });
});
