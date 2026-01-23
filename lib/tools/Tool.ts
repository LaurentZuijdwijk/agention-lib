import EventEmitter from "events";
import { BaseAgent, AgentVendor } from "../agents/BaseAgent";
import { vizReporter } from "../viz/VizReporter";
import { vizConfig } from "../viz/VizConfig";
import { VizSource } from "../viz/types";

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[] | undefined;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolConfig<T> {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (input: any, context?: Record<string, any> | null) => Promise<T>;
  context?: Record<string, any>;
}

export class ToolEvent {
  public static EXECUTE = "execute";

  private defaultPrevented = false;

  constructor(
    public target: Tool<any>,
    public input: Record<string, any>,
    public id: string,
    public agentId: string,
    public agentName: string
  ) {}

  preventDefault() {
    this.defaultPrevented = true;
  }

  get isDefaultPrevented() {
    return this.defaultPrevented;
  }
}

export class ToolResultEvent extends ToolEvent {
  public eventName = "ToolResult";
  public static RESULT = "toolResult";

  constructor(
    public target: Tool<any>,
    public input: Record<string, any>,
    public id: string,
    public result: any,
    public agentId: string,
    public agentName: string
  ) {
    super(target, input, id, agentId, agentName);
  }
}

/**
 * Tools are used to retrieve additional information for LLMs, so they can provide better results. Examples could be
 * Retrieving weather information, stock prices or specific price information.
 *
 * @param T Generic. Format of the tool result

 */
export class Tool<T> extends EventEmitter {
  protected executeFn: (
    input: unknown,
    context: Record<string, any> | null
  ) => Promise<T>;
  name: string;
  protected description: string;
  protected context: Record<string, any> | null;
  protected schema: ToolInputSchema;

  /**
   * Agents can act as assistants to other agents. This static method creates a tool
   * @param agent The agent that will act as an assistant
   * @param description Th
   * @returns Tool
   */
  public static fromAgent(agent: BaseAgent, description: string) {
    return new Tool<string>({
      name: agent.getName().replace(/ /g, "_"),
      description: description ? description : agent.getDescription(),
      inputSchema: {
        type: "object",
        properties: {
          instructions: {
            type: "string",
            description: "Detailed instructions for the agent.",
          },
        },
        required: ["instructions"],
      },
      execute: async (input): Promise<string> => {
        try {
          return (await agent.execute(input.instructions)) as string;
        } catch (error: any) {
          return JSON.stringify({
            error: "Failed to execute instructions: " + error.message,
          });
        }
      },
    });
  }

  constructor(config: ToolConfig<T>) {
    super();
    this.executeFn = config.execute;
    this.context = config.context || null;
    this.name = config.name;
    this.description = config.description;
    this.schema = config.inputSchema;
  }
  async execute(
    agentId: string,
    agentName: string,
    input: Record<string, any>,
    id: string,
    agentModel?: string,
    agentVendor?: AgentVendor
  ): Promise<T> {
    const event = new ToolEvent(this, input, id, agentId, agentName);

    this.emit(ToolEvent.EXECUTE, event);
    if (event.isDefaultPrevented) {
      throw new Error(
        "Tool execution prevented, do not try this tool again with this input"
      );
    }

    // Visualization reporting
    let vizEventId: string | undefined;
    if (vizConfig.isEnabled()) {
      const vizSource: VizSource = {
        agentId,
        agentName,
        model: agentModel || "unknown",
        vendor: agentVendor || "anthropic",
      };
      vizEventId = vizReporter.toolStart(this.name, id, input, vizSource);
    }

    try {
      const result = await this.executeFn(input, this.context);
      const resultEvent = new ToolResultEvent(
        this,
        input,
        id,
        result,
        agentId,
        agentName
      );

      this.emit(ToolResultEvent.RESULT, resultEvent);
      if (resultEvent.isDefaultPrevented) {
        throw new Error(
          "Tool result prevented, do not try this tool again with this input"
        );
      }

      // Report tool completion to viz
      if (vizEventId) {
        vizReporter.toolComplete(vizEventId, this.name, id, true, result);
      }

      return result;
    } catch (error: any) {
      // Report tool error to viz
      if (vizEventId) {
        vizReporter.toolError(
          vizEventId,
          this.name,
          id,
          error?.message || "Unknown error"
        );
      }
      throw error;
    }
  }
  getPrompt(_vendor?: string) {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.schema,
    };
  }
}
