import { DocumentParser } from "./DocumentParser";
import { ParsedDocument, ParsedElement, ParseOptions } from "./types";

/**
 * A LlamaIndex reader instance.
 * Matches the `BaseReader` interface from `llamaindex` and `@llamaindex/readers`.
 */
export interface LlamaIndexReader {
  loadData(
    filePath: string,
    ...args: unknown[]
  ): Promise<Array<{ text: string; metadata?: Record<string, unknown> }>>;
}

/**
 * Document parser that delegates to any **LlamaIndex reader**.
 *
 * Pass any reader from `llamaindex` or `@llamaindex/readers` — e.g.
 * `PDFReader`, `DocxReader`, `HTMLReader`, `LlamaParseReader`, etc. — and
 * this class normalises the output into a {@link ParsedDocument}.
 *
 * **Peer dependency:** `llamaindex` and/or `@llamaindex/readers`
 *
 * @example
 * ```typescript
 * import { PDFReader } from "@llamaindex/readers/pdf";
 * import { LlamaIndexParser } from "@agentionai/agents/parsers";
 *
 * const parser = new LlamaIndexParser(new PDFReader());
 * const doc = await parser.parse("/path/to/report.pdf");
 * await pipeline.ingestFile("/path/to/report.pdf", parser);
 * ```
 *
 * @example Using LlamaParse (cloud OCR / layout AI)
 * ```typescript
 * import { LlamaParseReader } from "llamaindex";
 *
 * const parser = new LlamaIndexParser(
 *   new LlamaParseReader({ resultType: "markdown" })
 * );
 * ```
 */
export class LlamaIndexParser extends DocumentParser {
  readonly name: string;

  /**
   * @param reader      - Any LlamaIndex reader instance
   * @param readerName  - Optional label used in {@link name}; defaults to the
   *                      reader's constructor name
   */
  constructor(
    private readonly reader: LlamaIndexReader,
    readerName?: string
  ) {
    super();
    this.name = `llamaindex:${readerName ?? reader.constructor?.name ?? "reader"}`;
  }

  /**
   * Parse a file using the configured LlamaIndex reader.
   *
   * @param filePath - Path to the document file
   * @param options  - Currently unused; kept for interface compatibility
   */
  async parse(filePath: string, _options?: ParseOptions): Promise<ParsedDocument> {
    let docs: Array<{ text: string; metadata?: Record<string, unknown> }>;

    try {
      docs = await this.reader.loadData(filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`LlamaIndexParser (${this.name}) failed to load "${filePath}": ${msg}`);
    }

    const elements: ParsedElement[] = docs.map((doc, i) => ({
      type: "Document",
      text: doc.text ?? "",
      metadata: { ...doc.metadata, doc_index: i },
    }));

    return {
      text: this.elementsToText(elements),
      elements,
    };
  }
}
