import { Plan, PlanStep, PlanStepStatus, PlanStatus } from "./types";

/**
 * Manages plans within a pipeline execution.
 * Provides methods to create, update, and track plan progress.
 *
 * @example
 * ```typescript
 * const planStore = new PlanStore();
 * const plan = planStore.createPlan('Research AI', ['Search papers', 'Analyze findings', 'Write summary']);
 *
 * // Work through steps
 * const nextStep = planStore.getNextStep();
 * planStore.updateStep(nextStep.id, 'completed', 'Found 5 relevant papers');
 * ```
 */
export class PlanStore {
  private plans: Map<string, Plan> = new Map();
  private activePlanId?: string;

  /**
   * Create a new plan with a goal and list of step descriptions.
   * @param goal - The overall goal to achieve
   * @param steps - Array of step descriptions
   * @returns The created plan
   */
  createPlan(goal: string, steps: string[]): Plan {
    const id = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const plan: Plan = {
      id,
      goal,
      steps: steps.map((description, index) => ({
        id: `step_${index + 1}`,
        description,
        status: "pending" as PlanStepStatus,
      })),
      status: "created",
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(id, plan);
    this.activePlanId = id;

    return plan;
  }

  /**
   * Get the currently active plan.
   * @returns The active plan or undefined if none
   */
  getActivePlan(): Plan | undefined {
    return this.activePlanId ? this.plans.get(this.activePlanId) : undefined;
  }

  /**
   * Get a plan by its ID.
   * @param id - The plan ID
   * @returns The plan or undefined if not found
   */
  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  /**
   * Set the active plan by ID.
   * @param id - The plan ID to set as active
   * @returns True if the plan exists and was set as active
   */
  setActivePlan(id: string): boolean {
    if (this.plans.has(id)) {
      this.activePlanId = id;
      return true;
    }
    return false;
  }

  /**
   * Update a step's status and optionally its output or error.
   * @param stepId - The step ID to update
   * @param status - The new status
   * @param output - Optional output from the step
   * @param error - Optional error message
   */
  updateStep(
    stepId: string,
    status: PlanStepStatus,
    output?: string,
    error?: string
  ): void {
    const plan = this.getActivePlan();
    if (!plan) return;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return;

    step.status = status;
    if (output !== undefined) step.output = output;
    if (error !== undefined) step.error = error;

    plan.updatedAt = Date.now();

    // Update plan status based on steps
    this.updatePlanStatus(plan);
  }

  /**
   * Get the next pending step that can be executed.
   * @returns The next pending step or undefined if none
   */
  getNextStep(): PlanStep | undefined {
    const plan = this.getActivePlan();
    if (!plan || plan.status === "completed" || plan.status === "failed") {
      return undefined;
    }

    // Mark plan as executing if it was just created
    if (plan.status === "created") {
      plan.status = "executing";
      plan.updatedAt = Date.now();
    }

    return plan.steps.find((step) => step.status === "pending");
  }

  /**
   * Add a new step to the active plan.
   * @param description - The step description
   * @returns The created step or undefined if no active plan
   */
  addStep(description: string): PlanStep | undefined {
    const plan = this.getActivePlan();
    if (!plan) return undefined;

    const newStep: PlanStep = {
      id: `step_${plan.steps.length + 1}`,
      description,
      status: "pending",
    };

    plan.steps.push(newStep);
    plan.updatedAt = Date.now();

    return newStep;
  }

  /**
   * Get a human-readable summary of the active plan.
   * @returns A formatted summary string
   */
  getSummary(): string {
    const plan = this.getActivePlan();
    if (!plan) return "No active plan";

    const statusEmoji: Record<PlanStepStatus, string> = {
      pending: "[ ]",
      in_progress: "[~]",
      completed: "[x]",
      failed: "[!]",
      skipped: "[-]",
    };

    const lines = [
      `Plan: ${plan.goal}`,
      `Status: ${plan.status}`,
      `Steps:`,
      ...plan.steps.map(
        (step) => `  ${statusEmoji[step.status]} ${step.id}: ${step.description}`
      ),
    ];

    return lines.join("\n");
  }

  /**
   * Get all plans.
   * @returns Array of all plans
   */
  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Clear all plans.
   */
  clear(): void {
    this.plans.clear();
    this.activePlanId = undefined;
  }

  /**
   * Update the overall plan status based on step statuses.
   */
  private updatePlanStatus(plan: Plan): void {
    const allCompleted = plan.steps.every((s) => s.status === "completed");
    const anyFailed = plan.steps.some((s) => s.status === "failed");
    const anyInProgress = plan.steps.some((s) => s.status === "in_progress");

    let newStatus: PlanStatus;
    if (allCompleted) {
      newStatus = "completed";
    } else if (anyFailed) {
      newStatus = "failed";
    } else if (anyInProgress || plan.steps.some((s) => s.status === "completed")) {
      newStatus = "executing";
    } else {
      newStatus = plan.status;
    }

    if (plan.status !== newStatus) {
      plan.status = newStatus;
      plan.updatedAt = Date.now();
    }
  }
}
