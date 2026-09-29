import EventEmitter from "events";
import { BaseAgent, AgentVendor } from "../agents/BaseAgent";
import { ToolExecuteOptions, isAbortError } from "../agents/cancellation";
import { vizReporter } from "../viz/VizReporter";
import { vizConfig } from "../viz/VizConfig";
import { VizSource } from "../viz/types";
import { ToolExecutionBlockedError } from "./errors";

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
  /**
   * @param options Carries the `AbortSignal` of the agent run this call belongs
   *                to, so a long-running tool can be cancelled with the run.
   */
  execute: (
    input: any,
    context?: Record<string, any> | null,
    options?: ToolExecuteOptions
  ) => Promise<T>;
  context?: Record<string, any>;
}

export class ToolEvent {
  public static EXECUTE = "execute";

  private defaultPrevented = false;
  private preventedReason: string | undefined;

  constructor(
    public target: Tool<any>,
    public input: Record<string, any>,
    public id: string,
    public agentId: string,
    public agentName: string
  ) {}

  /**
   * Blocks the call this event describes. `reason`, when given, is surfaced
   * to the calling agent as the tool result's error message (see
   * {@link ToolExecutionBlockedError}), so a guard should explain what it
   * objected to rather than just refusing.
   */
  preventDefault(reason?: string) {
    this.defaultPrevented = true;
    this.preventedReason = reason;
  }

  get isDefaultPrevented() {
    return this.defaultPrevented;
  }

  /** The reason passed to {@link preventDefault}, if any. */
  get reason(): string | undefined {
    return this.preventedReason;
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
 * Called before a tool call executes, with a chance to block it via
 * `event.preventDefault(reason?)`. Unlike a `ToolEvent.EXECUTE` listener
 * (fire-and-forget, checked synchronously), a guard is awaited — so it can
 * call out to an external decision-maker (a classifier, a permission
 * service) before the call is allowed to proceed. See {@link classifierToolGuard}
 * for adapting a `Classifier` into one.
 */
export type ToolGuard = (
  event: ToolEvent,
  options?: ToolExecuteOptions
) => void | Promise<void>;

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
    options?: ToolExecuteOptions
  ) => Promise<T>;
  name: string;
  protected description: string;
  protected context: Record<string, any> | null;
  protected schema: ToolInputSchema;
  private guards: ToolGuard[] = [];

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
      execute: async (input, _context, options): Promise<string> => {
        try {
          return (await agent.execute(input.instructions, {
            signal: options?.signal,
          })) as string;
        } catch (error: any) {
          // A cancelled run is not a tool failure: reporting it as a tool
          // result would have the calling agent carry on with the very run
          // that was just cancelled.
          if (isAbortError(error, options?.signal)) {
            throw error;
          }
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

  /**
   * Registers a guard, awaited before every call to this tool. Guards run in
   * registration order and stop as soon as one blocks the call.
   */
  addGuard(guard: ToolGuard): this {
    this.guards.push(guard);
    return this;
  }

  /** Unregisters a guard previously added with {@link addGuard}. */
  removeGuard(guard: ToolGuard): this {
    this.guards = this.guards.filter((g) => g !== guard);
    return this;
  }

  /**
   * @param options Per-call options. `options.signal` is the agent run's
   *                `AbortSignal`, forwarded to the tool's own `execute` so it
   *                can cancel whatever work it started.
   */
  async execute(
    agentId: string,
    agentName: string,
    input: Record<string, any>,
    id: string,
    agentModel?: string,
    agentVendor?: AgentVendor,
    options?: ToolExecuteOptions
  ): Promise<T> {
    const event = new ToolEvent(this, input, id, agentId, agentName);

    // Synchronous listeners are checked first, unchanged from before guards
    // existed. Guards are awaited afterwards — this is what lets a guard call
    // out to an external decision-maker (e.g. a classifier) and have its
    // `preventDefault()` actually be honored, which a synchronous `emit()`
    // cannot do for an async listener.
    this.emit(ToolEvent.EXECUTE, event);
    if (!event.isDefaultPrevented) {
      for (const guard of this.guards) {
        await guard(event, options);
        if (event.isDefaultPrevented) break;
      }
    }
    if (event.isDefaultPrevented) {
      throw new ToolExecutionBlockedError(event.reason, this.name);
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
      const result = await this.executeFn(input, this.context, options);
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
