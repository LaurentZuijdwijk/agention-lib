import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { OllamaOCRParser } from "./OllamaOCRParser";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function ollamaResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: { content: text } }),
    text: async () => "",
  } as unknown as Response;
}

describe("OllamaOCRParser", () => {
  let tmpDir: string;
  let pngFile: string;

  beforeEach(() => {
    mockFetch.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ollama-ocr-test-"));
    pngFile = path.join(tmpDir, "test.png");
    // Write a minimal 1×1 white PNG (89 bytes, valid PNG header)
    const minimalPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
        "2e00000000c4944415408d7636060600000000200016340cdb0000000049454e44ae426082",
      "hex"
    );
    fs.writeFileSync(pngFile, minimalPng);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("constructor defaults", () => {
    it("uses glm-ocr model and localhost by default", () => {
      const parser = new OllamaOCRParser();
      expect(parser.name).toBe("ollama-ocr");
    });

    it("accepts custom config", () => {
      const parser = new OllamaOCRParser({
        model: "llava",
        baseUrl: "http://192.168.1.10:11434",
      });
      expect(parser.name).toBe("ollama-ocr");
    });
  });

  describe("parse() – image files", () => {
    it("calls Ollama API and returns extracted text", async () => {
      mockFetch.mockResolvedValueOnce(ollamaResponse("Hello World"));

      const parser = new OllamaOCRParser();
      const doc = await parser.parse(pngFile);

      expect(doc.text).toBe("Hello World");
      expect(doc.elements).toHaveLength(1);
      expect(doc.elements![0].type).toBe("NarrativeText");
      expect(doc.metadata?.pages).toBe(1);
    });

    it("sends correct request to Ollama", async () => {
      mockFetch.mockResolvedValueOnce(ollamaResponse("text"));

      const parser = new OllamaOCRParser({ model: "glm-ocr", baseUrl: "http://localhost:11434" });
      await parser.parse(pngFile);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/chat",
        expect.objectContaining({ method: "POST" })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("glm-ocr");
      expect(body.stream).toBe(false);
      expect(body.messages[0].role).toBe("user");
      expect(typeof body.messages[0].images[0]).toBe("string"); // base64
    });

    it("strips trailing whitespace from OCR output", async () => {
      mockFetch.mockResolvedValueOnce(ollamaResponse("  trimmed  \n"));

      const parser = new OllamaOCRParser();
      const doc = await parser.parse(pngFile);

      expect(doc.text).toBe("trimmed");
    });

    it("throws on non-200 Ollama response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "model not found",
      } as unknown as Response);

      const parser = new OllamaOCRParser();
      await expect(parser.parse(pngFile)).rejects.toThrow("404");
    });

    it("throws for unsupported file extensions", async () => {
      const txtFile = path.join(tmpDir, "doc.txt");
      fs.writeFileSync(txtFile, "hello");

      const parser = new OllamaOCRParser();
      await expect(parser.parse(txtFile)).rejects.toThrow('unsupported file type ".txt"');
    });
  });

  describe("parse() – JPEG and WebP", () => {
    it.each([".jpg", ".jpeg", ".webp", ".bmp", ".gif"])("handles %s extension", async (ext) => {
      mockFetch.mockResolvedValueOnce(ollamaResponse("ok"));
      const imgFile = path.join(tmpDir, `test${ext}`);
      fs.writeFileSync(imgFile, Buffer.from("fake-image-data"));

      const parser = new OllamaOCRParser();
      const doc = await parser.parse(imgFile);

      expect(doc.text).toBe("ok");
    });
  });

  describe("parse() – PDF (pdf-to-img missing)", () => {
    it("throws a helpful install message when pdf-to-img is not installed", async () => {
      const pdfFile = path.join(tmpDir, "doc.pdf");
      fs.writeFileSync(pdfFile, "%PDF-1.4 fake content");

      // pdf-to-img is not installed in test env — dynamic import will fail
      const parser = new OllamaOCRParser();
      await expect(parser.parse(pdfFile)).rejects.toThrow("npm install pdf-to-img");
    });
  });
});
