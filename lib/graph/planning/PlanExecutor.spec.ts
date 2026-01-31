import { PlanStore } from "./PlanStore";
import { PlanExecutor } from "./PlanExecutor";
import { BaseAgent } from "../../agents/BaseAgent";

// Mock agent for testing
class MockAgent {
  private executeCount = 0;
  private planStore?: PlanStore;

  constructor(
    private name: string = "MockAgent",
    private responses: string[] = ["response"],
    planStore?: PlanStore
  ) {
    this.planStore = planStore;
  }

  getName() {
    return this.name;
  }

  async execute(_input: string): Promise<string> {
    const response = this.responses[this.executeCount % this.responses.length];
    this.executeCount++;

    // If this is a planning agent, create a plan
    if (
      this.name === "PlanningAgent" &&
      this.planStore &&
      this.executeCount === 1
    ) {
      if (!this.planStore.getActivePlan()) {
        this.planStore.createPlan("Test goal", ["Step 1", "Step 2"]);
      }
    }

    // If this is a worker, find the step from the input and complete it
    if (this.name === "WorkerAgent" && this.planStore && _input) {
      try {
        const parsed = JSON.parse(_input);
        if (parsed.currentStep && parsed.currentStep.id) {
          // The executor passes step info in the input
          this.planStore.updateStep(
            parsed.currentStep.id,
            "completed",
            response
          );
        }
      } catch {
        // If input isn't JSON, ignore
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
    it("should execute planning phase and worker steps", async () => {
      const planner = new MockAgent(
        "PlanningAgent",
        ["Plan created"],
        planStore
      );
      const worker = new MockAgent(
        "WorkerAgent",
        ["Step completed"],
        planStore
      );

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent
      );

      const result = await executor.execute("Create a test plan");

      // Planner executed once, worker executed twice (once per step)
      expect(planner.getExecuteCount()).toBe(1);
      expect(worker.getExecuteCount()).toBe(2);
      expect(result).toContain("Test goal");
      expect(result).toContain("Step completed");
    });

    it("should return finalOutput as string", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent
      );

      const result = await executor.execute("input");

      expect(typeof result).toBe("string");
      expect(result).toContain("Goal: Test goal");
      expect(result).toContain("Work done");
    });

    it("should provide detailed result via getLastResult", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent
      );

      await executor.execute("input");
      const details = executor.getLastResult();

      expect(details).toBeDefined();
      expect(details!.success).toBe(true);
      expect(details!.goal).toBe("Test goal");
      expect(details!.completedSteps).toBe(1);
      expect(details!.totalSteps).toBe(1);
      expect(details!.finalOutput).toContain("Work done");
      expect(details!.stepResults).toHaveLength(1);
    });

    it("should throw error if no plan is created", async () => {
      const planner = new MockAgent("BadPlanner", ["No plan"]);
      const worker = new MockAgent("WorkerAgent", ["Work"]);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent
      );

      await expect(executor.execute("input")).rejects.toThrow(
        "Planning agent failed to create a plan"
      );
    });
  });

  describe("maxSteps enforcement", () => {
    it("should enforce maxSteps during planning", async () => {
      const planner = new MockAgent(
        "PlanningAgent",
        ["Plan created"],
        planStore
      );
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      // Create a plan with too many steps
      planStore.createPlan("Big plan", [
        "Step 1",
        "Step 2",
        "Step 3",
        "Step 4",
        "Step 5",
      ]);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        { maxSteps: 3 }
      );

      await expect(executor.execute("input")).rejects.toThrow(
        "created 5 steps, which exceeds the maximum of 3"
      );
    });

    it("should stop at maxSteps during execution", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2", "Step 3"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        { maxSteps: 2 }
      );

      await expect(executor.execute("input")).rejects.toThrow(
        "created 3 steps, which exceeds the maximum of 2"
      );
    });
  });

  describe("concurrency", () => {
    it("should execute steps sequentially when concurrency=1", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2", "Step 3"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);

      const executionOrder: number[] = [];
      const worker = {
        getName: () => "WorkerAgent",
        execute: async (input: string) => {
          try {
            const parsed = JSON.parse(input);
            if (parsed.currentStep && parsed.currentStep.id) {
              const stepNum = parseInt(parsed.currentStep.id.split("_")[1]);
              executionOrder.push(stepNum);
              planStore.updateStep(parsed.currentStep.id, "completed", "done");
            }
          } catch (e) {
            // Ignore parse errors
          }
          return "done";
        },
      };

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        { concurrency: 1 }
      );

      await executor.execute("input");

      // Sequential execution should be in order
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should support concurrent execution when concurrency>1", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2", "Step 3"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        { concurrency: 3 }
      );

      const result = await executor.execute("input");
      const details = executor.getLastResult();

      // All steps should complete
      expect(details!.completedSteps).toBe(3);
      expect(result).toContain("Work done");
    });
  });

  describe("callbacks", () => {
    it("should call onPlanCreated callback", async () => {
      planStore.createPlan("Callback test", ["Step 1"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      let callbackGoal = "";
      let callbackSteps = 0;

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        {
          onPlanCreated: (goal, steps) => {
            callbackGoal = goal;
            callbackSteps = steps.length;
          },
        }
      );

      await executor.execute("input");

      expect(callbackGoal).toBe("Callback test");
      expect(callbackSteps).toBe(1);
    });

    it("should call onStepStart and onStepComplete callbacks", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const worker = new MockAgent("WorkerAgent", ["Work done"], planStore);

      const startedSteps: number[] = [];
      const completedSteps: number[] = [];

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent,
        {
          onStepStart: (_step, num) => {
            startedSteps.push(num);
          },
          onStepComplete: (_step, _result, num) => {
            completedSteps.push(num);
          },
        }
      );

      await executor.execute("input");

      expect(startedSteps).toEqual([1, 2]);
      expect(completedSteps).toEqual([1, 2]);
    });

    it("should call onStepFailed callback on error", async () => {
      planStore.createPlan("Test goal", ["Step 1"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const failingWorker = {
        getName: () => "FailingWorker",
        execute: async () => {
          throw new Error("Worker failed");
        },
      };

      let failedStepNum = 0;
      let failedError = "";

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        failingWorker as unknown as BaseAgent,
        {
          onStepFailed: (_step, error, num) => {
            failedStepNum = num;
            failedError = error.message;
          },
        }
      );

      await expect(executor.execute("input")).rejects.toThrow("Worker failed");

      expect(failedStepNum).toBe(1);
      expect(failedError).toBe("Worker failed");
    });
  });

  describe("error handling", () => {
    it("should stop on failure by default", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);
      const failingWorker = {
        getName: () => "FailingWorker",
        execute: async () => {
          throw new Error("Worker failed");
        },
      };

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        failingWorker as unknown as BaseAgent
      );

      await expect(executor.execute("input")).rejects.toThrow(
        "Step 1 failed: Worker failed"
      );
    });

    it.skip("should continue on failure when stopOnFailure is false", async () => {
      planStore.createPlan("Test goal", ["Step 1", "Step 2"]);

      const planner = new MockAgent("PlanningAgent", ["Plan ready"], planStore);

      let callCount = 0;
      const partiallyFailingWorker = {
        getName: () => "PartiallyFailingWorker",
        execute: async (input: string) => {
          callCount++;
          try {
            const parsed = JSON.parse(input);
            const stepId = parsed.currentStep?.id;

            if (callCount === 1) {
              // Don't update step status - let executor handle it
              throw new Error("First step failed");
            }
            if (stepId) {
              planStore.updateStep(stepId, "completed", "Success");
            }
            return "Success";
          } catch (e) {
            if ((e as Error).message === "First step failed") throw e;
            return "Success";
          }
        },
      };

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        partiallyFailingWorker as unknown as BaseAgent,
        { stopOnFailure: false }
      );

      const result = await executor.execute("input");
      const details = executor.getLastResult();

      // The worker should have been called twice (once for each step)
      expect(callCount).toBe(2);

      expect(details!.completedSteps).toBe(1);
      expect(details!.failedSteps).toBe(1);
      expect(result).toContain("Success");
      expect(result).toContain("Failed steps");
    });
  });

  describe("getPlanStore", () => {
    it("should return the plan store", () => {
      const planner = new MockAgent("PlanningAgent", ["Plan"]);
      const worker = new MockAgent("WorkerAgent", ["Work"]);

      const executor = new PlanExecutor(
        planStore,
        planner as unknown as BaseAgent,
        worker as unknown as BaseAgent
      );

      expect(executor.getPlanStore()).toBe(planStore);
    });
  });
});
