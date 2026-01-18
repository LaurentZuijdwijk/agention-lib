// @ts-nocheck
import { RouterExecutor, Route } from "./RouterExecutor";
import { BaseAgent } from "../agents/BaseAgent";
import { GraphNode } from "./BaseExecutor";

// Mock agent factory
const createMockAgent = (response: string) => {
  return {
    execute: jest.fn().mockResolvedValue(response),
    getName: jest.fn().mockReturnValue("MockAgent"),
  } as unknown as BaseAgent;
};

// Mock GraphNode factory
const createMockNode = (response: string): GraphNode<string, string> => {
  return {
    execute: jest.fn().mockResolvedValue(response),
    name: "MockNode",
    nodeType: "custom",
  };
};

describe("RouterExecutor", () => {
  describe("constructor", () => {
    it("should create router with routes", () => {
      const router = createMockAgent("technical");
      const routes: Route[] = [
        { name: "technical", description: "Tech questions", handler: createMockAgent("tech response") },
        { name: "general", description: "General questions", handler: createMockAgent("general response") },
      ];

      const executor = new RouterExecutor(router, routes);

      expect(executor).toBeInstanceOf(RouterExecutor);
      expect(executor.length).toBe(2);
      expect(executor.getRouteNames()).toEqual(["technical", "general"]);
    });

    it("should throw error for empty routes", () => {
      const router = createMockAgent("technical");

      expect(() => new RouterExecutor(router, [])).toThrow(
        "RouterExecutor requires at least one route"
      );
    });

    it("should accept custom prompt template", () => {
      const router = createMockAgent("technical");
      const routes: Route[] = [
        { name: "technical", description: "Tech questions", handler: createMockAgent("response") },
      ];

      const executor = new RouterExecutor(router, routes, {
        promptTemplate: "Custom: {input} Routes: {routes}",
      });

      expect(executor).toBeInstanceOf(RouterExecutor);
    });
  });

  describe("execute", () => {
    it("should route to correct handler based on router decision", async () => {
      const router = createMockAgent("technical");
      const techHandler = createMockAgent("Technical answer");
      const generalHandler = createMockAgent("General answer");

      const routes: Route[] = [
        { name: "technical", description: "Technical questions", handler: techHandler },
        { name: "general", description: "General questions", handler: generalHandler },
      ];

      const executor = new RouterExecutor(router, routes);
      const result = await executor.execute("How do I fix this TypeScript error?");

      expect(result).toBe("Technical answer");
      expect(techHandler.execute).toHaveBeenCalledTimes(1);
      expect(generalHandler.execute).not.toHaveBeenCalled();
    });

    it("should handle case-insensitive route selection", async () => {
      const router = createMockAgent("TECHNICAL");
      const techHandler = createMockAgent("Technical answer");

      const routes: Route[] = [
        { name: "technical", description: "Technical questions", handler: techHandler },
      ];

      const executor = new RouterExecutor(router, routes);
      const result = await executor.execute("Question");

      expect(result).toBe("Technical answer");
    });

    it("should extract route name from longer response", async () => {
      const router = createMockAgent("I think technical is the best route");
      const techHandler = createMockAgent("Technical answer");
      const generalHandler = createMockAgent("General answer");

      const routes: Route[] = [
        { name: "technical", description: "Technical questions", handler: techHandler },
        { name: "general", description: "General questions", handler: generalHandler },
      ];

      const executor = new RouterExecutor(router, routes);
      const result = await executor.execute("Question");

      expect(result).toBe("Technical answer");
    });

    it("should use fallback route when selection fails", async () => {
      const router = createMockAgent("unknown_route");
      const techHandler = createMockAgent("Technical answer");
      const fallbackHandler = createMockAgent("Fallback answer");

      const routes: Route[] = [
        { name: "technical", description: "Technical questions", handler: techHandler },
        { name: "fallback", description: "Default handler", handler: fallbackHandler },
      ];

      const executor = new RouterExecutor(router, routes, { fallbackRoute: "fallback" });
      const result = await executor.execute("Question");

      expect(result).toBe("Fallback answer");
    });

    it("should throw error for invalid route without fallback", async () => {
      const router = createMockAgent("unknown_route");
      const techHandler = createMockAgent("Technical answer");

      const routes: Route[] = [
        { name: "technical", description: "Technical questions", handler: techHandler },
      ];

      const executor = new RouterExecutor(router, routes);

      await expect(executor.execute("Question")).rejects.toThrow(
        'Router selected invalid route: "unknown_route"'
      );
    });

    it("should pass input to handler with context by default", async () => {
      const router = createMockAgent("handler");
      const handler = createMockAgent("Response");

      const routes: Route[] = [
        { name: "handler", description: "Handler", handler },
      ];

      const executor = new RouterExecutor(router, routes);
      await executor.execute("Test input");

      expect(handler.execute).toHaveBeenCalledWith(
        JSON.stringify({
          originalInput: "Test input",
          selectedRoute: "handler",
        })
      );
    });

    it("should pass raw input when includeRouterContext is false", async () => {
      const router = createMockAgent("handler");
      const handler = createMockAgent("Response");

      const routes: Route[] = [
        { name: "handler", description: "Handler", handler },
      ];

      const executor = new RouterExecutor(router, routes, { includeRouterContext: false });
      await executor.execute("Test input");

      expect(handler.execute).toHaveBeenCalledWith("Test input");
    });

    it("should format prompt with routes correctly", async () => {
      const router = createMockAgent("route1");
      const routes: Route[] = [
        { name: "route1", description: "First route description", handler: createMockAgent("r1") },
        { name: "route2", description: "Second route description", handler: createMockAgent("r2") },
      ];

      const executor = new RouterExecutor(router, routes);
      await executor.execute("My question");

      const prompt = (router.execute as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain("My question");
      expect(prompt).toContain("- route1: First route description");
      expect(prompt).toContain("- route2: Second route description");
    });

    it("should use custom prompt template", async () => {
      const router = createMockAgent("myroute");
      const routes: Route[] = [
        { name: "myroute", description: "My route", handler: createMockAgent("response") },
      ];

      const executor = new RouterExecutor(router, routes, {
        promptTemplate: "Input: {input}\nAvailable: {routes}\nSelect:",
      });

      await executor.execute("test");

      const prompt = (router.execute as jest.Mock).mock.calls[0][0];
      expect(prompt).toBe("Input: test\nAvailable: - myroute: My route\nSelect:");
    });

    it("should work with GraphNode handlers", async () => {
      const router = createMockAgent("node_route");
      const nodeHandler = createMockNode("Node response");

      const routes: Route[] = [
        { name: "node_route", description: "Node handler", handler: nodeHandler },
      ];

      const executor = new RouterExecutor(router, routes);
      const result = await executor.execute("Question");

      expect(result).toBe("Node response");
      expect(nodeHandler.execute).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors from router", async () => {
      const router = {
        execute: jest.fn().mockRejectedValue(new Error("Router failed")),
        getName: jest.fn().mockReturnValue("Router"),
      } as unknown as BaseAgent;

      const routes: Route[] = [
        { name: "route", description: "Route", handler: createMockAgent("response") },
      ];

      const executor = new RouterExecutor(router, routes);

      await expect(executor.execute("Question")).rejects.toThrow("Router failed");
    });

    it("should propagate errors from handler", async () => {
      const router = createMockAgent("failing_route");
      const handler = {
        execute: jest.fn().mockRejectedValue(new Error("Handler failed")),
        getName: jest.fn().mockReturnValue("Handler"),
      } as unknown as BaseAgent;

      const routes: Route[] = [
        { name: "failing_route", description: "Route", handler },
      ];

      const executor = new RouterExecutor(router, routes);

      await expect(executor.execute("Question")).rejects.toThrow("Handler failed");
    });

    it("should handle routes with special characters in descriptions", async () => {
      const router = createMockAgent("special");
      const routes: Route[] = [
        {
          name: "special",
          description: 'Questions about "code" & <tags>',
          handler: createMockAgent("response")
        },
      ];

      const executor = new RouterExecutor(router, routes);
      await executor.execute("Question");

      const prompt = (router.execute as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain('Questions about "code" & <tags>');
    });
  });

  describe("getRouteNames", () => {
    it("should return array of route names", () => {
      const router = createMockAgent("route");
      const routes: Route[] = [
        { name: "alpha", description: "A", handler: createMockAgent("a") },
        { name: "beta", description: "B", handler: createMockAgent("b") },
        { name: "gamma", description: "G", handler: createMockAgent("g") },
      ];

      const executor = new RouterExecutor(router, routes);

      expect(executor.getRouteNames()).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  describe("length", () => {
    it("should return number of routes", () => {
      const router = createMockAgent("route");
      const routes: Route[] = [
        { name: "r1", description: "R1", handler: createMockAgent("1") },
        { name: "r2", description: "R2", handler: createMockAgent("2") },
        { name: "r3", description: "R3", handler: createMockAgent("3") },
        { name: "r4", description: "R4", handler: createMockAgent("4") },
      ];

      const executor = new RouterExecutor(router, routes);

      expect(executor.length).toBe(4);
    });
  });

  describe("nodeType", () => {
    it("should have nodeType of router", () => {
      const router = createMockAgent("route");
      const routes: Route[] = [
        { name: "route", description: "Route", handler: createMockAgent("response") },
      ];

      const executor = new RouterExecutor(router, routes);

      expect(executor.nodeType).toBe("router");
    });
  });
});
