import { Tool } from "../../tools/Tool";
import { PlanStore } from "./PlanStore";
import { PlanStepStatus } from "./types";

/**
 * Create a tool for agents to create an execution plan.
 *
 * @param planStore - The PlanStore to create plans in
 * @returns A Tool that creates plans
 *
 * @example
 * ```typescript
 * const store = new PlanStore();
 * const createTool = createPlanTool(store);
 * agent.addTools([createTool]);
 * ```
 */
export function createPlanTool(planStore: PlanStore): Tool<string> {
  return new Tool({
    name: "create_plan",
    description:
      "Create an execution plan with a goal and ordered steps. Each step should be a clear, actionable task.",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "The overall goal to achieve",
        },
        steps: {
          type: "array",
          description: "Ordered list of step descriptions",
        },
      },
      required: ["goal", "steps"],
    },
    execute: async (input: {
      goal: string;
      steps: string[];
    }): Promise<string> => {
      const plan = planStore.createPlan(input.goal, input.steps);
      return JSON.stringify({
        success: true,
        planId: plan.id,
        stepCount: plan.steps.length,
        summary: planStore.getSummary(),
      });
    },
  });
}

/**
 * Create a tool for agents to view the current plan status.
 *
 * @param planStore - The PlanStore to view plans from
 * @returns A Tool that displays plan information
 */
export function createViewPlanTool(planStore: PlanStore): Tool<string> {
  return new Tool({
    name: "view_plan",
    description: "View the current plan status and steps.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (): Promise<string> => {
      const plan = planStore.getActivePlan();
      if (!plan) {
        return JSON.stringify({ error: "No active plan" });
      }
      return JSON.stringify({
        plan,
        summary: planStore.getSummary(),
      });
    },
  });
}

/**
 * Create a tool for agents to update step status.
 *
 * @param planStore - The PlanStore to update steps in
 * @returns A Tool that updates step status
 */
export function createUpdateStepTool(planStore: PlanStore): Tool<string> {
  return new Tool({
    name: "update_step",
    description:
      "Update the status of a plan step. Mark as completed when done, failed if there was an error.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: {
          type: "string",
          description: "The step ID to update (e.g., step_1)",
        },
        status: {
          type: "string",
          enum: ["in_progress", "completed", "failed", "skipped"],
          description: "New status for the step",
        },
        output: {
          type: "string",
          description: "Optional output or result from this step",
        },
        error: {
          type: "string",
          description: "Optional error message if the step failed",
        },
      },
      required: ["stepId", "status"],
    },
    execute: async (input: {
      stepId: string;
      status: PlanStepStatus;
      output?: string;
      error?: string;
    }): Promise<string> => {
      planStore.updateStep(input.stepId, input.status, input.output, input.error);
      return JSON.stringify({
        success: true,
        summary: planStore.getSummary(),
      });
    },
  });
}

/**
 * Create a tool for agents to get the next step to work on.
 *
 * @param planStore - The PlanStore to get steps from
 * @returns A Tool that retrieves the next pending step
 */
export function createGetNextStepTool(planStore: PlanStore): Tool<string> {
  return new Tool({
    name: "get_next_step",
    description: "Get the next pending step from the plan to work on.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (): Promise<string> => {
      const step = planStore.getNextStep();
      if (!step) {
        return JSON.stringify({
          message: "No more pending steps",
          summary: planStore.getSummary(),
        });
      }
      return JSON.stringify({ nextStep: step });
    },
  });
}

/**
 * Create a tool for agents to add a step to the current plan.
 *
 * @param planStore - The PlanStore to add steps to
 * @returns A Tool that adds new steps
 */
export function createAddStepTool(planStore: PlanStore): Tool<string> {
  return new Tool({
    name: "add_step",
    description: "Add a new step to the current plan.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of the new step",
        },
      },
      required: ["description"],
    },
    execute: async (input: { description: string }): Promise<string> => {
      const step = planStore.addStep(input.description);
      if (!step) {
        return JSON.stringify({ error: "No active plan to add step to" });
      }
      return JSON.stringify({
        success: true,
        step,
        summary: planStore.getSummary(),
      });
    },
  });
}
