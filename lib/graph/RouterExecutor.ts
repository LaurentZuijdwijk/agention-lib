import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor, GraphNode, TokenUsage } from "./BaseExecutor";

/**
 * Represents a route option that the router can select.
 */
export interface Route<TInput = string, TOutput = string> {
  /** Unique identifier for this route */
  name: string;
  /** Description of when this route should be selected */
  description: string;
  /** The handler to execute when this route is selected */
  handler: GraphNode<TInput, TOutput> | BaseAgent;
}

/**
 * Options for configuring the router executor.
 */
export interface RouterExecutorOptions {
  /**
   * Custom prompt template for the router agent.
   * Use {input} for the user input and {routes} for the formatted route options.
   */
  promptTemplate?: string;

  /**
   * If true, includes the original input when executing the selected route.
   * If false, passes only the input to the route handler.
   * @default true
   */
  includeRouterContext?: boolean;

  /**
   * Fallback route name to use if the router fails to select a valid route.
   * If not specified and router fails, an error is thrown.
   */
  fallbackRoute?: string;
}

const DEFAULT_PROMPT_TEMPLATE = `You are a routing agent that must select the most appropriate handler for the given input.

User Input: {input}

Available Routes:
{routes}

Instructions:
- Analyze the user input carefully
- Select the single most appropriate route based on the descriptions
- Respond with ONLY the route name, nothing else
- Do not explain your choice, just output the route name exactly as shown`;

/**
 * Routes input to one of several available handlers based on an agent's decision.
 * The router agent analyzes the input and selects the most appropriate route.
 *
 * @example
 * ```typescript
 * const router = new RouterExecutor(routerAgent, [
 *   { name: "technical", description: "Technical questions about code", handler: techAgent },
 *   { name: "general", description: "General knowledge questions", handler: generalAgent },
 *   { name: "creative", description: "Creative writing tasks", handler: creativeAgent },
 * ]);
 *
 * const result = await router.execute("How do I fix this TypeScript error?");
 * // Router selects "technical" route and executes techAgent
 * ```
 */
export class RouterExecutor extends BaseExecutor<string, string> {
  private router: BaseAgent;
  private routes: Map<string, Route>;
  private options: Required<RouterExecutorOptions>;
  private routeNames: string[];

  constructor(
    router: BaseAgent,
    routes: Route[],
    options: RouterExecutorOptions = {}
  ) {
    super();
    this.name = "RouterExecutor";
    this.nodeType = "router";
    this.router = router;
    this.routes = new Map(routes.map((route) => [route.name.toLowerCase(), route]));
    this.routeNames = routes.map((r) => r.name);

    this.options = {
      promptTemplate: options.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE,
      includeRouterContext: options.includeRouterContext ?? true,
      fallbackRoute: options.fallbackRoute ?? "",
    };

    if (routes.length === 0) {
      throw new Error("RouterExecutor requires at least one route");
    }
  }

  /**
   * Routes the input to the appropriate handler based on the router agent's decision.
   * @param input - The input string to route
   * @returns The output from the selected route's handler
   */
  async execute(input: string): Promise<string> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "router", input);

    try {
      // Build the routing prompt
      const routesDescription = this.routeNames
        .map((name) => {
          const route = this.routes.get(name.toLowerCase())!;
          return `- ${name}: ${route.description}`;
        })
        .join("\n");

      const routingPrompt = this.options.promptTemplate
        .replace("{input}", input)
        .replace("{routes}", routesDescription);

      // Execute the router agent to select a route
      const routerName = this.router.getName?.() ?? "Router";
      const routerExecId = collector?.startExecution(
        routerName,
        "agent",
        routingPrompt
      );

      let selectedRouteName: string;
      try {
        const routerResponse = (await this.router.execute(
          routingPrompt
        )) as string;
        selectedRouteName = this.parseRouteSelection(routerResponse);

        const tokenUsage = this.extractTokenUsage(this.router);
        if (routerExecId) {
          collector?.endExecution(
            routerExecId,
            true,
            selectedRouteName,
            tokenUsage
          );
        }
      } catch (error) {
        if (routerExecId) {
          collector?.endExecution(
            routerExecId,
            false,
            undefined,
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
        throw error;
      }

      // Get the selected route
      const route = this.routes.get(selectedRouteName.toLowerCase());
      if (!route) {
        // Try fallback if configured
        if (this.options.fallbackRoute) {
          const fallbackRoute = this.routes.get(
            this.options.fallbackRoute.toLowerCase()
          );
          if (fallbackRoute) {
            return this.executeRoute(fallbackRoute, input, collector, execId);
          }
        }
        throw new Error(
          `Router selected invalid route: "${selectedRouteName}". Available routes: ${this.routeNames.join(", ")}`
        );
      }

      return this.executeRoute(route, input, collector, execId);
    } catch (error) {
      if (execId) {
        collector?.endExecution(
          execId,
          false,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  /**
   * Execute the selected route's handler.
   */
  private async executeRoute(
    route: Route,
    input: string,
    collector: ReturnType<typeof this.getCollector>,
    parentExecId: string | undefined
  ): Promise<string> {
    const handlerName = route.name;
    const handlerExecId = collector?.startExecution(handlerName, "agent", input);

    try {
      // Prepare input for the handler
      const handlerInput = this.options.includeRouterContext
        ? JSON.stringify({
            originalInput: input,
            selectedRoute: route.name,
          })
        : input;

      let result: string;
      if (this.isGraphNode(route.handler)) {
        // Pass metrics collector to child executors
        if (collector && route.handler instanceof BaseExecutor) {
          route.handler.withMetrics(collector);
        }
        result = (await route.handler.execute(handlerInput)) as string;
      } else {
        result = (await (route.handler as BaseAgent).execute(
          handlerInput
        )) as string;
      }

      // Try to extract token usage if handler is an agent
      let tokenUsage: TokenUsage | undefined;
      if (!this.isGraphNode(route.handler)) {
        tokenUsage = this.extractTokenUsage(route.handler as BaseAgent);
      }

      if (handlerExecId) {
        collector?.endExecution(handlerExecId, true, result, tokenUsage);
      }
      if (parentExecId) {
        collector?.endExecution(parentExecId, true, result);
      }

      return result;
    } catch (error) {
      if (handlerExecId) {
        collector?.endExecution(
          handlerExecId,
          false,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  /**
   * Parse the router's response to extract the selected route name.
   * Handles various response formats and normalizes the selection.
   */
  private parseRouteSelection(response: string): string {
    // Clean up the response - trim whitespace and handle common formats
    const cleaned = response.trim().toLowerCase();

    // Direct match
    if (this.routes.has(cleaned)) {
      return cleaned;
    }

    // Try to find a route name mentioned in the response
    for (const name of this.routeNames) {
      if (cleaned.includes(name.toLowerCase())) {
        return name.toLowerCase();
      }
    }

    // If no match found, return the cleaned response and let caller handle the error
    return cleaned;
  }

  /**
   * Check if a value is a GraphNode.
   */
  private isGraphNode(value: unknown): value is GraphNode {
    return (
      typeof value === "object" &&
      value !== null &&
      "execute" in value &&
      typeof (value as GraphNode).execute === "function"
    );
  }

  /**
   * Attempt to extract token usage from an agent.
   */
  private extractTokenUsage(agent: BaseAgent): TokenUsage | undefined {
    const agentWithUsage = agent as BaseAgent & {
      lastTokenUsage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };

    if (!agentWithUsage.lastTokenUsage) return undefined;

    return {
      inputTokens: agentWithUsage.lastTokenUsage.input_tokens,
      outputTokens: agentWithUsage.lastTokenUsage.output_tokens,
      totalTokens: agentWithUsage.lastTokenUsage.total_tokens,
    };
  }

  /**
   * Returns the available route names.
   */
  getRouteNames(): string[] {
    return [...this.routeNames];
  }

  /**
   * Returns the number of available routes.
   */
  get length(): number {
    return this.routes.size;
  }
}
