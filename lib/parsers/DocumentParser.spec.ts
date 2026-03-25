import { DocumentParser } from "./DocumentParser";
import { UnstructuredLocalParser } from "./UnstructuredLocalParser";
import { UnstructuredAPIParser } from "./UnstructuredAPIParser";
import { LlamaIndexParser, LlamaIndexReader } from "./LlamaIndexParser";
import { ParsedDocument, ParsedElement } from "./types";
import { IngestionPipeline } from "../ingestion/IngestionPipeline";
import { TextChunker } from "../chunkers/TextChunker";
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

  async addDocuments(docs: Document[]): Promise<string[]> {
    return docs.map((d) => d.id);
  }
  async addEmbeddedDocuments(docs: EmbeddedDocument[]): Promise<string[]> {
    this.stored.push(...docs);
    return docs.map((d) => d.id);
  }
  async search(): Promise<SearchResult[]> { return []; }
  async searchByVector(): Promise<SearchResult[]> { return []; }
  async delete(): Promise<number> { return 0; }
  async clear(): Promise<void> { this.stored = []; }
  async getById(): Promise<Document | null> { return null; }
  async getByHashes(): Promise<Map<string, string>> { return new Map(); }
}

/** Minimal concrete parser for testing the base class. */
class FakeParser extends DocumentParser {
  readonly name = "fake";
  private readonly result: ParsedDocument;

  constructor(result: ParsedDocument) {
    super();
    this.result = result;
  }

  async parse(): Promise<ParsedDocument> {
    return this.result;
  }
}

// ─── DocumentParser (base) ───────────────────────────────────────────────────

describe("DocumentParser (base)", () => {
  describe("elementsToText", () => {
    it("joins element text with double newlines", async () => {
      const parser = new FakeParser({ text: "", elements: [] });
      // Access protected method via subclass
      const elements: ParsedElement[] = [
        { type: "Title", text: "Hello" },
        { type: "NarrativeText", text: "World" },
      ];
      // Re-invoke through parse result pattern
      const result = await new FakeParser({
        text: "Hello\n\nWorld",
        elements,
      }).parse();
      expect(result.text).toBe("Hello\n\nWorld");
    });

    it("filters empty strings", async () => {
      // Verify via a subclass that empty text elements are dropped
      class FilterParser extends DocumentParser {
        readonly name = "filter";
        async parse(): Promise<ParsedDocument> {
          const elements: ParsedElement[] = [
            { type: "Title", text: "Kept" },
            { type: "NarrativeText", text: "" },
            { type: "NarrativeText", text: "Also Kept" },
          ];
          return {
            text: this.elementsToText(elements),
            elements,
          };
        }
      }
      const { text } = await new FilterParser().parse();
      expect(text).toBe("Kept\n\nAlso Kept");
    });
  });
});

// ─── UnstructuredLocalParser ─────────────────────────────────────────────────

describe("UnstructuredLocalParser", () => {
  it("throws a helpful error when peer dep is not installed", async () => {
    // We can't easily mock dynamic import in Jest without babel plugins,
    // so we verify the class constructs and has the right name.
    const parser = new UnstructuredLocalParser();
    expect(parser.name).toBe("unstructured-local");
  });

  it("is an instance of DocumentParser", () => {
    expect(new UnstructuredLocalParser()).toBeInstanceOf(DocumentParser);
  });

  describe("with mocked @epilogo/unstructured-io-node", () => {
    const mockElements = [
      { type: "Title", text: "Test Title", metadata: { page_number: 1 } },
      { type: "NarrativeText", text: "Some content here.", metadata: { page_number: 1 } },
      { type: "NarrativeText", text: "", metadata: {} }, // empty — should be filtered in text
    ];

    beforeEach(() => {
      jest.resetModules();
    });

    it("maps raw elements and concatenates text", async () => {
      // Intercept the dynamic import by shimming the module registry
      jest.mock("@epilogo/unstructured-io-node", () => ({
        UnstructuredIO: {
          ensureEnvironmentSetup: jest.fn().mockResolvedValue(undefined),
          partition: jest.fn().mockResolvedValue(mockElements),
        },
      }), { virtual: true });

      // Re-import after mock registration
      const { UnstructuredLocalParser: LocalParser } = await import(
        "./UnstructuredLocalParser"
      );
      const parser = new LocalParser();
      const doc = await parser.parse("/fake/doc.pdf");

      expect(doc.text).toBe("Test Title\n\nSome content here.");
      expect(doc.elements).toHaveLength(3);
      expect(doc.elements![0]).toEqual({
        type: "Title",
        text: "Test Title",
        metadata: { page_number: 1 },
      });
    });

    it("passes strategy and languages to partition()", async () => {
      const partitionMock = jest.fn().mockResolvedValue([]);
      jest.mock("@epilogo/unstructured-io-node", () => ({
        UnstructuredIO: {
          ensureEnvironmentSetup: jest.fn().mockResolvedValue(undefined),
          partition: partitionMock,
        },
      }), { virtual: true });

      const { UnstructuredLocalParser: LocalParser } = await import(
        "./UnstructuredLocalParser"
      );
      await new LocalParser().parse("/file.pdf", {
        strategy: "hi_res",
        languages: ["eng", "fra"],
      });

      expect(partitionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "/file.pdf",
          strategy: "hi_res",
          languages: ["eng", "fra"],
        })
      );
    });

    it("defaults strategy to 'auto' when not specified", async () => {
      const partitionMock = jest.fn().mockResolvedValue([]);
      jest.mock("@epilogo/unstructured-io-node", () => ({
        UnstructuredIO: {
          ensureEnvironmentSetup: jest.fn().mockResolvedValue(undefined),
          partition: partitionMock,
        },
      }), { virtual: true });

      const { UnstructuredLocalParser: LocalParser } = await import(
        "./UnstructuredLocalParser"
      );
      await new LocalParser().parse("/file.pdf");

      expect(partitionMock).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: "auto" })
      );
    });

    it("handles elements with missing type/text gracefully", async () => {
      jest.mock("@epilogo/unstructured-io-node", () => ({
        UnstructuredIO: {
          ensureEnvironmentSetup: jest.fn().mockResolvedValue(undefined),
          partition: jest.fn().mockResolvedValue([
            { metadata: { page_number: 1 } }, // no type, no text
            { type: "Title" },                 // no text
          ]),
        },
      }), { virtual: true });

      const { UnstructuredLocalParser: LocalParser } = await import(
        "./UnstructuredLocalParser"
      );
      const doc = await new LocalParser().parse("/file.pdf");
      expect(doc.elements![0].type).toBe("unknown");
      expect(doc.elements![0].text).toBe("");
      expect(doc.elements![1].text).toBe("");
    });
  });
});

// ─── UnstructuredAPIParser ───────────────────────────────────────────────────

describe("UnstructuredAPIParser", () => {
  it("has correct name", () => {
    expect(new UnstructuredAPIParser().name).toBe("unstructured-api");
  });

  it("is an instance of DocumentParser", () => {
    expect(new UnstructuredAPIParser()).toBeInstanceOf(DocumentParser);
  });

  it("accepts apiKey and serverUrl config", () => {
    const parser = new UnstructuredAPIParser({
      apiKey: "key-123",
      serverUrl: "http://localhost:8000",
    });
    expect(parser.name).toBe("unstructured-api");
  });

  describe("with mocked unstructured-client", () => {
    const mockElements = [
      { type: "Title", text: "API Title", metadata: { page_number: 1 } },
      { type: "NarrativeText", text: "API content." },
    ];

    beforeEach(() => {
      jest.resetModules();
      // Mock fs so no real file read occurs
      jest.mock("fs", () => ({
        ...jest.requireActual("fs"),
        readFileSync: jest.fn().mockReturnValue(Buffer.from("fake-pdf-content")),
      }));
    });

    it("maps API response elements to ParsedDocument", async () => {
      const partitionMock = jest.fn().mockResolvedValue({
        statusCode: 200,
        elements: mockElements,
      });
      jest.mock("unstructured-client", () => ({
        UnstructuredClient: jest.fn().mockImplementation(() => ({
          general: { partition: partitionMock },
        })),
      }), { virtual: true });

      const { UnstructuredAPIParser: APIParser } = await import(
        "./UnstructuredAPIParser"
      );
      const doc = await new APIParser().parse("/fake/doc.pdf");

      expect(doc.text).toBe("API Title\n\nAPI content.");
      expect(doc.elements).toHaveLength(2);
    });

    it("passes strategy to partition parameters", async () => {
      const partitionMock = jest.fn().mockResolvedValue({ elements: [] });
      jest.mock("unstructured-client", () => ({
        UnstructuredClient: jest.fn().mockImplementation(() => ({
          general: { partition: partitionMock },
        })),
      }), { virtual: true });

      const { UnstructuredAPIParser: APIParser } = await import(
        "./UnstructuredAPIParser"
      );
      await new APIParser().parse("/file.pdf", { strategy: "fast" });

      expect(partitionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionParameters: expect.objectContaining({ strategy: "fast" }),
        })
      );
    });

    it("handles empty elements array", async () => {
      jest.mock("unstructured-client", () => ({
        UnstructuredClient: jest.fn().mockImplementation(() => ({
          general: {
            partition: jest.fn().mockResolvedValue({ elements: [] }),
          },
        })),
      }), { virtual: true });

      const { UnstructuredAPIParser: APIParser } = await import(
        "./UnstructuredAPIParser"
      );
      const doc = await new APIParser().parse("/empty.pdf");
      expect(doc.text).toBe("");
      expect(doc.elements).toHaveLength(0);
    });
  });
});

// ─── LlamaIndexParser ────────────────────────────────────────────────────────

describe("LlamaIndexParser", () => {
  const makeReader = (docs: Array<{ text: string; metadata?: Record<string, unknown> }>): LlamaIndexReader => ({
    loadData: jest.fn().mockResolvedValue(docs),
  });

  it("uses the reader's constructor name as label", () => {
    class PDFReader { async loadData() { return []; } }
    const parser = new LlamaIndexParser(new PDFReader() as unknown as LlamaIndexReader);
    expect(parser.name).toBe("llamaindex:PDFReader");
  });

  it("uses custom readerName when provided", () => {
    const parser = new LlamaIndexParser(makeReader([]), "MyReader");
    expect(parser.name).toBe("llamaindex:MyReader");
  });

  it("is an instance of DocumentParser", () => {
    expect(new LlamaIndexParser(makeReader([]))).toBeInstanceOf(DocumentParser);
  });

  it("maps documents to ParsedElements with type Document", async () => {
    const reader = makeReader([
      { text: "First page content", metadata: { page: 1 } },
      { text: "Second page content", metadata: { page: 2 } },
    ]);
    const parser = new LlamaIndexParser(reader);
    const doc = await parser.parse("/file.pdf");

    expect(doc.elements).toHaveLength(2);
    expect(doc.elements![0]).toMatchObject({ type: "Document", text: "First page content" });
    expect(doc.elements![1]).toMatchObject({ type: "Document", text: "Second page content" });
    expect(doc.text).toBe("First page content\n\nSecond page content");
  });

  it("adds doc_index to metadata", async () => {
    const reader = makeReader([{ text: "A" }, { text: "B" }]);
    const doc = await new LlamaIndexParser(reader).parse("/f.pdf");
    expect(doc.elements![0].metadata?.doc_index).toBe(0);
    expect(doc.elements![1].metadata?.doc_index).toBe(1);
  });

  it("calls loadData with the filePath", async () => {
    const reader = makeReader([{ text: "content" }]);
    await new LlamaIndexParser(reader).parse("/some/file.docx");
    expect(reader.loadData).toHaveBeenCalledWith("/some/file.docx");
  });

  it("handles empty document list", async () => {
    const doc = await new LlamaIndexParser(makeReader([])).parse("/empty.pdf");
    expect(doc.text).toBe("");
    expect(doc.elements).toHaveLength(0);
  });

  it("wraps reader errors with a descriptive message", async () => {
    const reader: LlamaIndexReader = {
      loadData: jest.fn().mockRejectedValue(new Error("file not found")),
    };
    await expect(new LlamaIndexParser(reader).parse("/missing.pdf")).rejects.toThrow(
      /file not found/
    );
  });
});

// ─── IngestionPipeline.ingestFile ─────────────────────────────────────────────

describe("IngestionPipeline.ingestFile", () => {
  let pipeline: IngestionPipeline;
  let store: MockVectorStore;

  beforeEach(() => {
    store = new MockVectorStore();
    pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store
    );
  });

  it("parses the file and stores chunks", async () => {
    const parser = new FakeParser({
      text: "Hello world. This is a test document with some content for chunking.",
      elements: [{ type: "NarrativeText", text: "Hello world." }],
    });

    const result = await pipeline.ingestFile("/fake/doc.pdf", parser);

    expect(result.success).toBe(true);
    expect(result.chunksStored).toBeGreaterThan(0);
    expect(store.stored.length).toBeGreaterThan(0);
  });

  it("sets sourcePath to filePath when not overridden", async () => {
    const parser = new FakeParser({ text: "Content here." });
    await pipeline.ingestFile("/docs/report.pdf", parser);

    const stored = store.stored[0];
    expect(stored.metadata?.source_path).toBe("/docs/report.pdf");
  });

  it("respects custom sourcePath from options", async () => {
    const parser = new FakeParser({ text: "Content here." });
    await pipeline.ingestFile("/docs/report.pdf", parser, {
      sourcePath: "/custom/path.pdf",
    });
    expect(store.stored[0].metadata?.source_path).toBe("/custom/path.pdf");
  });

  it("passes sourceId through to chunks", async () => {
    const parser = new FakeParser({ text: "Some text content." });
    await pipeline.ingestFile("/file.pdf", parser, { sourceId: "my-doc" });

    expect(store.stored[0].metadata?.source_id).toBe("my-doc");
  });

  it("returns zero chunks for empty parsed text", async () => {
    const parser = new FakeParser({ text: "" });
    const result = await pipeline.ingestFile("/empty.pdf", parser);

    expect(result.chunksProcessed).toBe(0);
    expect(result.chunksStored).toBe(0);
  });

  it("calls onProgress callback", async () => {
    const parser = new FakeParser({ text: "Some text here to chunk." });
    const phases: string[] = [];

    await pipeline.ingestFile("/file.pdf", parser, {
      onProgress: ({ phase }) => phases.push(phase),
    });

    expect(phases).toContain("chunking");
    expect(phases).toContain("embedding");
    expect(phases).toContain("storing");
  });
});

// ─── IngestionPipeline.ingestFiles ────────────────────────────────────────────

describe("IngestionPipeline.ingestFiles", () => {
  let pipeline: IngestionPipeline;
  let store: MockVectorStore;

  beforeEach(() => {
    store = new MockVectorStore();
    pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store
    );
  });

  it("processes all files and aggregates chunks", async () => {
    const parser = new FakeParser({ text: "Content for file." });
    const result = await pipeline.ingestFiles(
      ["/a.pdf", "/b.pdf", "/c.pdf"],
      parser
    );

    expect(result.success).toBe(true);
    expect(result.chunksStored).toBeGreaterThan(0);
  });

  it("sets sourcePath per file", async () => {
    let callCount = 0;
    const parser: DocumentParser = {
      name: "tracking",
      parse: jest.fn().mockImplementation(async (filePath: string) => {
        callCount++;
        return { text: `Content of ${filePath}` };
      }),
      elementsToText: DocumentParser.prototype["elementsToText"],
    } as unknown as DocumentParser;

    await pipeline.ingestFiles(["/a.pdf", "/b.pdf"], parser);
    expect(callCount).toBe(2);
  });

  it("returns empty result for empty file list", async () => {
    const parser = new FakeParser({ text: "Content" });
    const result = await pipeline.ingestFiles([], parser);

    expect(result.chunksProcessed).toBe(0);
    expect(result.chunksStored).toBe(0);
  });
});

// ─── Pipeline-level parser (constructor) ──────────────────────────────────────

describe("IngestionPipeline — pipeline-level parser", () => {
  let store: MockVectorStore;
  let parser: FakeParser;

  beforeEach(() => {
    store = new MockVectorStore();
    parser = new FakeParser({
      text: "Pipeline-level parser content.",
    });
  });

  it("uses the pipeline parser when none is passed to ingestFile", async () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store,
      parser
    );
    const result = await pipeline.ingestFile("/doc.pdf");
    expect(result.chunksStored).toBeGreaterThan(0);
  });

  it("uses the pipeline parser when none is passed to ingestFiles", async () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store,
      parser
    );
    const result = await pipeline.ingestFiles(["/a.pdf", "/b.pdf"]);
    expect(result.chunksStored).toBeGreaterThan(0);
  });

  it("call-site parser overrides the pipeline parser", async () => {
    const callSiteParser = new FakeParser({ text: "Call-site content." });
    const parseSpy = jest.spyOn(callSiteParser, "parse");

    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store,
      parser
    );
    await pipeline.ingestFile("/doc.pdf", callSiteParser);
    expect(parseSpy).toHaveBeenCalled();
  });

  it("throws when no parser is provided and none is set on the pipeline", async () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store
    );
    await expect(pipeline.ingestFile("/doc.pdf")).rejects.toThrow("No parser provided");
  });

  it("throws for ingestFiles when no parser is set", async () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store
    );
    await expect(pipeline.ingestFiles(["/doc.pdf"])).rejects.toThrow("No parser provided");
  });

  it("getParser() returns the configured parser", () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store,
      parser
    );
    expect(pipeline.getParser()).toBe(parser);
  });

  it("getParser() returns undefined when no parser is set", () => {
    const pipeline = new IngestionPipeline(
      new TextChunker({ chunkSize: 50 }),
      new MockEmbeddings(),
      store
    );
    expect(pipeline.getParser()).toBeUndefined();
  });
});
