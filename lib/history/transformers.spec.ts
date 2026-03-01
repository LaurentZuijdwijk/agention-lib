/**
 * Transformer tests — multimodal image content
 */
import {
  anthropicTransformer,
  openAiTransformer,
  mistralTransformer,
  geminiTransformer,
} from "./transformers";
import { imageUrl, imageBase64 } from "./types";
import type { HistoryEntry } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userWithImage(content: HistoryEntry["content"]): HistoryEntry {
  return { role: "user", content };
}

const URL_ENTRY = userWithImage([
  { type: "text", text: "What's in this image?" },
  imageUrl("https://example.com/photo.jpg", { mimeType: "image/jpeg" }),
]);

const B64_ENTRY = userWithImage([
  { type: "text", text: "Describe this." },
  imageBase64("abc123base64data", "image/png"),
]);

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe("anthropicTransformer — image content", () => {
  it("converts image_url to Anthropic ImageBlockParam (url source)", () => {
    const messages = anthropicTransformer.toProvider([URL_ENTRY]);
    expect(messages).toHaveLength(1);
    const content = messages[0].content as any[];
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "What's in this image?" });
    expect(content[1]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/photo.jpg" },
    });
  });

  it("converts image_base64 to Anthropic ImageBlockParam (base64 source)", () => {
    const messages = anthropicTransformer.toProvider([B64_ENTRY]);
    const content = messages[0].content as any[];
    expect(content[1]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "abc123base64data",
      },
    });
  });
});

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

describe("openAiTransformer — image content", () => {
  it("converts mixed text+image_url to content parts array", () => {
    const items = openAiTransformer.toProvider([URL_ENTRY]) as any[];
    expect(items).toHaveLength(1);
    const parts = items[0].content;
    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0]).toEqual({ type: "input_text", text: "What's in this image?" });
    expect(parts[1]).toEqual({
      type: "input_image",
      image_url: "https://example.com/photo.jpg",
    });
  });

  it("encodes image_base64 as data URI in image_url field", () => {
    const items = openAiTransformer.toProvider([B64_ENTRY]) as any[];
    const parts = items[0].content as any[];
    expect(parts[1]).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,abc123base64data",
    });
  });

  it("preserves detail hint when present", () => {
    const entry = userWithImage([
      imageUrl("https://example.com/photo.jpg", { detail: "high" }),
    ]);
    const items = openAiTransformer.toProvider([entry]) as any[];
    const parts = items[0].content as any[];
    expect(parts[0].detail).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Mistral
// ---------------------------------------------------------------------------

describe("mistralTransformer — image content", () => {
  it("converts image_url to Mistral image_url content part", () => {
    const messages = mistralTransformer.toProvider([URL_ENTRY]) as any[];
    expect(messages).toHaveLength(1);
    const parts = messages[0].content as any[];
    expect(parts).toContainEqual({ type: "text", text: "What's in this image?" });
    expect(parts).toContainEqual({
      type: "image_url",
      image_url: "https://example.com/photo.jpg",
    });
  });

  it("throws for image_base64 inputs", () => {
    expect(() => mistralTransformer.toProvider([B64_ENTRY])).toThrow(
      /Mistral does not support base64/
    );
  });
});

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

describe("geminiTransformer — image content", () => {
  it("converts image_url to fileData part", () => {
    const contents = geminiTransformer.toProvider([URL_ENTRY]) as any[];
    expect(contents).toHaveLength(1);
    const parts = contents[0].parts as any[];
    expect(parts).toContainEqual({ text: "What's in this image?" });
    expect(parts).toContainEqual({
      fileData: { mimeType: "image/jpeg", fileUri: "https://example.com/photo.jpg" },
    });
  });

  it("converts image_base64 to inlineData part", () => {
    const contents = geminiTransformer.toProvider([B64_ENTRY]) as any[];
    const parts = contents[0].parts as any[];
    expect(parts).toContainEqual({
      inlineData: { mimeType: "image/png", data: "abc123base64data" },
    });
  });

  it("uses image/jpeg as default mimeType when not specified for image_url", () => {
    const entry = userWithImage([imageUrl("https://example.com/img.jpg")]);
    const contents = geminiTransformer.toProvider([entry]) as any[];
    const parts = contents[0].parts as any[];
    expect(parts[0].fileData.mimeType).toBe("image/jpeg");
  });
});
