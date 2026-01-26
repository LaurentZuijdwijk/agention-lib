import EventEmitter from "events";
import { Tool } from "../tools/Tool";
import {
  History,
  HistoryEntry,
  MessageRole,
  MessageContent,
} from "../history/History";
import {
  AgentVendor,
  CommonAgentConfig,
  VendorSpecificConfig,
} from "./AgentConfig";

// Re-export for convenience
export type { HistoryEntry, MessageRole, MessageContent };
export type { AgentVendor };

/**
 * Agent config as used across all agents
 * @deprecated Use CommonAgentConfig with vendorConfig instead
 */
export interface BaseAgentConfig extends CommonAgentConfig {
  vendor: AgentVendor;
  vendorConfig?: VendorSpecificConfig;
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
  protected tools: Map<string, Tool<unknown>>;
  protected maxHistoryLength: number;

  /** The vendor/provider for this agent (anthropic, openai, mistral, gemini) */
  protected vendor: AgentVendor;

  /** The model identifier for this agent */
  protected model: string;

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
    this.vendor = config.vendor;
    this.model = config.model || "unknown";

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

  protected abstract handleResponse(response: unknown): Promise<unknown>;

  protected getToolDefinitions(): unknown[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  /**
   * Add an entry to history
   */
  protected addToHistory(entry: HistoryEntry): void {
    this.history.addEntry(entry);
  }

  /**
   * Add a text message to history
   */
  protected addTextToHistory(role: MessageRole, content: string): void {
    this.history.addText(role, content);
  }

  /**
   * Add system message to history if it doesn't already exist.
   * Checks if the first system message matches the provided content.
   */
  protected addSystemMessage(content: string): void {
    const existingSystem = this.history.getSystemMessage();
    if (existingSystem === content) {
      // System message already exists with same content, skip
      return;
    }
    this.history.addSystem(content);
  }

  /**
   * Get the standard system message for this agent
   */
  protected getSystemMessage(): string {
    return `You are an agent called ${this.getName()} and should follow these instructions: ${this.getDescription()}`;
  }

  /**
   * Add a message with content blocks to history
   */
  protected addMessageToHistory(
    role: MessageRole,
    content: MessageContent[]
  ): void {
    this.history.addMessage(role, content);
  }

  public addTools(tools: Tool<unknown>[]) {
    tools.forEach((tool) => {
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, tool);
      } else {
        throw new Error(
          `AddTool: Tool ${tool.name} already exists for ${this.getName()}`
        );
      }
    });
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

  getVendor(): AgentVendor {
    return this.vendor;
  }

  getModel(): string {
    return this.model;
  }

  getHistoryEntries(): HistoryEntry[] {
    return this.history.entries;
  }

  getTools(): Tool<unknown>[] {
    return [...this.tools.values()];
  }

  clearHistory(): void {
    this.history.clear();
  }

  protected abstract parseUsage(input: unknown): TokenUsage;
}
