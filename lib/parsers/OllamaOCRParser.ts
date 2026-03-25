import * as fs from "fs";
import * as path from "path";
import { DocumentParser } from "./DocumentParser";
import { ParsedDocument, ParsedElement, ParseOptions } from "./types";

/** Supported image extensions for direct OCR (no conversion needed). */
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

/**
 * Configuration for {@link OllamaOCRParser}.
 */
export interface OllamaOCRParserConfig {
  /**
   * Ollama model to use for OCR.
   * @default "glm-ocr"
   */
  model?: string;

  /**
   * Base URL of the local Ollama server.
   * @default "http://localhost:11434"
   */
  baseUrl?: string;

  /**
   * Prompt sent alongside each image.
   * @default "Extract and transcribe all text from this image. Preserve the original structure, headings, and formatting as much as possible. Output only the extracted text."
   */
  prompt?: string;

  /**
   * Scale factor for rendering PDF pages to images.
   * 1.0 = 72 DPI, 2.0 = 144 DPI. Lower is faster; higher improves OCR accuracy.
   * @default 2.0
   */
  pdfScale?: number;

  /**
   * Number of pages to OCR in parallel.
   * Higher values are faster but use more memory and GPU.
   * @default 3
   */
  concurrency?: number;

  /**
   * Called after each PDF page is OCR'd.
   * With concurrency > 1 pages may complete out of order,
   * but the final document is always in the correct page order.
   */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Document parser that uses a locally-running **Ollama** vision model (e.g. `glm-ocr`)
 * to perform OCR on image files and PDF documents.
 *
 * **Supported file types:**
 * - Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp` — no extra dependencies
 * - PDF: requires the optional peer dependency `pdf-to-img` (`npm install pdf-to-img`)
 *
 * **Ollama must be running** with the model pulled:
 * ```bash
 * ollama pull glm-ocr
 * ollama serve   # if not already running
 * ```
 *
 * @example
 * ```typescript
 * import { OllamaOCRParser } from "@agentionai/agents/parsers/ollama-ocr";
 *
 * const parser = new OllamaOCRParser({
 *   model: "glm-ocr",
 *   pdfScale: 1.5,
 *   onProgress: (page, total) => console.log(`OCR page ${page}/${total}...`),
 * });
 *
 * // Parse an image
 * const doc = await parser.parse("/path/to/scan.png");
 *
 * // Parse a PDF (requires: npm install pdf-to-img)
 * const pdf = await parser.parse("/path/to/report.pdf");
 *
 * // Use with IngestionPipeline
 * await pipeline.ingestFile("/path/to/scan.png", parser);
 * ```
 */
export class OllamaOCRParser extends DocumentParser {
  readonly name = "ollama-ocr";

  private readonly model: string;
  private readonly baseUrl: string;
  private readonly prompt: string;
  private readonly pdfScale: number;
  private readonly concurrency: number;
  private readonly onProgress?: (completed: number, total: number) => void;

  constructor(config: OllamaOCRParserConfig = {}) {
    super();
    this.model = config.model ?? "glm-ocr";
    this.baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.prompt =
      config.prompt ??
      "Extract and transcribe all text from this image. Preserve the original structure, headings, and formatting as much as possible. Output only the extracted text.";
    this.pdfScale = config.pdfScale ?? 2.0;
    this.concurrency = config.concurrency ?? 3;
    this.onProgress = config.onProgress;
  }

  /**
   * Parse a document file using Ollama OCR.
   *
   * @param filePath - Path to the image or PDF file
   * @param options  - Optional hints (unused by this parser; provided for interface compatibility)
   */
  async parse(filePath: string, _options?: ParseOptions): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
      return this.parseImageFile(filePath);
    }

    if (ext === ".pdf") {
      return this.parsePdf(filePath);
    }

    throw new Error(
      `OllamaOCRParser: unsupported file type "${ext}". ` +
        `Supported: ${[...IMAGE_EXTS].join(", ")}, .pdf`
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async parseImageFile(filePath: string): Promise<ParsedDocument> {
    const base64 = fs.readFileSync(filePath).toString("base64");
    const text = await this.runOCR(base64);
    const element: ParsedElement = {
      type: "NarrativeText",
      text,
      metadata: { source: filePath },
    };
    return { text, elements: [element], metadata: { filePath, pages: 1 } };
  }

  private async parsePdf(filePath: string): Promise<ParsedDocument> {
    // Dynamically load pdf-to-img — optional peer dep, no system deps required
    let pdfFn: (
      input: string,
      options?: { scale?: number }
    ) => Promise<AsyncIterable<Buffer> & { length: number }>;

    try {
      // Resolve the module from process.cwd() so that peer deps installed in
      // the consuming project (not this library's own node_modules) are found.
      const { createRequire } = await import("module");
      const { pathToFileURL } = await import("url");
      const requireFromCwd = createRequire(path.resolve(process.cwd(), "__placeholder__.js"));
      const resolved = requireFromCwd.resolve("pdf-to-img");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ pdf: pdfFn } = await import(/* webpackIgnore: true */ pathToFileURL(resolved).href) as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Cannot find module") ||
        message.includes("MODULE_NOT_FOUND") ||
        message.includes("ERR_MODULE_NOT_FOUND")
      ) {
        throw new Error(
          "OllamaOCRParser: PDF parsing requires 'pdf-to-img'. " +
            "Install it with: npm install pdf-to-img"
        );
      }
      throw err;
    }

    const doc = await pdfFn(filePath, { scale: this.pdfScale });
    const total = doc.length;

    // Step 1: render all pages to buffers (fast — pure JS, no network)
    const pageBuffers: Buffer[] = [];
    for await (const buf of doc) {
      pageBuffers.push(buf);
    }

    // Step 2: OCR pages in parallel using a worker-pool with concurrency limit
    const elements: ParsedElement[] = new Array(total);
    let completed = 0;
    const queue = pageBuffers.map((buf, i) => async () => {
      const text = await this.runOCR(buf.toString("base64"));
      elements[i] = {
        type: "NarrativeText",
        text,
        metadata: { page_number: i + 1, source: filePath },
      };
      this.onProgress?.(++completed, total);
    });

    const workers = Array.from({ length: Math.min(this.concurrency, total) }, async () => {
      while (queue.length > 0) {
        await queue.shift()!();
      }
    });
    await Promise.all(workers);

    return {
      text: this.elementsToText(elements),
      elements,
      metadata: { filePath, pages: total },
    };
  }

  /**
   * Send a base64-encoded image to the Ollama chat API and return the extracted text.
   */
  private async runOCR(base64Image: string): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: this.prompt,
            images: [base64Image],
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OllamaOCRParser: Ollama API error ${response.status} ${response.statusText}` +
          (body ? `\n${body}` : "")
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? "";
  }
}
