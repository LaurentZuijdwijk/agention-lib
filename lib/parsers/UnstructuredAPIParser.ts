import { DocumentParser } from "./DocumentParser";
import { ParsedDocument, ParsedElement, ParseOptions } from "./types";

/**
 * Configuration for {@link UnstructuredAPIParser}.
 */
export interface UnstructuredAPIParserConfig {
  /**
   * API key for the Unstructured hosted service.
   * Not required when `serverUrl` points to a self-hosted instance
   * that does not enforce authentication.
   */
  apiKey?: string;
  /**
   * Base URL of the Unstructured API.
   * Defaults to the official hosted endpoint when an `apiKey` is provided.
   * Set to your own host when running the open-source API server locally:
   * ```
   * docker run -p 8000:8000 downloads.unstructured.io/unstructured-io/unstructured-api:latest
   * serverUrl: "http://localhost:8000"
   * ```
   */
  serverUrl?: string;
}

const STRATEGY_MAP: Record<string, string> = {
  auto: "auto",
  fast: "fast",
  hi_res: "hi_res",
  ocr_only: "ocr_only",
};

/**
 * Document parser backed by the **Unstructured REST API** — either the
 * official hosted service or a self-hosted open-source API server.
 *
 * Uses the official `unstructured-client` npm package under the hood.
 *
 * **Peer dependency:** `unstructured-client`
 *
 * @example
 * ```typescript
 * // Hosted service
 * const parser = new UnstructuredAPIParser({ apiKey: process.env.UNSTRUCTURED_API_KEY });
 *
 * // Self-hosted (no auth required)
 * const parser = new UnstructuredAPIParser({ serverUrl: "http://localhost:8000" });
 *
 * const doc = await parser.parse("/path/to/report.pdf", { strategy: "hi_res" });
 * await pipeline.ingestFile("/path/to/report.pdf", parser);
 * ```
 */
export class UnstructuredAPIParser extends DocumentParser {
  readonly name = "unstructured-api";

  constructor(private readonly config: UnstructuredAPIParserConfig = {}) {
    super();
  }

  /**
   * Parse a file via the Unstructured API.
   *
   * @param filePath - Path to the document to parse (read from disk)
   * @param options  - Strategy, languages, and any other partition parameters
   */
  async parse(filePath: string, options?: ParseOptions): Promise<ParsedDocument> {
    const pkg = "unstructured-client";
    let UnstructuredClient: new (config: Record<string, unknown>) => {
      general: {
        partition(params: Record<string, unknown>): Promise<{
          statusCode?: number;
          elements?: unknown[];
        }>;
      };
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ UnstructuredClient } = await import(/* webpackIgnore: true */ pkg) as any);
    } catch {
      throw new Error(
        "UnstructuredAPIParser requires 'unstructured-client'. " +
          "Install it with: npm install unstructured-client"
      );
    }

    const fs = await import("fs");
    const path = await import("path");

    const clientConfig: Record<string, unknown> = {};
    if (this.config.apiKey) {
      clientConfig["security"] = { apiKeyAuth: this.config.apiKey };
    }
    if (this.config.serverUrl) {
      clientConfig["serverURL"] = this.config.serverUrl;
    }

    const client = new UnstructuredClient(clientConfig);

    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const { strategy, languages, ...rest } = options ?? {};

    const res = await client.general.partition({
      partitionParameters: {
        files: { content: fileContent, fileName },
        strategy: STRATEGY_MAP[strategy ?? "auto"] ?? "auto",
        ...(languages ? { languages } : {}),
        ...rest,
      },
    });

    const rawElements: unknown[] = res.elements ?? [];
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
