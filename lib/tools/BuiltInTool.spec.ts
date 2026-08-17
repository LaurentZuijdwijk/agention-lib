import {
  webSearchTool,
  bashTool,
  textEditorTool,
  builtInTool,
  openAiWebSearchTool,
  openAiFileSearchTool,
  openAiCodeInterpreterTool,
  openRouterWebSearchTool,
  openRouterWebFetchTool,
} from "./BuiltInTool";

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

describe("openAiWebSearchTool", () => {
  it("returns the bare tool definition with no options", () => {
    expect(openAiWebSearchTool()).toEqual({ type: "web_search" });
  });

  it("maps allowedDomains/blockedDomains into a single filters object", () => {
    expect(
      openAiWebSearchTool({
        allowedDomains: ["wikipedia.org"],
        blockedDomains: ["example.com"],
      })
    ).toEqual({
      type: "web_search",
      filters: {
        allowed_domains: ["wikipedia.org"],
        blocked_domains: ["example.com"],
      },
    });
  });

  it("defaults userLocation.type to 'approximate' and merges the rest", () => {
    expect(openAiWebSearchTool({ userLocation: { city: "Paris", country: "FR" } })).toEqual({
      type: "web_search",
      user_location: { type: "approximate", city: "Paris", country: "FR" },
    });
  });

  it("maps searchContextSize straight through", () => {
    expect(openAiWebSearchTool({ searchContextSize: "high" })).toEqual({
      type: "web_search",
      search_context_size: "high",
    });
  });
});

describe("openAiFileSearchTool", () => {
  it("requires only vector store ids", () => {
    expect(openAiFileSearchTool(["vs_123"])).toEqual({
      type: "file_search",
      vector_store_ids: ["vs_123"],
    });
  });

  it("maps maxNumResults to max_num_results", () => {
    expect(openAiFileSearchTool(["vs_123"], { maxNumResults: 2 })).toEqual({
      type: "file_search",
      vector_store_ids: ["vs_123"],
      max_num_results: 2,
    });
  });
});

describe("openAiCodeInterpreterTool", () => {
  it("defaults to an auto-provisioned container", () => {
    expect(openAiCodeInterpreterTool()).toEqual({
      type: "code_interpreter",
      container: { type: "auto" },
    });
  });

  it("reuses an existing container id when given", () => {
    expect(openAiCodeInterpreterTool("cntr_123")).toEqual({
      type: "code_interpreter",
      container: "cntr_123",
    });
  });
});

describe("openRouterWebSearchTool", () => {
  it("returns the bare tool definition with no options", () => {
    expect(openRouterWebSearchTool()).toEqual({ type: "openrouter:web_search" });
  });

  it("maps every option to its snake_case field", () => {
    expect(
      openRouterWebSearchTool({
        maxResults: 5,
        maxTotalResults: 10,
        searchContextSize: "medium",
        allowedDomains: ["wikipedia.org"],
        excludedDomains: ["example.com"],
      })
    ).toEqual({
      type: "openrouter:web_search",
      max_results: 5,
      max_total_results: 10,
      search_context_size: "medium",
      allowed_domains: ["wikipedia.org"],
      excluded_domains: ["example.com"],
    });
  });
});

describe("openRouterWebFetchTool", () => {
  it("returns the bare tool definition", () => {
    expect(openRouterWebFetchTool()).toEqual({ type: "openrouter:web_fetch" });
  });
});
