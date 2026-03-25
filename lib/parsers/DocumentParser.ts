import { ParsedDocument, ParsedElement, ParseOptions } from "./types";

/**
 * Abstract base class for document parsers.
 *
 * Implementations wrap third-party libraries (Unstructured, LlamaIndex, etc.)
 * and normalise their output into a {@link ParsedDocument} that can be fed
 * directly into an {@link IngestionPipeline}.
 *
 * All peer dependencies are loaded lazily via dynamic import so that
 * users only need to install what they actually use.
 *
 * @example
 * ```typescript
 * const parser = new UnstructuredLocalParser();
 * const doc = await parser.parse("/path/to/report.pdf");
 * console.log(doc.elements?.length, "elements parsed");
 * await pipeline.ingestFile("/path/to/report.pdf", parser);
 * ```
 */
export abstract class DocumentParser {
  /** Human-readable parser identifier (e.g. "unstructured-local") */
  abstract readonly name: string;

  /**
   * Parse a document file and return its content.
   *
   * @param filePath - Absolute or relative path to the file
   * @param options  - Optional parsing hints (strategy, languages, etc.)
   */
  abstract parse(
    filePath: string,
    options?: ParseOptions
  ): Promise<ParsedDocument>;

  /**
   * Join elements into a single plain-text string.
   * Filters out empty strings and separates elements with a blank line.
   */
  protected elementsToText(elements: ParsedElement[]): string {
    return elements
      .map((el) => el.text)
      .filter(Boolean)
      .join("\n\n");
  }
}
