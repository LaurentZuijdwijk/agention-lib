import { toolResultMaskingPlugin } from "./toolResultMaskingPlugin";
import { History } from "../History";
import { toolUse, toolResult, text } from "../types";

// Helper: add one complete tool call round-trip to history
function addToolCall(
  history: History,
  id: string,
  toolName: string,
  resultContent: string
) {
  history.addMessage("assistant", [toolUse(id, toolName, { q: "x" })]);
  history.addMessage("user", [toolResult(id, resultContent)]);
}

describe("toolResultMaskingPlugin", () => {
  describe("construction", () => {
    it("should throw if both exclude and include are provided", () => {
      expect(() =>
        toolResultMaskingPlugin({ exclude: ["a"], include: ["b"] })
      ).toThrow(/mutually exclusive/);
    });

    it("should warn when keepRecentResults is 0", () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
      toolResultMaskingPlugin({ keepRecentResults: 0 });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("keepRecentResults: 0"));
      spy.mockRestore();
    });

    it("should not warn for default options", () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
      toolResultMaskingPlugin();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("transform — basic masking", () => {
    it("should not mask when there are fewer results than keepRecentResults", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 2 });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_001", "search", "result one");

      const entries = history.getEntries();
      const resultBlock = entries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result");
      expect(resultBlock).toBeDefined();
      expect((resultBlock as { type: "tool_result"; content: string }).content).toBe("result one");
    });

    it("should mask older results and keep the most recent verbatim", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 1 });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_001", "search", "old result");
      addToolCall(history, "tu_002", "search", "recent result");

      const viewEntries = history.getEntries();
      const blocks = viewEntries.flatMap((e) => e.content).filter((b) => b.type === "tool_result") as Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }>;

      const maskedBlock = blocks.find((b) => b.tool_use_id === "tu_001");
      const recentBlock = blocks.find((b) => b.tool_use_id === "tu_002");

      expect(maskedBlock?.content).toBe("[MASKED - ref: tu_001]");
      expect(recentBlock?.content).toBe("recent result");
    });

    it("should mask all results when keepRecentResults is 0", () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      spy.mockRestore();

      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "result one");

      const viewEntries = history.getEntries();
      const block = viewEntries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result") as { type: "tool_result"; content: string };

      expect(block.content).toBe("[MASKED - ref: tu_001]");
    });

    it("should not mutate stored entries", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "original content");

      history.getEntries(); // apply transform

      // Raw stored entry must be unchanged
      const stored = history.entries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result") as { type: "tool_result"; content: string };
      expect(stored.content).toBe("original content");
    });
  });

  describe("transform — exclude mode", () => {
    it("should never mask excluded tool names", () => {
      const plugin = toolResultMaskingPlugin({
        keepRecentResults: 0,
        exclude: ["calculator"],
      });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_001", "calculator", "42");
      addToolCall(history, "tu_002", "search", "big result");

      const viewEntries = history.getEntries();
      const blocks = viewEntries.flatMap((e) => e.content).filter((b) => b.type === "tool_result") as Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }>;

      const calcBlock = blocks.find((b) => b.tool_use_id === "tu_001");
      const searchBlock = blocks.find((b) => b.tool_use_id === "tu_002");

      expect(calcBlock?.content).toBe("42"); // never masked
      expect(searchBlock?.content).toBe("[MASKED - ref: tu_002]");
    });

    it("excluded results do not consume keepRecentResults slots", () => {
      const plugin = toolResultMaskingPlugin({
        keepRecentResults: 1,
        exclude: ["calculator"],
      });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_001", "search", "old search result");
      addToolCall(history, "tu_002", "calculator", "excluded");
      addToolCall(history, "tu_003", "search", "recent search result");

      const viewEntries = history.getEntries();
      const blocks = viewEntries.flatMap((e) => e.content).filter((b) => b.type === "tool_result") as Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }>;

      expect(blocks.find((b) => b.tool_use_id === "tu_001")?.content).toBe("[MASKED - ref: tu_001]");
      expect(blocks.find((b) => b.tool_use_id === "tu_002")?.content).toBe("excluded");
      expect(blocks.find((b) => b.tool_use_id === "tu_003")?.content).toBe("recent search result");
    });
  });

  describe("transform — include mode", () => {
    it("should only mask tools in the include list", () => {
      const plugin = toolResultMaskingPlugin({
        keepRecentResults: 0,
        include: ["search"],
      });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_001", "search", "search result");
      addToolCall(history, "tu_002", "calculator", "42");

      const viewEntries = history.getEntries();
      const blocks = viewEntries.flatMap((e) => e.content).filter((b) => b.type === "tool_result") as Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }>;

      expect(blocks.find((b) => b.tool_use_id === "tu_001")?.content).toBe("[MASKED - ref: tu_001]");
      expect(blocks.find((b) => b.tool_use_id === "tu_002")?.content).toBe("42");
    });
  });

  describe("transform — minTokensToMask", () => {
    it("should not mask results below the token threshold", () => {
      const plugin = toolResultMaskingPlugin({
        keepRecentResults: 0,
        minTokensToMask: 1000, // very high threshold
      });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "tiny");

      const viewEntries = history.getEntries();
      const block = viewEntries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result") as { type: "tool_result"; content: string };
      expect(block.content).toBe("tiny"); // too small to mask
    });

    it("should mask results that meet the token threshold", () => {
      const plugin = toolResultMaskingPlugin({
        keepRecentResults: 0,
        minTokensToMask: 1, // very low threshold
      });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "x".repeat(100));

      const viewEntries = history.getEntries();
      const block = viewEntries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result") as { type: "tool_result"; content: string };
      expect(block.content).toBe("[MASKED - ref: tu_001]");
    });
  });

  describe("retrieveTool", () => {
    it("should throw if executed before registration", async () => {
      const plugin = toolResultMaskingPlugin();
      await expect(
        plugin.retrieveTool["executeFn"]({ tool_call_id: "tu_001" }, null)
      ).rejects.toThrow(/not been registered/);
    });

    it("should return the full content after registration", async () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "full content here");

      const result = await plugin.retrieveTool["executeFn"]({ tool_call_id: "tu_001" }, null);
      expect(result).toBe("full content here");
    });

    it("should return an error message for unknown IDs", async () => {
      const plugin = toolResultMaskingPlugin();
      const history = new History([], {}).use(plugin);

      const result = await plugin.retrieveTool["executeFn"]({ tool_call_id: "tu_unknown" }, null);
      expect(result).toContain("tu_unknown");
    });

    it("getToolResult() returns raw content even when masked in view", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "tu_001", "search", "secret content");

      // View is masked
      const viewBlocks = history.getEntries().flatMap((e) => e.content).filter((b) => b.type === "tool_result") as Array<{ content: string }>;
      expect(viewBlocks[0].content).toBe("[MASKED - ref: tu_001]");

      // Raw retrieval works
      expect(history.getToolResult("tu_001")).toBe("secret content");
    });
  });

  describe("mask reference format", () => {
    it("should use [MASKED - ref: <id>] format", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      const history = new History([], {}).use(plugin);
      addToolCall(history, "my_tool_id", "search", "content");

      const viewEntries = history.getEntries();
      const block = viewEntries
        .flatMap((e) => e.content)
        .find((b) => b.type === "tool_result") as { type: "tool_result"; content: string };
      expect(block.content).toBe("[MASKED - ref: my_tool_id]");
    });
  });

  describe("session anchor — no masking within current execute() loop", () => {
    it("should not mask tool results added after setSessionAnchor()", () => {
      // Simulate: prior session has 2 tool calls (would normally trigger masking),
      // then agent sets session anchor and makes 3 more calls in the current loop.
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 1 });
      const history = new History([], {}).use(plugin);

      // Prior session results
      addToolCall(history, "tu_old_1", "search", "old result 1");
      addToolCall(history, "tu_old_2", "search", "old result 2");

      // Agent sets session anchor at start of new execute()
      history.setSessionAnchor();

      // Current session: 3 tool calls within one execute() loop
      addToolCall(history, "tu_new_1", "search", "new result 1");
      addToolCall(history, "tu_new_2", "search", "new result 2");
      addToolCall(history, "tu_new_3", "search", "new result 3");

      const viewBlocks = history
        .getEntries()
        .flatMap((e) => e.content)
        .filter((b) => b.type === "tool_result") as Array<{ type: "tool_result"; content: string; tool_use_id: string }>;

      // tu_old_1 should be masked (old, beyond keepRecentResults=1 for pre-anchor entries)
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_old_1")?.content).toBe("[MASKED - ref: tu_old_1]");
      // tu_old_2 is the most recent pre-anchor result — kept verbatim
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_old_2")?.content).toBe("old result 2");
      // All current-session results must never be masked
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_new_1")?.content).toBe("new result 1");
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_new_2")?.content).toBe("new result 2");
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_new_3")?.content).toBe("new result 3");
    });

    it("should mask all pre-anchor results when keepRecentResults=0", () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 0 });
      spy.mockRestore();
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_old", "search", "old result");
      history.setSessionAnchor();
      addToolCall(history, "tu_new", "search", "new result");

      const viewBlocks = history
        .getEntries()
        .flatMap((e) => e.content)
        .filter((b) => b.type === "tool_result") as Array<{ type: "tool_result"; content: string; tool_use_id: string }>;

      expect(viewBlocks.find((b) => b.tool_use_id === "tu_old")?.content).toBe("[MASKED - ref: tu_old]");
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_new")?.content).toBe("new result");
    });

    it("should mask everything when no session anchor is set (default behaviour unchanged)", () => {
      const plugin = toolResultMaskingPlugin({ keepRecentResults: 1 });
      const history = new History([], {}).use(plugin);

      addToolCall(history, "tu_1", "search", "result 1");
      addToolCall(history, "tu_2", "search", "result 2");
      addToolCall(history, "tu_3", "search", "result 3");

      const viewBlocks = history
        .getEntries()
        .flatMap((e) => e.content)
        .filter((b) => b.type === "tool_result") as Array<{ type: "tool_result"; content: string; tool_use_id: string }>;

      expect(viewBlocks.find((b) => b.tool_use_id === "tu_1")?.content).toBe("[MASKED - ref: tu_1]");
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_2")?.content).toBe("[MASKED - ref: tu_2]");
      expect(viewBlocks.find((b) => b.tool_use_id === "tu_3")?.content).toBe("result 3");
    });
  });
});
