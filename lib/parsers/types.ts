/**
 * A single structured element extracted from a document.
 * Matches the element format returned by Unstructured and similar parsers.
 */
export interface ParsedElement {
  /**
   * Element type — e.g. "Title", "NarrativeText", "Table", "Image",
   * "ListItem", "Header", "Footer", "Document", etc.
   */
  type: string;
  /** Text content of this element */
  text: string;
  /**
   * Parser-provided metadata — e.g. page_number, coordinates, languages,
   * file_directory, filename, filetype, etc.
   */
  metadata?: Record<string, unknown>;
}

/**
 * The result of parsing a document file.
 */
export interface ParsedDocument {
  /** Full plain-text content (elements joined by double newlines) */
  text: string;
  /**
   * Structured elements if the parser supports them.
   * Absent when the parser only returns plain text.
   */
  elements?: ParsedElement[];
  /** File-level metadata from the parser, when available */
  metadata?: Record<string, unknown>;
}

/**
 * Options shared across all document parsers.
 */
export interface ParseOptions {
  /**
   * Parsing strategy.
   * - `"auto"`: Let the parser decide (default)
   * - `"fast"`: Text extraction only, no OCR
   * - `"hi_res"`: High-resolution layout analysis with OCR
   * - `"ocr_only"`: Force OCR on every page
   */
  strategy?: "auto" | "fast" | "hi_res" | "ocr_only";
  /** Languages to use for OCR (ISO 639-1 codes, e.g. `["eng", "fra"]`) */
  languages?: string[];
  /** Pass-through options specific to the underlying parser */
  [key: string]: unknown;
}
