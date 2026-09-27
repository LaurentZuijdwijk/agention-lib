import { serializeToolResult } from "./tool-result";

describe("serializeToolResult", () => {
  it("passes strings through unchanged, newlines and quotes included", () => {
    const output = 'line 1\nline 2 with "quotes"\n';
    expect(serializeToolResult(output)).toBe(output);
  });

  it("does not re-parse strings that happen to look like JSON", () => {
    expect(serializeToolResult('{"a":1}')).toBe('{"a":1}');
  });

  it("serializes objects and arrays as JSON", () => {
    expect(serializeToolResult({ ok: true, lines: ["a", "b"] })).toBe(
      '{"ok":true,"lines":["a","b"]}'
    );
    expect(serializeToolResult([1, 2])).toBe("[1,2]");
  });

  it("serializes scalars as JSON", () => {
    expect(serializeToolResult(42)).toBe("42");
    expect(serializeToolResult(false)).toBe("false");
    expect(serializeToolResult(null)).toBe("null");
  });

  it("returns an empty string for undefined", () => {
    expect(serializeToolResult(undefined)).toBe("");
  });
});
