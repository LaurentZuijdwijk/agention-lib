import { webSearchTool, bashTool, textEditorTool, builtInTool } from "./BuiltInTool";

describe("webSearchTool", () => {
  it("returns the bare tool definition with no options", () => {
    expect(webSearchTool()).toEqual({
      type: "web_search_20250305",
      name: "web_search",
    });
  });

  it("maps maxUses to max_uses", () => {
    expect(webSearchTool({ maxUses: 5 })).toEqual({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    });
  });

  it("maps allowedDomains to allowed_domains", () => {
    expect(webSearchTool({ allowedDomains: ["wikipedia.org"] })).toEqual({
      type: "web_search_20250305",
      name: "web_search",
      allowed_domains: ["wikipedia.org"],
    });
  });

  it("maps blockedDomains to blocked_domains", () => {
    expect(webSearchTool({ blockedDomains: ["example.com"] })).toEqual({
      type: "web_search_20250305",
      name: "web_search",
      blocked_domains: ["example.com"],
    });
  });

  it("defaults userLocation.type to 'approximate' and merges the rest", () => {
    expect(webSearchTool({ userLocation: { city: "Paris", country: "FR" } })).toEqual({
      type: "web_search_20250305",
      name: "web_search",
      user_location: { type: "approximate", city: "Paris", country: "FR" },
    });
  });

  it("combines multiple options into a single definition", () => {
    expect(
      webSearchTool({ maxUses: 3, allowedDomains: ["wikipedia.org"] })
    ).toEqual({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
      allowed_domains: ["wikipedia.org"],
    });
  });
});

describe("bashTool", () => {
  it("returns the bash tool definition", () => {
    expect(bashTool()).toEqual({ type: "bash_20250124", name: "bash" });
  });
});

describe("textEditorTool", () => {
  it("defaults to the 20250728 version with str_replace_based_edit_tool", () => {
    expect(textEditorTool()).toEqual({
      type: "text_editor_20250728",
      name: "str_replace_based_edit_tool",
    });
  });

  it("maps the 20250124 version to str_replace_editor", () => {
    expect(textEditorTool("20250124")).toEqual({
      type: "text_editor_20250124",
      name: "str_replace_editor",
    });
  });

  it("maps the 20250429 version to str_replace_based_edit_tool", () => {
    expect(textEditorTool("20250429")).toEqual({
      type: "text_editor_20250429",
      name: "str_replace_based_edit_tool",
    });
  });
});

describe("builtInTool", () => {
  it("passes an arbitrary definition through unchanged", () => {
    const definition = { type: "code_execution_20250522", name: "code_execution", extra: true };
    expect(builtInTool(definition)).toBe(definition);
  });
});
