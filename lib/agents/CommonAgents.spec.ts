// @ts-nocheck
import { ClaudeAgent } from "../agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../agents/openai/OpenAiAgent";
import { AgentEvent } from "./AgentEvent";
import { BaseAgent } from "./BaseAgent";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

jest.mock("@anthropic-ai/sdk");
jest.mock("openai");
const mockAnthropicResponse = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "Hello" }],
  usage: {
    input_tokens: 711,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 88,
  },
};
let mockAnthropicClient: jest.Mocked<Anthropic>;
mockAnthropicClient = {
  messages: {
    create: jest.fn().mockResolvedValue(mockAnthropicResponse as any),
  },
} as any;
(Anthropic as jest.Mock).mockImplementation(() => mockAnthropicClient);

const mockOpenAIResponse = {
  output: [
    {
      type: "message",
      status: "completed",
      content: [
        {
          type: "output_text",
          text: "Under the soft glow of the moon, Luna the unicorn danced through fields of twinkling stardust, leaving trails of dreams for every child asleep.",
        },
      ],
    },
  ],
  output_text:
    "Under the soft glow of the moon, Luna the unicorn danced through fields of twinkling stardust, leaving trails of dreams for every child asleep.",
  usage: {
    prompt_tokens: 3406,
    completion_tokens: 347,
    total_tokens: 3753,
    prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 },
    completion_tokens_details: {
      reasoning_tokens: 0,
      audio_tokens: 0,
      accepted_prediction_tokens: 0,
      rejected_prediction_tokens: 0,
    },
  },
};
let mockOpenAIClient: jest.Mocked<OpenAI>;
mockOpenAIClient = {
  responses: {
    create: jest.fn().mockResolvedValue(mockOpenAIResponse as any),
  },
} as any;
(OpenAI as jest.Mock).mockImplementation(() => mockOpenAIClient);

describe("common functionality for Agents", () => {
  const agents: [BaseAgent<any, any>, string][] = [];
  const config = {
    apiKey: "abc",
    id: "1",
    name: "abcd",
    description: "hello",
  };

  // Instantiate agents for testing
  agents.push([new ClaudeAgent(config), "ClaudeAgent"]);
  agents.push([new OpenAiAgent(config), "OpenAiAgent"]);

  // Event emission tests
  describe.each(agents)("%s event emission", (agent, agentName) => {
    it(`should fire BEFORE_EXECUTE event ${agentName}`, (done) => {
      const eventSpy = jest.fn();
      agent.once(AgentEvent.BEFORE_EXECUTE, (input) => {
        expect(input).toBeDefined();
        expect(input).toEqual("testInput");
        eventSpy();
        done();
      });
      agent.execute("testInput");
      expect(eventSpy).toHaveBeenCalled();
    });

    it("should fire AFTER_EXECUTE event", async () => {
      const eventSpy = jest.fn();
      agent.once(AgentEvent.AFTER_EXECUTE, (event) => {
        expect(event).toBeDefined();
        eventSpy();
      });
      await agent.execute("testInput");
      expect(eventSpy).toHaveBeenCalled();
    });

    it("should fire DONE event", async () => {
      const eventSpy = jest.fn();
      agent.once(AgentEvent.DONE, (event) => {
        expect(event).toBeDefined();
        eventSpy();
      });
      await agent.execute("testInput");
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // Execution tests
  describe.each(agents)("%s execution", (agent, agentName) => {
    it("should execute with input", async () => {
      await expect(agent.execute("test input")).resolves.toBeDefined();
    });

    it("should handle empty input", async () => {
      await expect(agent.execute("")).resolves.toBeDefined();
    });
  });

  // Error handling tests
  describe.each(agents)("%s error handling", (agent, agentName) => {
    it("should handle errors during execution", async () => {
      const errorSpy = jest.fn();
      agent.on(AgentEvent.ERROR, (error) => {
        errorSpy(error);
      });

      // Simulating an error scenario might require mocking the internal execute method
      // This is a placeholder and might need adjustment based on actual implementation
      try {
        await agent.execute("error-inducing-input");
      } catch (error) {
        expect(errorSpy).toHaveBeenCalled();
      }
    });
  });
});
