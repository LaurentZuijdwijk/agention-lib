import EventEmitter from "events";
import { BaseAgent } from "../agents/BaseAgent";

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
    public agentName: string,
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
    public agentName: string,
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
    context: Record<string, any> | null,
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
  ): Promise<T> {
    const event = new ToolEvent(this, input, id, agentId, agentName);

    this.emit(ToolEvent.EXECUTE, event);
    if (event.isDefaultPrevented) {
      return {
        type: "tool_result" as const,
        tool_use_id: id,
        content:
          "Tool execution prevented, do not try this tool again with this input",
        is_error: true,
      } as any;
    }
    try {
      const result = await this.executeFn(input, this.context);
      const resultEvent = new ToolResultEvent(
        this,
        input,
        id,
        result,
        agentId,
        agentName,
      );

      this.emit(ToolResultEvent.RESULT, resultEvent);
      if (resultEvent.isDefaultPrevented) {
        return {
          type: "tool_result" as const,
          tool_use_id: id,
          content:
            "Tool result prevented, do not try this tool again with this input",
          is_error: true,
        } as any;
      }

      return {
        type: "tool_result" as const,
        tool_use_id: id,
        content: JSON.stringify(result),
      } as any;
    } catch (error: any) {
      return {
        type: "tool_result" as const,
        tool_use_id: id,
        agentId,
        content: error.message,
        is_error: true,
      } as any;
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
