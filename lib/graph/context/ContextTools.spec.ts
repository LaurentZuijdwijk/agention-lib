import { ContextStore } from "./ContextStore";
import {
  createContextGetTool,
  createContextSetTool,
  createContextListTool,
  createContextDeleteTool,
} from "./ContextTools";

describe("Context Tools", () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore();
  });

  describe("createContextGetTool", () => {
    it("should retrieve existing values", async () => {
      store.set("research_findings", { topic: "AI", summary: "test" });
      const tool = createContextGetTool(store);

      const result = await tool["executeFn"]({ key: "research_findings" }, null);
      const parsed = JSON.parse(result);

      expect(parsed.key).toBe("research_findings");
      expect(parsed.value).toEqual({ topic: "AI", summary: "test" });
    });

    it("should return error for non-existent keys", async () => {
      const tool = createContextGetTool(store);

      const result = await tool["executeFn"]({ key: "nonexistent" }, null);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("not found");
      expect(parsed.availableKeys).toEqual([]);
    });

    it("should include available keys in error response", async () => {
      store.set("key1", "value1");
      store.set("key2", "value2");
      const tool = createContextGetTool(store);

      const result = await tool["executeFn"]({ key: "missing" }, null);
      const parsed = JSON.parse(result);

      expect(parsed.availableKeys.sort()).toEqual(["key1", "key2"]);
    });

    it("should have correct tool metadata", () => {
      const tool = createContextGetTool(store);
      expect(tool.name).toBe("context_get");
      expect(tool.getPrompt().description).toContain("Get a value");
    });
  });

  describe("createContextSetTool", () => {
    it("should store string values", async () => {
      const tool = createContextSetTool(store);

      const result = await tool["executeFn"](
        { key: "greeting", value: "hello" },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.key).toBe("greeting");
      expect(store.get("greeting")).toBe("hello");
    });

    it("should parse and store JSON values", async () => {
      const tool = createContextSetTool(store);

      const result = await tool["executeFn"](
        { key: "data", value: '{"count": 42, "items": [1,2,3]}' },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(store.get("data")).toEqual({ count: 42, items: [1, 2, 3] });
    });

    it("should store invalid JSON as string", async () => {
      const tool = createContextSetTool(store);

      await tool["executeFn"](
        { key: "text", value: "not valid json" },
        null
      );

      expect(store.get("text")).toBe("not valid json");
    });

    it("should have correct tool metadata", () => {
      const tool = createContextSetTool(store);
      expect(tool.name).toBe("context_set");
      expect(tool.getPrompt().description).toContain("Store a value");
    });
  });

  describe("createContextListTool", () => {
    it("should list all keys", async () => {
      store.set("key1", "value1");
      store.set("key2", "value2");
      store.set("key3", "value3");
      const tool = createContextListTool(store);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.keys.sort()).toEqual(["key1", "key2", "key3"]);
    });

    it("should return empty array for empty store", async () => {
      const tool = createContextListTool(store);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.keys).toEqual([]);
    });

    it("should have correct tool metadata", () => {
      const tool = createContextListTool(store);
      expect(tool.name).toBe("list_context_keys");
    });
  });

  describe("createContextDeleteTool", () => {
    it("should delete existing keys", async () => {
      store.set("key", "value");
      const tool = createContextDeleteTool(store);

      const result = await tool["executeFn"]({ key: "key" }, null);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.deleted).toBe(true);
      expect(store.has("key")).toBe(false);
    });

    it("should return deleted=false for non-existent keys", async () => {
      const tool = createContextDeleteTool(store);

      const result = await tool["executeFn"]({ key: "nonexistent" }, null);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.deleted).toBe(false);
    });

    it("should have correct tool metadata", () => {
      const tool = createContextDeleteTool(store);
      expect(tool.name).toBe("context_delete");
    });
  });
});
