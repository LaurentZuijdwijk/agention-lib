/**
 * Status of a plan step.
 */
export type PlanStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

/**
 * A single step in a plan.
 */
export interface PlanStep {
  /** Unique identifier for this step (e.g., "step_1") */
  id: string;
  /** Human-readable description of what this step does */
  description: string;
  /** Current status of this step */
  status: PlanStepStatus;
  /** Output or result from this step (set after completion) */
  output?: string;
  /** Error message if the step failed */
  error?: string;
}

/**
 * Overall status of a plan.
 */
export type PlanStatus = "created" | "executing" | "completed" | "failed";

/**
 * A complete execution plan with a goal and ordered steps.
 */
export interface Plan {
  /** Unique identifier for this plan */
  id: string;
  /** The overall goal this plan aims to achieve */
  goal: string;
  /** Ordered list of steps to execute */
  steps: PlanStep[];
  /** Overall status of the plan */
  status: PlanStatus;
  /** Timestamp when the plan was created */
  createdAt: number;
  /** Timestamp when the plan was last updated */
  updatedAt: number;
}
