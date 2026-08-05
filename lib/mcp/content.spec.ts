import { renderContentBlock, renderToolResult } from "./content";

describe("renderContentBlock", () => {
  it("returns text blocks verbatim", () => {
    expect(renderContentBlock({ type: "text", text: "Sunny, 22°C" })).toBe("Sunny, 22°C");
  });

  it("returns an empty string for a text block without text", () => {
    expect(renderContentBlock({ type: "text" } as never)).toBe("");
  });

  it("describes image blocks with mime type and decoded size", () => {
    const data = "A".repeat(4096);
    expect(renderContentBlock({ type: "image", data, mimeType: "image/png" })).toBe(
      "[image content: image/png, 3.0 KB]"
    );
  });

  it("describes audio blocks with mime type and decoded size", () => {
    expect(
      renderContentBlock({ type: "audio", data: "AAAA", mimeType: "audio/wav" })
    ).toBe("[audio content: audio/wav, 3 B]");
  });

  it("accounts for base64 padding when reporting size", () => {
    expect(renderContentBlock({ type: "image", data: "AAA=", mimeType: "image/png" })).toBe(
      "[image content: image/png, 2 B]"
    );
  });

  it("inlines the text of an embedded text resource under its uri", () => {
    const rendered = renderContentBlock({
      type: "resource",
      resource: {
        uri: "file:///tmp/notes.md",
        mimeType: "text/markdown",
        text: "# Notes",
      },
    });

    expect(rendered).toBe("[resource: file:///tmp/notes.md, text/markdown]\n# Notes");
  });

  it("describes an embedded binary resource by size", () => {
    const rendered = renderContentBlock({
      type: "resource",
      resource: {
        uri: "file:///tmp/report.pdf",
        mimeType: "application/pdf",
        blob: "A".repeat(2048),
      },
    });

    expect(rendered).toBe(
      "[resource: file:///tmp/report.pdf, application/pdf, 1.5 KB]"
    );
  });

  it("describes resource links with name and description", () => {
    const rendered = renderContentBlock({
      type: "resource_link",
      uri: "file:///tmp/data.csv",
      name: "data.csv",
      description: "Quarterly figures",
    });

    expect(rendered).toBe("[resource link: file:///tmp/data.csv (data.csv) — Quarterly figures]");
  });

  it("serialises unrecognised block types rather than dropping them", () => {
    const rendered = renderContentBlock({ type: "video", url: "https://example.com/v.mp4" });

    expect(rendered).toBe(
      '[video content: {"type":"video","url":"https://example.com/v.mp4"}]'
    );
  });
});

describe("renderToolResult", () => {
  it("returns a single text block as a plain string", () => {
    expect(renderToolResult({ content: [{ type: "text", text: "ok" }] })).toBe("ok");
  });

  it("joins multiple blocks with newlines in server order", () => {
    const rendered = renderToolResult({
      content: [
        { type: "text", text: "Here is the chart:" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
        { type: "text", text: "Generated at 09:00" },
      ],
    });

    expect(rendered).toBe(
      "Here is the chart:\n[image content: image/png, 3 B]\nGenerated at 09:00"
    );
  });

  it("appends structuredContent when the result has no text block", () => {
    const rendered = renderToolResult({
      content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
      structuredContent: { temperature: 22 },
    });

    expect(rendered).toBe('[image content: image/png, 3 B]\n{"temperature":22}');
  });

  it("does not duplicate structuredContent when a text block is present", () => {
    const rendered = renderToolResult({
      content: [{ type: "text", text: '{"temperature":22}' }],
      structuredContent: { temperature: 22 },
    });

    expect(rendered).toBe('{"temperature":22}');
  });

  it("returns structuredContent as an object when there are no content blocks", () => {
    expect(renderToolResult({ content: [], structuredContent: { temperature: 22 } })).toEqual({
      temperature: 22,
    });
  });

  it("falls back to JSON serialisation of the whole result", () => {
    expect(renderToolResult({ content: [] })).toBe(JSON.stringify({ content: [] }));
  });

  it("handles a null result", () => {
    expect(renderToolResult(null)).toBe("null");
  });
});
