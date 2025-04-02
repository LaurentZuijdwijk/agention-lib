import EventEmitter from "events";
import { Tool } from "../tools/Tool";
import { History, type HistoryEntry } from "../history/History";

/**
 * Agent config as used across all agents
 */
export interface BaseAgentConfig {
  id: string;
  name: string;
  description: string;
  vendor: "openai" | "anthropic";
  apiKey: string;
  debug?: boolean;
  maxHistoryLength?: number;
  model?: string;
  tools?: Tool<any>[];
  agents?: BaseAgent[];
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
}

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

/**
 * The base agent is what the other agents are inheriting from
 * Handles the BaseConfig
 */
export abstract class BaseAgent<
  TInput = unknown,
  TOutput = unknown
> extends EventEmitter {
  protected id: string;
  protected debug: boolean = true;

  protected name: string;
  protected description: string;
  protected tools: Map<string, Tool<any>>;
  protected maxHistoryLength: number;

  /**
   * An Agent is the primary LLM entity.
   *
   * @param config
   * @param history History is transient by default, meaning it will be cleared for every question.
   *                 this makes hostory easier to manage and saves cost. If history should be kept in between
   *                 prompts, then supply a History object.
   *
   */
  constructor(
    config: BaseAgentConfig,
    protected history = new History([], { transient: true })
  ) {
    super();

    this.id = config.id;
    this.debug = config.debug || false;
    this.name = config.name;
    this.description = config.description;
    if (config.agents) {
      const agentTools = config.agents.map((agent) => {
        return Tool.fromAgent(
          agent,
          `You can use this agent ${agent.getName()} to execute tasks`
        );
      });
      config.tools = config.tools
        ? [...config.tools, ...agentTools]
        : agentTools;
    }

    this.tools = new Map((config.tools || []).map((tool) => [tool.name, tool]));

    this.maxHistoryLength = config.maxHistoryLength || 100;
  }

  abstract execute(input: TInput): Promise<TOutput>;

  protected abstract process(input: TInput): Promise<TOutput>;

  protected abstract handleResponse(response: unknown): Promise<any>;

  protected getToolDefinitions(): unknown[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  protected addToHistory(role: string | HistoryEntry, content?: any): void {
    this.history.addEntry(role, content);
  }

  public addTools(tools: Tool<any>[]) {
    tools.forEach((tool) => {
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, tool);
      } else {
        throw new Error(
          `AddTool: Tool ${tool.name} already exists for ${this.getName()}`
        );
      }
    });
    console.log(this.getToolDefinitions());
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getHistoryEntries(): HistoryEntry[] {
    return this.history.entries;
  }

  getTools(): Tool<any>[] {
    return [...this.tools.values()];
  }

  clearHistory(): void {
    this.history.clear();
  }

  protected abstract parseUsage(input: unknown): TokenUsage;
}
