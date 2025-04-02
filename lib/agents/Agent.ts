import { History } from "../history/History";
import { ClaudeAgent } from "./anthropic/ClaudeAgent";
import { BaseAgentConfig } from "./BaseAgent";
import { OpenAiAgent } from "./openai/OpenAiAgent";

type agentConfig = BaseAgentConfig;

export class Agent {
  static create(config: agentConfig, history?: History) {
    if (config.vendor === "anthropic") {
      return new ClaudeAgent(config, history);
    } else if (config.vendor === "openai") {
      return new OpenAiAgent(config, history);
    } else throw new Error("No vendor defined");
  }
}
