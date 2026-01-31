import { PlanStore } from "./PlanStore";

describe("PlanStore", () => {
  let planStore: PlanStore;

  beforeEach(() => {
    planStore = new PlanStore();
  });

  describe("createPlan", () => {
    it("should create a plan with goal and steps", () => {
      const plan = planStore.createPlan("Research AI", [
        "Search papers",
        "Analyze findings",
        "Write summary",
      ]);

      expect(plan.goal).toBe("Research AI");
      expect(plan.steps).toHaveLength(3);
      expect(plan.status).toBe("created");
    });

    it("should assign unique IDs to plans", () => {
      const plan1 = planStore.createPlan("Goal 1", ["Step"]);
      const plan2 = planStore.createPlan("Goal 2", ["Step"]);

      expect(plan1.id).not.toBe(plan2.id);
    });

    it("should assign sequential step IDs", () => {
      const plan = planStore.createPlan("Goal", ["A", "B", "C"]);

      expect(plan.steps[0].id).toBe("step_1");
      expect(plan.steps[1].id).toBe("step_2");
      expect(plan.steps[2].id).toBe("step_3");
    });

    it("should initialize all steps as pending", () => {
      const plan = planStore.createPlan("Goal", ["A", "B", "C"]);

      plan.steps.forEach((step) => {
        expect(step.status).toBe("pending");
      });
    });

    it("should set timestamps", () => {
      const before = Date.now();
      const plan = planStore.createPlan("Goal", ["Step"]);
      const after = Date.now();

      expect(plan.createdAt).toBeGreaterThanOrEqual(before);
      expect(plan.createdAt).toBeLessThanOrEqual(after);
      expect(plan.updatedAt).toBe(plan.createdAt);
    });

    it("should set the new plan as active", () => {
      planStore.createPlan("Goal", ["Step"]);
      const active = planStore.getActivePlan();

      expect(active).toBeDefined();
      expect(active?.goal).toBe("Goal");
    });
  });

  describe("getActivePlan", () => {
    it("should return undefined when no plan exists", () => {
      expect(planStore.getActivePlan()).toBeUndefined();
    });

    it("should return the most recently created plan", () => {
      planStore.createPlan("First", ["Step"]);
      planStore.createPlan("Second", ["Step"]);

      const active = planStore.getActivePlan();
      expect(active?.goal).toBe("Second");
    });
  });

  describe("getPlan", () => {
    it("should retrieve a plan by ID", () => {
      const created = planStore.createPlan("Goal", ["Step"]);
      const retrieved = planStore.getPlan(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should return undefined for non-existent ID", () => {
      expect(planStore.getPlan("nonexistent")).toBeUndefined();
    });
  });

  describe("setActivePlan", () => {
    it("should switch active plan", () => {
      const plan1 = planStore.createPlan("First", ["Step"]);
      planStore.createPlan("Second", ["Step"]);

      planStore.setActivePlan(plan1.id);
      expect(planStore.getActivePlan()?.goal).toBe("First");
    });

    it("should return false for non-existent plan", () => {
      expect(planStore.setActivePlan("nonexistent")).toBe(false);
    });
  });

  describe("updateStep", () => {
    it("should update step status", () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      planStore.updateStep("step_1", "completed");

      expect(plan.steps[0].status).toBe("completed");
    });

    it("should update step output", () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      planStore.updateStep("step_1", "completed", "Result text");

      expect(plan.steps[0].output).toBe("Result text");
    });

    it("should update step error", () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      planStore.updateStep("step_1", "failed", undefined, "Error message");

      expect(plan.steps[0].error).toBe("Error message");
    });

    it("should update plan updatedAt timestamp", () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      const originalUpdatedAt = plan.updatedAt;

      planStore.updateStep("step_1", "completed");
      expect(plan.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it("should update plan status to executing when steps change", () => {
      const plan = planStore.createPlan("Goal", ["A", "B"]);
      planStore.updateStep("step_1", "completed");

      expect(plan.status).toBe("executing");
    });

    it("should update plan status to completed when all steps done", () => {
      const plan = planStore.createPlan("Goal", ["A", "B"]);
      planStore.updateStep("step_1", "completed");
      planStore.updateStep("step_2", "completed");

      expect(plan.status).toBe("completed");
    });

    it("should update plan status to failed when any step fails", () => {
      const plan = planStore.createPlan("Goal", ["A", "B"]);
      planStore.updateStep("step_1", "failed");

      expect(plan.status).toBe("failed");
    });
  });

  describe("getNextStep", () => {
    it("should return the first pending step", () => {
      planStore.createPlan("Goal", ["A", "B", "C"]);
      const next = planStore.getNextStep();

      expect(next?.id).toBe("step_1");
      expect(next?.description).toBe("A");
    });

    it("should skip completed steps", () => {
      planStore.createPlan("Goal", ["A", "B", "C"]);
      planStore.updateStep("step_1", "completed");

      const next = planStore.getNextStep();
      expect(next?.id).toBe("step_2");
    });

    it("should return undefined when all steps done", () => {
      planStore.createPlan("Goal", ["A"]);
      planStore.updateStep("step_1", "completed");

      expect(planStore.getNextStep()).toBeUndefined();
    });

    it("should return undefined when no active plan", () => {
      expect(planStore.getNextStep()).toBeUndefined();
    });

    it("should mark plan as executing on first call", () => {
      const plan = planStore.createPlan("Goal", ["A"]);
      expect(plan.status).toBe("created");

      planStore.getNextStep();
      expect(plan.status).toBe("executing");
    });
  });

  describe("addStep", () => {
    it("should add a new step to the plan", () => {
      const plan = planStore.createPlan("Goal", ["A"]);
      const newStep = planStore.addStep("B");

      expect(newStep?.id).toBe("step_2");
      expect(newStep?.description).toBe("B");
      expect(plan.steps).toHaveLength(2);
    });

    it("should return undefined when no active plan", () => {
      expect(planStore.addStep("Step")).toBeUndefined();
    });
  });

  describe("getSummary", () => {
    it("should return formatted summary", () => {
      planStore.createPlan("Research AI", ["Search", "Analyze"]);
      const summary = planStore.getSummary();

      expect(summary).toContain("Plan: Research AI");
      expect(summary).toContain("Status: created");
      expect(summary).toContain("[ ] step_1: Search");
      expect(summary).toContain("[ ] step_2: Analyze");
    });

    it("should show step status indicators", () => {
      planStore.createPlan("Goal", ["A", "B", "C", "D", "E"]);
      planStore.updateStep("step_1", "completed");
      planStore.updateStep("step_2", "in_progress");
      planStore.updateStep("step_3", "failed");
      planStore.updateStep("step_4", "skipped");

      const summary = planStore.getSummary();
      expect(summary).toContain("[x] step_1");
      expect(summary).toContain("[~] step_2");
      expect(summary).toContain("[!] step_3");
      expect(summary).toContain("[-] step_4");
      expect(summary).toContain("[ ] step_5");
    });

    it("should return message when no active plan", () => {
      expect(planStore.getSummary()).toBe("No active plan");
    });
  });

  describe("getAllPlans", () => {
    it("should return all plans", () => {
      planStore.createPlan("First", ["A"]);
      planStore.createPlan("Second", ["B"]);
      planStore.createPlan("Third", ["C"]);

      const plans = planStore.getAllPlans();
      expect(plans).toHaveLength(3);
    });

    it("should return empty array when no plans", () => {
      expect(planStore.getAllPlans()).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should remove all plans", () => {
      planStore.createPlan("First", ["A"]);
      planStore.createPlan("Second", ["B"]);
      planStore.clear();

      expect(planStore.getAllPlans()).toEqual([]);
      expect(planStore.getActivePlan()).toBeUndefined();
    });
  });
});
