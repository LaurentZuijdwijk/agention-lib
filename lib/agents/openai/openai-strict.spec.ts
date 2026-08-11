import { canUseStrictSchema } from "./openai-strict";

describe("canUseStrictSchema", () => {
  it("accepts a schema whose required list covers every property", () => {
    expect(
      canUseStrictSchema({
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      })
    ).toBe(true);
  });

  it("accepts a schema with no parameters at all", () => {
    expect(
      canUseStrictSchema({ type: "object", properties: {}, required: [] })
    ).toBe(true);
  });

  // The reported bug: a tool with an optional parameter made OpenAI answer
  // every request in the session with a 400 rather than running the tool once.
  it("rejects a schema with an optional parameter", () => {
    expect(
      canUseStrictSchema({
        type: "object",
        properties: {
          path: { type: "string" },
          startLine: { type: "number" },
          endLine: { type: "number" },
        },
        required: ["path"],
      })
    ).toBe(false);
  });

  it("rejects a missing required list, which cannot cover anything", () => {
    expect(
      canUseStrictSchema({
        type: "object",
        properties: { path: { type: "string" } },
      })
    ).toBe(false);
  });

  // Strict mode wants additionalProperties:false on nested objects too, which
  // getToolDefinitions() only sets at the top level. MCP servers send these
  // routinely.
  it("rejects nested objects, including inside an array", () => {
    expect(
      canUseStrictSchema({
        type: "object",
        properties: { filter: { type: "object", properties: {} } },
        required: ["filter"],
      })
    ).toBe(false);
    expect(
      canUseStrictSchema({
        type: "object",
        properties: {
          edits: { type: "array", items: { type: "object", properties: {} } },
        },
        required: ["edits"],
      })
    ).toBe(false);
  });

  it("accepts an array of scalars, which needs no inner contract", () => {
    expect(
      canUseStrictSchema({
        type: "object",
        properties: { options: { type: "array", items: { type: "string" } } },
        required: ["options"],
      })
    ).toBe(true);
  });

  it("says no to anything it does not recognise as a schema", () => {
    expect(canUseStrictSchema(undefined)).toBe(false);
    expect(canUseStrictSchema("object")).toBe(false);
  });
});
