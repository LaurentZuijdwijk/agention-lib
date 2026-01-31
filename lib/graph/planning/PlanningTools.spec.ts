import { PlanStore } from "./PlanStore";
import {
  createPlanTool,
  createViewPlanTool,
  createUpdateStepTool,
  createGetNextStepTool,
  createAddStepTool,
} from "./PlanningTools";

describe("Planning Tools", () => {
  let planStore: PlanStore;

  beforeEach(() => {
    planStore = new PlanStore();
  });

  describe("createPlanTool", () => {
    it("should create a plan with goal and steps", async () => {
      const tool = createPlanTool(planStore);

      const result = await tool["executeFn"](
        {
          goal: "Research AI",
          steps: ["Search papers", "Analyze", "Summarize"],
        },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.planId).toBeDefined();
      expect(parsed.stepCount).toBe(3);
      expect(parsed.summary).toContain("Research AI");
    });

    it("should have correct tool metadata", () => {
      const tool = createPlanTool(planStore);
      expect(tool.name).toBe("create_plan");
      expect(tool.getPrompt().description).toContain("Create an execution plan");
    });
  });

  describe("createViewPlanTool", () => {
    it("should return plan details when plan exists", async () => {
      planStore.createPlan("Goal", ["Step 1", "Step 2"]);
      const tool = createViewPlanTool(planStore);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.plan).toBeDefined();
      expect(parsed.plan.goal).toBe("Goal");
      expect(parsed.plan.steps).toHaveLength(2);
      expect(parsed.summary).toContain("Goal");
    });

    it("should return error when no plan exists", async () => {
      const tool = createViewPlanTool(planStore);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("No active plan");
    });

    it("should have correct tool metadata", () => {
      const tool = createViewPlanTool(planStore);
      expect(tool.name).toBe("view_plan");
    });
  });

  describe("createUpdateStepTool", () => {
    it("should update step status to completed", async () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      const tool = createUpdateStepTool(planStore);

      const result = await tool["executeFn"](
        { stepId: "step_1", status: "completed", output: "Done!" },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(plan.steps[0].status).toBe("completed");
      expect(plan.steps[0].output).toBe("Done!");
    });

    it("should update step status to failed with error", async () => {
      const plan = planStore.createPlan("Goal", ["Step"]);
      const tool = createUpdateStepTool(planStore);

      await tool["executeFn"](
        { stepId: "step_1", status: "failed", error: "Something went wrong" },
        null
      );

      expect(plan.steps[0].status).toBe("failed");
      expect(plan.steps[0].error).toBe("Something went wrong");
    });

    it("should include updated summary in response", async () => {
      planStore.createPlan("Goal", ["Step"]);
      const tool = createUpdateStepTool(planStore);

      const result = await tool["executeFn"](
        { stepId: "step_1", status: "completed" },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.summary).toContain("[x]");
    });

    it("should have correct tool metadata", () => {
      const tool = createUpdateStepTool(planStore);
      expect(tool.name).toBe("update_step");
      expect(tool.getPrompt().input_schema.required).toContain("stepId");
      expect(tool.getPrompt().input_schema.required).toContain("status");
    });
  });

  describe("createGetNextStepTool", () => {
    it("should return next pending step", async () => {
      planStore.createPlan("Goal", ["A", "B", "C"]);
      const tool = createGetNextStepTool(planStore);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.nextStep).toBeDefined();
      expect(parsed.nextStep.id).toBe("step_1");
      expect(parsed.nextStep.description).toBe("A");
    });

    it("should skip completed steps", async () => {
      planStore.createPlan("Goal", ["A", "B"]);
      planStore.updateStep("step_1", "completed");
      const tool = createGetNextStepTool(planStore);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.nextStep.id).toBe("step_2");
    });

    it("should return message when all steps done", async () => {
      planStore.createPlan("Goal", ["A"]);
      planStore.updateStep("step_1", "completed");
      const tool = createGetNextStepTool(planStore);

      const result = await tool["executeFn"]({}, null);
      const parsed = JSON.parse(result);

      expect(parsed.message).toContain("No more pending steps");
      expect(parsed.summary).toBeDefined();
    });

    it("should have correct tool metadata", () => {
      const tool = createGetNextStepTool(planStore);
      expect(tool.name).toBe("get_next_step");
    });
  });

  describe("createAddStepTool", () => {
    it("should add a step to existing plan", async () => {
      const plan = planStore.createPlan("Goal", ["A"]);
      const tool = createAddStepTool(planStore);

      const result = await tool["executeFn"](
        { description: "New step" },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.step.id).toBe("step_2");
      expect(parsed.step.description).toBe("New step");
      expect(plan.steps).toHaveLength(2);
    });

    it("should return error when no active plan", async () => {
      const tool = createAddStepTool(planStore);

      const result = await tool["executeFn"](
        { description: "Step" },
        null
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("No active plan");
    });

    it("should have correct tool metadata", () => {
      const tool = createAddStepTool(planStore);
      expect(tool.name).toBe("add_step");
      expect(tool.getPrompt().input_schema.required).toContain("description");
    });
  });
});
