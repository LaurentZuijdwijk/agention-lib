// @ts-nocheck
import { OllamaAgent } from "./OllamaAgent";

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
