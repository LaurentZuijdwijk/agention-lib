import { DocumentParser } from "./DocumentParser";
import { ParsedDocument, ParsedElement, ParseOptions } from "./types";

/**
 * Document parser that uses the **local** (open-source Python) version of
 * Unstructured via the `@epilogo/unstructured-io-node` npm bridge.
 *
 * The bridge spawns a Python virtual environment and calls the Python
 * `unstructured` library directly — no API key required, but Python 3.8+
 * and system dependencies (poppler, tesseract, etc.) must be available.
 *
 * **Peer dependency:** `@epilogo/unstructured-io-node`
 *
 * @example
 * ```typescript
 * import { UnstructuredLocalParser } from "@agentionai/agents/parsers";
 *
 * const parser = new UnstructuredLocalParser();
 * const doc = await parser.parse("/path/to/report.pdf", {
 *   strategy: "hi_res",
 *   languages: ["eng"],
 * });
 * console.log(doc.elements?.length, "elements");
 *
 * // Use with IngestionPipeline
 * await pipeline.ingestFile("/path/to/report.pdf", parser);
 * ```
 */
export class UnstructuredLocalParser extends DocumentParser {
  readonly name = "unstructured-local";

  /**
   * Parse a file using the local Python Unstructured library.
   *
   * On first call, `ensureEnvironmentSetup()` is invoked to download the
   * Python venv if it does not already exist (one-time, slow operation).
   *
   * @param filePath - Path to the document to parse
   * @param options  - Strategy, languages, and any other unstructured kwargs
   */
  async parse(filePath: string, options?: ParseOptions): Promise<ParsedDocument> {
    const pkg = "@epilogo/unstructured-io-node";
    let UnstructuredIO: {
      ensureEnvironmentSetup(): Promise<void>;
      partition(opts: Record<string, unknown>): Promise<unknown[]>;
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ UnstructuredIO } = await import(/* webpackIgnore: true */ pkg) as any);
    } catch {
      throw new Error(
        "UnstructuredLocalParser requires '@epilogo/unstructured-io-node'. " +
          "Install it with: npm install @epilogo/unstructured-io-node"
      );
    }

    await UnstructuredIO.ensureEnvironmentSetup();

    const { strategy, languages, ...rest } = options ?? {};

    const rawElements = await UnstructuredIO.partition({
      filename: filePath,
      strategy: strategy ?? "auto",
      ...(languages ? { languages } : {}),
      ...rest,
    });

    const elements = this.mapRawElements(rawElements);

    return {
      text: this.elementsToText(elements),
      elements,
    };
  }

  private mapRawElements(raw: unknown[]): ParsedElement[] {
    return raw.map((el) => {
      const e = el as Record<string, unknown>;
      return {
        type: typeof e["type"] === "string" ? e["type"] : "unknown",
        text: typeof e["text"] === "string" ? e["text"] : "",
        metadata:
          e["metadata"] != null &&
          typeof e["metadata"] === "object" &&
          !Array.isArray(e["metadata"])
            ? (e["metadata"] as Record<string, unknown>)
            : undefined,
      };
    });
  }
}
