// @ts-nocheck
import { OllamaAgent } from "./OllamaAgent";
import { AbortError, ExecutionError } from "../errors/AgentError";

/** Minimal tool prompt, enough for the agent's tool-definition builder. */
const toolPrompt = {
  name: "test_tool",
  description: "A test tool",
  input_schema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
};

describe("OllamaAgent", () => {
  let agent: OllamaAgent;

  beforeEach(() => {
    agent = new OllamaAgent({
      id: "1",
      name: "TestAgent",
      description: "Test Description",
      model: "llama3.2",
    });
  });

  describe("listModels", () => {
    it("normalizes the models the server reports", async () => {
      const models = [
        {
          name: "llama3.2:latest",
          model: "llama3.2:latest",
          modified_at: "2025-11-02T10:15:00.000Z",
          size: 2019393189,
          digest: "abc123",
          details: { family: "llama", parameter_size: "3.2B" },
        },
      ];
      // The client is created lazily by an optional dynamic import; seeding it
      // here keeps the test free of the real `ollama` package.
      agent["_client"] = { list: jest.fn().mockResolvedValue({ models }) };

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          id: "llama3.2:latest",
          displayName: "llama3.2:latest",
          // Ollama's modified_at is when the model was last pulled locally
          created: new Date("2025-11-02T10:15:00.000Z"),
          raw: models[0],
        },
      ]);
    });

    it("wraps failures in an ExecutionError", async () => {
      agent["_client"] = {
        list: jest.fn().mockRejectedValue(new Error("connection refused")),
      };

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list Ollama models: connection refused/
      );
    });
  });

  describe("cancellation", () => {
    const textResponse = {
      message: { role: "assistant", content: "Hello" },
      done: true,
      prompt_eval_count: 5,
      eval_count: 5,
    };

    const toolCallResponse = {
      message: {
        role: "assistant",
        content: "",
        tool_calls: [
          { function: { name: "test_tool", arguments: { param: "value" } } },
        ],
      },
      done: true,
      prompt_eval_count: 5,
      eval_count: 5,
    };

    /**
     * Stand in for the `ollama` package, which is an optional peer dependency
     * and is not installed here. The agent builds a client per run, so the
     * class records the config it was constructed with — that config's `fetch`
     * is where the signal ends up.
     */
    const stubOllamaClass = (chat: jest.Mock) => {
      const configs: any[] = [];
      class StubOllama {
        chat = chat;
        list = jest.fn();
        constructor(config: any) {
          configs.push(config);
        }
      }
      return { StubOllama, configs };
    };

    it("gives the client a fetch that attaches the signal", async () => {
      const controller = new AbortController();
      const chat = jest.fn().mockResolvedValue(textResponse);
      const { StubOllama, configs } = stubOllamaClass(chat);
      agent["_clientClass"] = StubOllama as any;

      await agent.execute("Hi", { signal: controller.signal });

      expect(configs).toHaveLength(1);
      // The ollama package takes no per-request options, so the signal rides
      // in on a wrapped fetch instead.
      const wrappedFetch = configs[0].fetch;
      expect(typeof wrappedFetch).toBe("function");

      const globalFetch = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}"));
      await wrappedFetch("http://localhost:11434/api/chat", { method: "POST" });
      expect(globalFetch.mock.calls[0][1].signal).toBe(controller.signal);
      globalFetch.mockRestore();
    });

    it("reuses the shared client when no signal is given", async () => {
      const chat = jest.fn().mockResolvedValue(textResponse);
      const { StubOllama, configs } = stubOllamaClass(chat);
      agent["_clientClass"] = StubOllama as any;

      await agent.execute("Hi");
      await agent.execute("Hi again");

      expect(configs).toHaveLength(1);
      expect(configs[0].fetch).toBeUndefined();
    });

    it("throws an AbortError when fetch reports the request was aborted", async () => {
      const controller = new AbortController();
      const chat = jest.fn().mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("This operation was aborted"), {
          name: "AbortError",
        });
      });
      const { StubOllama } = stubOllamaClass(chat);
      agent["_clientClass"] = StubOllama as any;
      agent.on("error", () => {});

      const error = await agent
        .execute("Hi", { signal: controller.signal })
        .catch((e) => e);

      expect(error).toBeInstanceOf(AbortError);
      expect(error.message).toBe("Execution of agent TestAgent was aborted");
    });

    it("does not run tools, or write an unanswered call, when aborted mid-turn", async () => {
      const controller = new AbortController();
      const chat = jest.fn().mockImplementation(async () => {
        controller.abort();
        return toolCallResponse;
      });
      const { StubOllama } = stubOllamaClass(chat);
      agent["_clientClass"] = StubOllama as any;
      agent.on("error", () => {});

      const toolExecute = jest.fn().mockResolvedValue("never called");
      agent["tools"].set("test_tool", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      await expect(
        agent.execute("Hi", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(toolExecute).not.toHaveBeenCalled();
      expect(chat).toHaveBeenCalledTimes(1);
      const entries = agent.getHistoryEntries();
      expect(
        entries.some((entry) =>
          entry.content.some((block: any) => block.type === "tool_use")
        )
      ).toBe(false);
    });

    it("passes the signal on to the tools it runs", async () => {
      const controller = new AbortController();
      const chat = jest
        .fn()
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(textResponse);
      const { StubOllama } = stubOllamaClass(chat);
      agent["_clientClass"] = StubOllama as any;

      const toolExecute = jest.fn().mockResolvedValue("sunny");
      agent["tools"].set("test_tool", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      await agent.execute("Hi", { signal: controller.signal });

      expect(toolExecute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { param: "value" },
        expect.any(String),
        "llama3.2",
        "ollama",
        { signal: controller.signal }
      );
    });
  });

  describe("parseUsage", () => {
    it("converts Ollama's nanosecond durations to milliseconds", () => {
      const usage = agent["parseUsage"]({
        prompt_eval_count: 26,
        eval_count: 298,
        // Ollama reports durations in nanoseconds
        total_duration: 5_043_500_000,
        load_duration: 500_000_000,
        prompt_eval_duration: 325_000_000,
        eval_duration: 4_200_000_000,
      });

      expect(usage).toEqual({
        input_tokens: 26,
        output_tokens: 298,
        total_tokens: 324,
        // Model load counts as time-to-first-token: nothing is generated yet
        timeToFirstTokenMs: 825,
        generationMs: 4200,
        totalMs: 5043.5,
      });
    });

    it("treats a missing load duration as zero", () => {
      const usage = agent["parseUsage"]({
        prompt_eval_count: 10,
        eval_count: 20,
        prompt_eval_duration: 200_000_000,
      });

      expect(usage.timeToFirstTokenMs).toBe(200);
    });

    it("leaves timings undefined when the server reports none", () => {
      const usage = agent["parseUsage"]({
        prompt_eval_count: 10,
        eval_count: 20,
      });

      expect(usage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        timeToFirstTokenMs: undefined,
        generationMs: undefined,
        totalMs: undefined,
      });
    });
  });

  describe("token usage accounting", () => {
    it("derives throughput from the server's own timings", async () => {
      agent["handleResponse"] = OllamaAgent.prototype["handleResponse"];

      agent["accumulateUsage"](
        agent["parseUsage"]({
          prompt_eval_count: 100,
          eval_count: 200,
          total_duration: 3_000_000_000,
          prompt_eval_duration: 1_000_000_000,
          eval_duration: 2_000_000_000,
        })
      );

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        timeToFirstTokenMs: 1000,
        generationMs: 2000,
        totalMs: 3000,
        inputTokensPerSecond: 100,
        outputTokensPerSecond: 100,
      });
    });
  });
});
