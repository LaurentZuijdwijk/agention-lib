// Mock tokenx before any imports so the dynamic import in History.ts resolves
// to this mock (same pattern as TokenChunker.spec.ts).
jest.mock("tokenx", () => ({
  estimateTokenCount: jest.fn((t: string) => Math.ceil(t.length / 4)),
}));

import {
  History,
  text,
  textMessage,
  resetTokenxCache,
  imageUrl,
  imageBase64,
  type HistoryPlugin,
  type ReducibleEntry,
} from "./History";
import { toolUse, toolResult } from "./types";

describe("History module", () => {
  let history: History;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTokenxCache();
    history = new History([], {});
  });

  it("should add text entries correctly", () => {
    history.addText("assistant", "test message");
    expect(history.entries).toEqual([
      { role: "assistant", content: [{ type: "text", text: "test message" }] },
    ]);
  });

  it("should add entry with content blocks", () => {
    history.addEntry({
      role: "user",
      content: [text("hello"), text("world")],
    });
    expect(history.entries).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
    ]);
  });

  it("should handle multiple entries", () => {
    history.addText("user", "user message");
    history.addText("assistant", "assistant response");
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "user message" }],
    });
    expect(history.entries[1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "assistant response" }],
    });
  });

  it("should clear all entries", () => {
    history.addText("user", "test message");
    history.clear();
    expect(history.entries).toHaveLength(0);
  });

  it("should serialize to JSON and deserialize from JSON", () => {
    history.addText("user", "user message");
    history.addText("assistant", "assistant response");

    const json = history.toJSON();
    const deserializedHistory = History.fromJSON(json);

    expect(deserializedHistory.entries).toEqual(history.entries);
  });

  it("should return the size of the history", () => {
    history.clear();
    history.addText("user", "test message");
    history.addEntry({
      role: "user",
      content: [text("a"), text("b")],
    });

    expect(history.size).toBeGreaterThan(0);
  });

  it("should add system messages", () => {
    history.addSystem("You are a helpful assistant");
    expect(history.entries[0].role).toBe("system");
    expect(history.getSystemMessage()).toBe("You are a helpful assistant");
  });

  it("should get messages without system", () => {
    history.addSystem("System prompt");
    history.addText("user", "Hello");
    history.addText("assistant", "Hi there");

    const messages = history.getMessagesWithoutSystem();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
  });

  it("should create entries using textMessage helper", () => {
    const entry = textMessage("user", "Hello");
    expect(entry).toEqual({
      role: "user",
      content: [{ type: "text", text: "Hello" }],
    });
  });

  it("should clone history", () => {
    history.addText("user", "test");
    const cloned = history.clone();
    expect(cloned.entries).toEqual(history.entries);

    // Ensure they are independent
    cloned.addText("assistant", "response");
    expect(cloned.length).toBe(2);
    expect(history.length).toBe(1);
  });

  describe("token estimation", () => {
    it("should expose totalEstimatedTokens", () => {
      history.addText("user", "hello"); // "hello" → 5 chars → ~2 tokens
      expect(history.totalEstimatedTokens).toBeGreaterThan(0);
    });

    it("should estimate tokens via tokenx estimateTokenCount", () => {
      // The mock uses Math.ceil(serialized.length / 4) where serialized = JSON.stringify(content)
      const content = [{ type: "text", text: "hello" }];
      const expectedTokens = Math.ceil(JSON.stringify(content).length / 4);
      history.addText("user", "hello");
      expect(history.totalEstimatedTokens).toBe(expectedTokens);
    });

    it("should accumulate token estimates across entries", () => {
      history.addText("user", "hello");
      const afterFirst = history.totalEstimatedTokens;
      history.addText("assistant", "world");
      expect(history.totalEstimatedTokens).toBeGreaterThan(afterFirst);
    });
  });

  describe("maxTokens trimming", () => {
    it("should trim oldest entries when maxTokens is exceeded", () => {
      // Each entry is roughly ~10 tokens; set budget to allow ~2 entries
      const content = [{ type: "text", text: "hello world test" }];
      const tokensPerEntry = Math.ceil(JSON.stringify(content).length / 4);
      const budget = tokensPerEntry * 2;

      const h = new History([], { maxTokens: budget });
      h.addText("user", "hello world test");
      h.addText("assistant", "hello world test");
      h.addText("user", "hello world test"); // should cause first to be dropped

      expect(h.length).toBe(2);
      expect(h.entries[0].role).toBe("assistant");
    });

    it("should preserve the system message when trimming", () => {
      const content = [{ type: "text", text: "hello world test" }];
      const tokensPerEntry = Math.ceil(JSON.stringify(content).length / 4);
      const budget = tokensPerEntry * 2;

      const h = new History([], { maxTokens: budget });
      h.addSystem("You are a helpful assistant");
      h.addText("user", "hello world test");
      h.addText("assistant", "hello world test"); // causes trimming of oldest non-system

      // System message must survive
      expect(h.entries.some((e) => e.role === "system")).toBe(true);
      expect(h.getSystemMessage()).toBe("You are a helpful assistant");
    });

    it("should not trim below 1 entry even if single entry exceeds budget", () => {
      const h = new History([], { maxTokens: 1 });
      h.addText("user", "a very long message that definitely exceeds one token budget");
      expect(h.length).toBe(1);
    });

    it("should respect maxLength and maxTokens independently", () => {
      const h = new History([], { maxLength: 10, maxTokens: 5 });
      // Add enough entries to trigger token trimming (budget is 5 tokens, very tight)
      h.addText("user", "hello world");
      h.addText("assistant", "hello world");
      // totalEstimatedTokens will exceed 5, so only 1 entry survives
      expect(h.length).toBeLessThan(3);
    });
  });

  describe("plugin system", () => {
    describe("use()", () => {
      it("should call onRegistered immediately with the history instance", () => {
        const onRegistered = jest.fn();
        const plugin: HistoryPlugin = { onRegistered };
        history.use(plugin);
        expect(onRegistered).toHaveBeenCalledTimes(1);
        expect(onRegistered).toHaveBeenCalledWith(history);
      });

      it("should return this for chaining", () => {
        const plugin: HistoryPlugin = {};
        const result = history.use(plugin);
        expect(result).toBe(history);
      });

      it("should support chained registration", () => {
        const calls: string[] = [];
        history
          .use({ onRegistered: () => calls.push("a") })
          .use({ onRegistered: () => calls.push("b") });
        expect(calls).toEqual(["a", "b"]);
      });
    });

    describe("getEntries()", () => {
      it("should return the same entries as entries getter when no transform plugins", () => {
        history.addText("user", "hello");
        history.addText("assistant", "world");
        expect(history.getEntries()).toEqual(history.entries);
      });

      it("should apply a single transform plugin", () => {
        history.addText("user", "hello");
        const plugin: HistoryPlugin = {
          transform: (entries) =>
            entries.map((e) => ({
              ...e,
              content: [text("TRANSFORMED")],
            })),
        };
        history.use(plugin);
        expect(history.getEntries()[0].content[0]).toEqual({
          type: "text",
          text: "TRANSFORMED",
        });
        // Raw entries unchanged
        expect(history.entries[0].content[0]).toEqual({
          type: "text",
          text: "hello",
        });
      });

      it("should apply transform plugins in registration order", () => {
        history.addText("user", "a");
        const order: string[] = [];
        history
          .use({ transform: (e) => { order.push("first"); return e; } })
          .use({ transform: (e) => { order.push("second"); return e; } });
        history.getEntries();
        expect(order).toEqual(["first", "second"]);
      });
    });

    describe("getToolResult()", () => {
      it("should return the full content of a tool result by ID", () => {
        history.addMessage("assistant", [toolUse("tu_001", "web_search", { query: "test" })]);
        history.addMessage("user", [toolResult("tu_001", "full result content")]);
        expect(history.getToolResult("tu_001")).toBe("full result content");
      });

      it("should return undefined for an unknown ID", () => {
        history.addMessage("user", [toolResult("tu_999", "some result")]);
        expect(history.getToolResult("tu_unknown")).toBeUndefined();
      });

      it("should always return raw content regardless of transform plugins", () => {
        history.addMessage("assistant", [toolUse("tu_001", "search", { q: "x" })]);
        history.addMessage("user", [toolResult("tu_001", "original content")]);
        // Plugin that masks the content in the view
        history.use({
          transform: (entries) =>
            entries.map((e) => ({
              ...e,
              content: e.content.map((b) =>
                b.type === "tool_result" ? { ...b, content: "[MASKED]" } : b
              ),
            })),
        });
        expect(history.getToolResult("tu_001")).toBe("original content");
      });
    });

    describe("reduce()", () => {
      it("should be a no-op when no plugin has a reduce hook", async () => {
        history.addText("user", "hello");
        history.use({ transform: (e) => e }); // transform-only plugin
        await history.reduce({ maxTokens: 1 });
        expect(history.length).toBe(1);
        expect(history.entries[0].content[0]).toEqual({ type: "text", text: "hello" });
      });

      it("should call the plugin reduce hook with current entries", async () => {
        history.addText("user", "hello");
        const reduceFn = jest.fn(async (entries: ReducibleEntry[]) => entries);
        history.use({ reduce: reduceFn });
        await history.reduce({ maxTokens: 100 });
        expect(reduceFn).toHaveBeenCalledTimes(1);
        expect(reduceFn.mock.calls[0][0]).toHaveLength(1);
      });

      it("should replace entries with plugin reduce result", async () => {
        history.addText("user", "hello");
        history.use({
          reduce: async () => [
            {
              role: "user" as const,
              content: [text("compressed")],
              __metadata: {
                date: new Date().toISOString(),
                contentLength: 10,
                estimatedTokens: 3,
              },
            },
          ],
        });
        await history.reduce({});
        expect(history.length).toBe(1);
        expect(history.entries[0].content[0]).toEqual({ type: "text", text: "compressed" });
      });

      it("should pipe entries through multiple reduce plugins in registration order", async () => {
        history.addText("user", "original");
        history.use({
          reduce: async (entries) =>
            entries.map((e) => ({ ...e, content: [text("step1")] })),
        });
        history.use({
          reduce: async (entries) =>
            entries.map((e) => ({ ...e, content: [text("step2")] })),
        });
        await history.reduce({});
        expect(history.entries[0].content[0]).toEqual({ type: "text", text: "step2" });
      });

      it("should be re-entrant safe (concurrent reduce calls are no-ops)", async () => {
        history.addText("user", "hello");
        let resolveFirst!: () => void;
        const firstStarted = new Promise<void>((res) => { resolveFirst = res; });
        const reduceFn = jest.fn(async (entries: ReducibleEntry[]) => {
          resolveFirst();
          await new Promise<void>((r) => setTimeout(r, 50));
          return entries;
        });
        history.use({ reduce: reduceFn });

        const p1 = history.reduce({});
        await firstStarted;
        await history.reduce({}); // should return immediately
        await p1;
        expect(reduceFn).toHaveBeenCalledTimes(1);
      });
    });

    describe("afterAdd hook", () => {
      it("should fire afterAdd asynchronously after addEntry", async () => {
        // Async functions run synchronously up to their first `await`.
        // We add a yield point so the hook body runs after addEntry() returns.
        const calls: string[] = [];
        let resolveHook!: () => void;
        const hookDone = new Promise<void>((r) => { resolveHook = r; });
        history.use({
          afterAdd: async () => {
            await Promise.resolve(); // yield so addEntry() returns first
            calls.push("hook");
            resolveHook();
          },
        });
        history.addText("user", "hello");
        calls.push("after-addEntry");
        await hookDone;
        expect(calls).toEqual(["after-addEntry", "hook"]);
      });

      it("should route afterAdd errors to onPluginError callback", async () => {
        const onPluginError = jest.fn();
        const h = new History([], { onPluginError });
        let resolveError!: () => void;
        const errorSeen = new Promise<void>((r) => { resolveError = r; });
        h.use({
          afterAdd: async () => {
            resolveError();
            throw new Error("plugin boom");
          },
        });
        h.addText("user", "trigger");
        await errorSeen;
        await new Promise<void>((r) => setTimeout(r, 10));
        expect(onPluginError).toHaveBeenCalledTimes(1);
        expect(onPluginError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(onPluginError.mock.calls[0][2]).toBe("afterAdd");
      });

      it("should emit pluginError event when no onPluginError is configured", async () => {
        const errorHandler = jest.fn();
        history.on("pluginError", errorHandler);
        let resolve!: () => void;
        const done = new Promise<void>((r) => { resolve = r; });
        history.use({
          afterAdd: async () => {
            resolve();
            throw new Error("event boom");
          },
        });
        history.addText("user", "trigger");
        await done;
        await new Promise<void>((r) => setTimeout(r, 10));
        expect(errorHandler).toHaveBeenCalledTimes(1);
      });

      it("should skip afterAdd hooks during reduce() to prevent recursion", async () => {
        const afterAddCalls: string[] = [];
        let resolveReduce!: () => void;
        const reduceDone = new Promise<void>((r) => { resolveReduce = r; });
        history.use({
          afterAdd: async () => {
            afterAddCalls.push("afterAdd");
          },
          reduce: async (entries) => {
            // Adding to history during reduce should NOT trigger afterAdd again
            history.addText("system", "summary");
            resolveReduce();
            return entries;
          },
        });
        history.addText("user", "trigger"); // this fires afterAdd normally
        await new Promise<void>((r) => setTimeout(r, 10));
        afterAddCalls.length = 0; // reset

        await history.reduce({});
        await reduceDone;
        expect(afterAddCalls).toEqual([]); // afterAdd not fired during reduce
      });
    });
  });

  describe("image token estimation", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      resetTokenxCache();
      history = new History([], {});
    });

    it("estimates image_url blocks as 1000 tokens each", () => {
      history.addMessage("user", [imageUrl("https://example.com/photo.jpg")]);
      expect(history.totalEstimatedTokens).toBe(1000);
    });

    it("estimates image_base64 blocks as 1000 tokens each", () => {
      history.addMessage("user", [imageBase64("abc123", "image/png")]);
      expect(history.totalEstimatedTokens).toBe(1000);
    });

    it("sums text and image token estimates correctly", () => {
      const textBlock = text("hello");
      const imageBlock = imageUrl("https://example.com/photo.jpg");
      history.addMessage("user", [textBlock, imageBlock]);

      // text block: JSON.stringify(textBlock) → ~chars/4 tokens; image: 1000 flat
      const textTokens = Math.ceil(JSON.stringify(textBlock).length / 4);
      expect(history.totalEstimatedTokens).toBe(textTokens + 1000);
    });

    it("accumulates token estimates across multiple image entries", () => {
      history.addMessage("user", [imageUrl("https://example.com/a.jpg")]);
      history.addMessage("user", [imageUrl("https://example.com/b.jpg")]);
      expect(history.totalEstimatedTokens).toBe(2000);
    });
  });
});
