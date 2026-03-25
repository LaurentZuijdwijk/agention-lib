import { Chunker } from "./Chunker";
import { Chunk, ChunkMetadata, ChunkerConfig, ChunkOptions } from "./types";
import { ParsedElement } from "../parsers/types";

/**
 * Configuration for {@link ElementChunker}.
 */
export interface ElementChunkerConfig extends ChunkerConfig {
  /**
   * Element types to skip entirely.
   * Useful for dropping decorative or non-content elements.
   * @example ["Image", "PageBreak", "Header", "Footer"]
   */
  excludeTypes?: string[];

  /**
   * Element types that always start a new chunk, even if there is room
   * in the current one. Use this to keep headings at the top of their
   * section's chunk.
   * @default ["Title"]
   */
  breakOnTypes?: string[];
}

/**
 * Chunks a document by grouping its **structured elements** rather than
 * splitting raw text. Designed for use with parsers that return element
 * lists (e.g. {@link UnstructuredLocalParser}, {@link UnstructuredAPIParser}).
 *
 * **How it works:**
 * 1. Adjacent elements are merged into a single chunk until the combined
 *    character count would exceed `chunkSize`.
 * 2. A `breakOnTypes` element (default: `"Title"`) always starts a fresh
 *    chunk so that headings introduce their section's content.
 * 3. A single element whose text exceeds `chunkSize` is split recursively
 *    using separator heuristics (paragraphs → sentences → words → characters).
 * 4. Element types are stored in `chunk.metadata.element_types`; page number
 *    is stored in `chunk.metadata.page` when available.
 *
 * Use via {@link IngestionPipeline.ingestFile} — the pipeline automatically
 * calls `chunkElements()` instead of `chunk()` when this chunker is used and
 * the parser returns a structured element list.
 *
 * @example
 * ```typescript
 * import { ElementChunker } from '@agentionai/agents/chunkers';
 * import { UnstructuredLocalParser } from '@agentionai/agents/parsers/unstructured-local';
 *
 * const pipeline = new IngestionPipeline(
 *   new ElementChunker({ chunkSize: 1000 }),
 *   embeddings,
 *   store,
 * );
 *
 * await pipeline.ingestFile('/docs/report.pdf', new UnstructuredLocalParser(), {
 *   strategy: 'hi_res',
 * });
 * ```
 */
export class ElementChunker extends Chunker {
  readonly name = "ElementChunker";

  private readonly excludeTypes: Set<string>;
  private readonly breakOnTypes: Set<string>;

  constructor(config: ElementChunkerConfig) {
    super(config);
    this.excludeTypes = new Set(config.excludeTypes ?? []);
    this.breakOnTypes = new Set(config.breakOnTypes ?? ["Title"]);
  }

  // ─── element-aware primary path ──────────────────────────────────────────

  /**
   * Chunk a list of structured elements into {@link Chunk} objects.
   *
   * This is the primary entry point when using this chunker with a parser.
   * Called automatically by {@link IngestionPipeline.ingestFile} when
   * the parsed document has an `elements` array.
   *
   * @param elements - Parsed elements from a {@link DocumentParser}
   * @param options  - Source tracking and custom metadata
   */
  async chunkElements(
    elements: ParsedElement[],
    options?: ChunkOptions
  ): Promise<Chunk[]> {
    const { chunkSize } = this.config;
    const chunks: Chunk[] = [];

    // Working group — elements accumulated into the next chunk
    let groupElements: ParsedElement[] = [];
    let groupSize = 0;

    const flush = () => {
      if (groupElements.length === 0) return;
      const content = groupElements
        .map((el) => el.text)
        .filter(Boolean)
        .join("\n\n");
      if (content.trim()) {
        chunks.push(this.buildChunk(content, groupElements, chunks.length, options));
      }
      groupElements = [];
      groupSize = 0;
    };

    for (const el of elements) {
      if (this.excludeTypes.has(el.type)) continue;

      const text = el.text?.trim() ?? "";
      if (!text) continue;

      // Break-on-type: flush current group before adding this element
      if (this.breakOnTypes.has(el.type) && groupElements.length > 0) {
        flush();
      }

      if (text.length > chunkSize) {
        // Flush current group first, then split the large element into sub-chunks
        flush();
        const subTexts = this.splitLargeText(text);
        for (const subText of subTexts) {
          chunks.push(this.buildChunk(subText, [el], chunks.length, options));
        }
      } else if (groupSize + text.length > chunkSize && groupElements.length > 0) {
        // Adding this element would overflow — flush and start fresh
        flush();
        groupElements.push(el);
        groupSize = text.length;
      } else {
        groupElements.push(el);
        groupSize += text.length;
      }
    }

    flush();

    if (chunks.length === 0) return [];

    // Set correct total and link chunks
    for (const chunk of chunks) {
      chunk.metadata.total = chunks.length;
    }
    this.linkChunks(chunks);

    if (this.config.chunkProcessor) {
      return this.applyProcessor(chunks);
    }

    return chunks;
  }

  // ─── text fallback path (required by Chunker) ────────────────────────────

  /**
   * Fallback text splitting used when {@link Chunker.chunk} is called directly
   * (i.e. without a structured element list). Splits on double newlines first,
   * then sentences, then words.
   */
  protected splitText(text: string): string[] {
    return this.splitLargeText(text);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  /**
   * Build a {@link Chunk} from a group of elements.
   */
  private buildChunk(
    content: string,
    sourceElements: ParsedElement[],
    index: number,
    options?: ChunkOptions
  ): Chunk {
    const elementTypes = [...new Set(sourceElements.map((el) => el.type))];

    // Use page_number from the first element that provides it
    const page = sourceElements
      .map((el) => el.metadata?.["page_number"] as number | undefined)
      .find((p) => p != null);

    const metadata: ChunkMetadata = {
      index,
      total: 0, // set after all chunks are built
      prev_id: null,
      next_id: null,
      start: 0,
      end: content.length,
      source_id: options?.sourceId,
      source_path: options?.sourcePath,
      char_count: content.length,
      hash: this.computeHash(content),
      section: this.detectSectionTitle(content),
      page,
      element_types: elementTypes,
      ...options?.metadata,
    };

    return {
      id: this.generateId(content, index, options?.sourceId),
      content,
      metadata,
    };
  }

  /**
   * Split a single large element text using separator heuristics.
   */
  private splitLargeText(text: string): string[] {
    const { chunkSize, chunkOverlap = 0 } = this.config;

    if (text.length <= chunkSize) return [text];

    const separators = ["\n\n", "\n", ". ", " "];

    for (const sep of separators) {
      const parts = text.split(sep).filter((s) => s.trim());
      if (parts.length <= 1) continue;

      const merged = this.mergeToSize(parts, sep, chunkSize);
      // Apply overlap if configured
      if (chunkOverlap > 0 && merged.length > 1) {
        return this.applyCharOverlap(merged, chunkOverlap);
      }
      return merged;
    }

    return this.forceSplit(text, chunkSize, chunkOverlap);
  }

  /**
   * Greedily merge string parts into windows of at most `maxSize` characters.
   */
  private mergeToSize(parts: string[], sep: string, maxSize: number): string[] {
    const result: string[] = [];
    let current = "";

    for (const part of parts) {
      const addition = current ? sep + part : part;
      if (current.length + addition.length <= maxSize) {
        current = current + addition;
      } else {
        if (current) result.push(current);
        if (part.length > maxSize) {
          result.push(...this.forceSplit(part, maxSize, 0));
          current = "";
        } else {
          current = part;
        }
      }
    }
    if (current) result.push(current);
    return result;
  }

  /**
   * Hard character-count split when no separator works.
   */
  private forceSplit(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    const step = size - overlap;
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      const slice = text.slice(start, end);
      if (slice.trim()) chunks.push(slice);
      if (end >= text.length) break;
      start += step;
    }
    return chunks;
  }

  /**
   * Apply character-level overlap between already-split strings.
   */
  private applyCharOverlap(chunks: string[], overlap: number): string[] {
    if (chunks.length <= 1) return chunks;
    const result = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const tail = prev.length > overlap ? prev.slice(prev.length - overlap) : prev;
      result.push(tail + " " + chunks[i]);
    }
    return result;
  }
}
