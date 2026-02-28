import { compressionPlugin } from "./compressionPlugin";
import { History, type ReducibleEntry } from "../History";
import { text, toolUse, toolResult } from "../types";

// Minimal mock for BaseAgent
function makeAgent(response: string) {
  return {
    execute: jest.fn().mockResolvedValue(response),
  } as unknown as import("../../agents/BaseAgent").BaseAgent;
}

describe("compressionPlugin", () => {
  describe("reduce — maxTokens strategy", () => {
    it("should compress entries that push history over the token budget", async () => {
      const agent = makeAgent("prior topic discussed");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "turn one with some text");
      history.addText("assistant", "response one with some text");
      history.addText("user", "turn two with some text");
      history.addText("assistant", "response two with some text");

      const before = history.length;
      await history.reduce({ maxTokens: 10 }); // very tight budget

      expect(history.length).toBeLessThan(before);
      const summaryEntry = history.entries.find((e) =>
        e.content.some(
          (b) =>
            b.type === "text" &&
            b.text.startsWith("[Earlier conversation summary:")
        )
      );
      expect(summaryEntry).toBeDefined();
      expect(summaryEntry!.role).toBe("user");
    });

    it("should include summary content prefix", async () => {
      const agent = makeAgent("things were discussed");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "first turn");
      history.addText("assistant", "first response");

      await history.reduce({ maxTokens: 5 });

      const summaryText = history.entries
        .flatMap((e) => e.content)
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .find((t) => t.includes("Earlier conversation summary"));

      expect(summaryText).toContain("[Earlier conversation summary:");
    });
  });

  describe("reduce — maxEntries strategy", () => {
    it("should compress oldest entries beyond maxEntries", async () => {
      const agent = makeAgent("summary of first two turns");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "turn one");
      history.addText("assistant", "response one");
      history.addText("user", "turn two");
      history.addText("assistant", "response two");

      await history.reduce({ maxEntries: 2 });

      // 1 summary + 2 recent = 3 entries max
      expect(history.length).toBeLessThanOrEqual(3);
    });

    it("should be a no-op when entries are within maxEntries", async () => {
      const agent = makeAgent("unused");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "only entry");

      await history.reduce({ maxEntries: 5 });

      expect(history.length).toBe(1);
      expect(agent.execute).not.toHaveBeenCalled();
    });
  });

  describe("reduce — olderThan strategy", () => {
    it("should compress entries older than the given date", async () => {
      const agent = makeAgent("old stuff summarized");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "old turn");
      history.addText("assistant", "old response");
      // brief pause so timestamps differ
      await new Promise((r) => setTimeout(r, 5));
      const cutoff = new Date();
      await new Promise((r) => setTimeout(r, 5));
      history.addText("user", "recent turn");

      await history.reduce({ olderThan: cutoff });

      const recent = history.entries.find(
        (e) =>
          e.content.some(
            (b) => b.type === "text" && (b as { type: "text"; text: string }).text === "recent turn"
          )
      );
      expect(recent).toBeDefined();
      expect(agent.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("rolling summary (isSummary entries)", () => {
    it("should include an existing summary in the prompt and produce a merged summary", async () => {
      const agent = makeAgent("merged summary");
      const plugin = compressionPlugin(agent);

      // Manually create a history with an existing summary entry
      const existingSummaryEntry: ReducibleEntry = {
        role: "user",
        content: [text("[Earlier conversation summary: old summary content]")],
        __metadata: {
          date: new Date(Date.now() - 10000).toISOString(),
          contentLength: 40,
          estimatedTokens: 10,
          isSummary: true,
          coversRange: {
            from: new Date(Date.now() - 20000).toISOString(),
            to: new Date(Date.now() - 10000).toISOString(),
          },
        },
      };

      const history = new History([], {});
      // Push the summary entry directly via addEntry pathway using a typed cast
      // (simulate a previously compressed history)
      history.use(plugin);

      // Use a fresh history that starts with the summary entry
      const freshHistory = new History([], {});
      freshHistory["_entries"] = [existingSummaryEntry]; // access protected for test
      freshHistory.use(plugin);
      freshHistory.addText("user", "new turn to compress");

      await freshHistory.reduce({ maxTokens: 5 });

      // Agent should have been called with prior context
      const prompt = (agent.execute as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).toContain("Prior context");
      expect(prompt).toContain("old summary content");
    });

    it("should set isSummary: true on the resulting entry", async () => {
      const agent = makeAgent("the summary");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addText("user", "first");
      history.addText("assistant", "second");

      await history.reduce({ maxTokens: 5 });

      // Access internal entries for inspection
      const internalEntries = history["_entries"] as ReducibleEntry[];
      const summary = internalEntries.find((e) => e.__metadata.isSummary);
      expect(summary).toBeDefined();
      expect(summary!.__metadata.coversRange).toBeDefined();
    });
  });

  describe("system message preservation", () => {
    it("should always preserve the system message", async () => {
      const agent = makeAgent("summary without system");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addSystem("You are a helpful assistant");
      history.addText("user", "question one");
      history.addText("assistant", "answer one");

      await history.reduce({ maxTokens: 5 });

      const hasSystem = history.entries.some((e) => e.role === "system");
      expect(hasSystem).toBe(true);
    });
  });

  describe("autoReduceWhen", () => {
    it("should auto-trigger reduce when maxTokens is exceeded after addText", async () => {
      const agent = makeAgent("auto summary");
      const plugin = compressionPlugin(agent, { autoReduceWhen: { maxTokens: 5 } });
      const history = new History([], {}).use(plugin);

      history.addText("user", "first turn");
      history.addText("assistant", "first response");
      history.addText("user", "second turn that pushes over budget");

      // Wait for the async afterAdd hook to fire and reduce to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(agent.execute).toHaveBeenCalled();
      // History should now have a summary entry
      const hasSummary = history.entries.some((e) =>
        e.content.some(
          (b) =>
            b.type === "text" &&
            (b as { type: "text"; text: string }).text.startsWith(
              "[Earlier conversation summary:"
            )
        )
      );
      expect(hasSummary).toBe(true);
    });

    it("should not auto-trigger when under budget", async () => {
      const agent = makeAgent("unused");
      const plugin = compressionPlugin(agent, { autoReduceWhen: { maxTokens: 99999 } });
      const history = new History([], {}).use(plugin);

      history.addText("user", "short");
      await new Promise((r) => setTimeout(r, 20));

      expect(agent.execute).not.toHaveBeenCalled();
    });

    it("should auto-trigger based on maxEntries when exceeded", async () => {
      const agent = makeAgent("entry summary");
      const plugin = compressionPlugin(agent, { autoReduceWhen: { maxEntries: 2 } });
      const history = new History([], {}).use(plugin);

      history.addText("user", "one");
      history.addText("assistant", "two");
      history.addText("user", "three"); // triggers afterAdd → reduce

      await new Promise((r) => setTimeout(r, 50));

      expect(agent.execute).toHaveBeenCalled();
    });
  });

  describe("tool call entries in compression", () => {
    it("should include tool call text in the compression prompt", async () => {
      const agent = makeAgent("tool calls summarized");
      const plugin = compressionPlugin(agent);
      const history = new History([], {}).use(plugin);

      history.addMessage("assistant", [
        toolUse("tu_001", "web_search", { query: "test" }),
      ]);
      history.addMessage("user", [toolResult("tu_001", "result content")]);

      await history.reduce({ maxTokens: 5 });

      expect(agent.execute).toHaveBeenCalledTimes(1);
      // After compression entries should be fewer
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });
});
