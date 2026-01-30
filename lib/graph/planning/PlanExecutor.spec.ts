import { PlanStore } from "./PlanStore";
import { PlanExecutor } from "./PlanExecutor";
import { BaseAgent } from "../../agents/BaseAgent";

// Mock agent for testing
class MockAgent {
  private executeCount = 0;
  private planStore?: PlanStore;

  constructor(
    private responses: string[] = ["response"],
    planStore?: PlanStore
  ) {
    this.planStore = planStore;
  }

  getName() {
    return "MockAgent";
  }

  async execute(_input: string): Promise<string> {
    const response = this.responses[this.executeCount % this.responses.length];
    this.executeCount++;

    // If we have a plan store, complete a step on each execution
    if (this.planStore) {
      const nextStep = this.planStore.getNextStep();
      if (nextStep) {
        this.planStore.updateStep(nextStep.id, "completed", response);
      }
    }

    return response;
  }

  getExecuteCount() {
    return this.executeCount;
  }
}

describe("PlanExecutor", () => {
  let planStore: PlanStore;

  beforeEach(() => {
    planStore = new PlanStore();
  });

  describe("basic execution", () => {
    it("should execute agents when there are pending steps", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);
      const agent = new MockAgent(["done"], planStore);
      const executor = new PlanExecutor(planStore, [
        agent as unknown as BaseAgent,
      ]);

      await executor.execute("input");

      // Should have executed twice (once per step)
      expect(agent.getExecuteCount()).toBe(2);
    });

    it("should stop when no pending steps remain", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);
      const agent = new MockAgent(["done"], planStore);
      const executor = new PlanExecutor(planStore, [
        agent as unknown as BaseAgent,
      ]);

      await executor.execute("input");

      expect(agent.getExecuteCount()).toBe(1);
      expect(planStore.getActivePlan()?.status).toBe("completed");
    });

    it("should return immediately if no plan exists", async () => {
      const agent = new MockAgent(["done"]);
      const executor = new PlanExecutor(planStore, [
        agent as unknown as BaseAgent,
      ]);

      const result = await executor.execute("input");
      const parsed = JSON.parse(result);

      expect(agent.getExecuteCount()).toBe(0);
      expect(parsed.iterations).toBe(0);
    });
  });

  describe("iteration limits", () => {
    it("should respect maxIterations", async () => {
      planStore.createPlan("Test goal", [
        "Step 1",
        "Step 2",
        "Step 3",
        "Step 4",
        "Step 5",
      ]);

      // Agent that doesn't complete steps
      const agent = new MockAgent(["response"]);
      const executor = new PlanExecutor(
        planStore,
        [agent as unknown as BaseAgent],
        {
          maxIterations: 3,
        }
      );

      const result = await executor.execute("input");
      const parsed = JSON.parse(result);

      expect(parsed.iterations).toBe(3);
      expect(agent.getExecuteCount()).toBe(3);
    });

    it("should respect maxTotalSteps", async () => {
      planStore.createPlan("Test goal", Array(10).fill("Step"));

      const agent = new MockAgent(["response"], planStore);
      const executor = new PlanExecutor(
        planStore,
        [agent as unknown as BaseAgent],
        {
          maxIterations: 20,
          maxTotalSteps: 5,
        }
      );

      await expect(executor.execute("input")).rejects.toThrow(
        "Maximum total steps"
      );
    });
  });

  describe("multiple agents", () => {
    it("should run all agents in sequence each iteration", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);

      const agent1 = new MockAgent(["agent1"], planStore);
      const agent2 = new MockAgent(["agent2"]);

      const executor = new PlanExecutor(planStore, [
        agent1 as unknown as BaseAgent,
        agent2 as unknown as BaseAgent,
      ]);

      await executor.execute("input");

      expect(agent1.getExecuteCount()).toBe(1);
      expect(agent2.getExecuteCount()).toBe(1);
    });
  });

  describe("callbacks", () => {
    it("should call onIterationStart callback", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);
      const agent = new MockAgent(["done"], planStore);

      const iterations: number[] = [];
      const pendingCounts: number[] = [];

      const executor = new PlanExecutor(
        planStore,
        [agent as unknown as BaseAgent],
        {
          onIterationStart: (iteration, pending) => {
            iterations.push(iteration);
            pendingCounts.push(pending);
          },
        }
      );

      await executor.execute("input");

      expect(iterations).toEqual([1, 2]);
      expect(pendingCounts[0]).toBe(2); // First iteration has 2 pending
      expect(pendingCounts[1]).toBe(1); // Second iteration has 1 pending
    });
  });

  describe("error handling", () => {
    it("should stop on failure by default", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);

      const failingAgent = {
        getName: () => "FailingAgent",
        execute: async () => {
          throw new Error("Agent failed");
        },
      };

      const executor = new PlanExecutor(planStore, [
        failingAgent as unknown as BaseAgent,
      ]);

      await expect(executor.execute("input")).rejects.toThrow("Agent failed");
    });

    it("should continue on failure when stopOnFailure is false", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);

      let callCount = 0;
      const sometimesFailingAgent = {
        getName: () => "SometimesFailingAgent",
        execute: async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("First call fails");
          }
          planStore.updateStep("step_1", "completed", "success");
          return "success";
        },
      };

      const executor = new PlanExecutor(
        planStore,
        [sometimesFailingAgent as unknown as BaseAgent],
        { stopOnFailure: false, maxIterations: 3 }
      );

      const result = await executor.execute("input");
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe("result format", () => {
    it("should return structured result", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);
      const agent = new MockAgent(["final result"], planStore);
      const executor = new PlanExecutor(planStore, [
        agent as unknown as BaseAgent,
      ]);

      const result = await executor.execute("input");
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.iterations).toBe(1);
      expect(parsed.totalStepsExecuted).toBe(1);
      expect(parsed.plan.goal).toBe("Test goal");
      expect(parsed.plan.status).toBe("completed");
      expect(parsed.plan.completedSteps).toBe(1);
      expect(parsed.lastResult).toBe("final result");
    });
  });

  describe("getPlanStore", () => {
    it("should return the plan store", () => {
      const executor = new PlanExecutor(planStore, []);
      expect(executor.getPlanStore()).toBe(planStore);
    });
  });
});
