/**
 * Fast, non-generative classifier support for agention-lib.
 *
 * A `Classifier` answers a typed multiple-choice question about some context
 * — no text generation, just a labeled choice plus (when the backend reports
 * one) a confidence score and probability distribution. Two consumers exist
 * today: {@link classifierToolGuard} (block a risky tool call before it
 * executes) and `RouterExecutor` (pick a route without an LLM generation call).
 *
 * @requires @typesafe-ai/sdk - Optional peer dependency, needed only by
 * {@link JevClassifier}. Install when using it:
 * ```
 * npm install @typesafe-ai/sdk
 * ```
 *
 * @example Tool-call gating
 * ```typescript
 * import { JevClassifier, classifierToolGuard } from "@agentionai/agents/classifiers";
 *
 * const classifier = new JevClassifier({ apiKey: process.env.TYPESAFE_API_KEY });
 * deleteFileTool.addGuard(classifierToolGuard(classifier, {
 *   question: "Is this file deletion safe to run unattended?",
 * }));
 * ```
 *
 * @example Model routing
 * ```typescript
 * import { JevClassifier } from "@agentionai/agents/classifiers";
 * import { RouterExecutor } from "@agentionai/agents";
 *
 * const router = new RouterExecutor(new JevClassifier({ apiKey }), [
 *   { name: "technical", description: "Technical questions about code", handler: techAgent },
 *   { name: "general", description: "General knowledge questions", handler: generalAgent },
 * ]);
 * ```
 */

export { isClassifier } from "./Classifier";
export type { Classifier, ClassifyRequest, ClassifyResult, ClassifyOptions } from "./Classifier";
export { ClassifierError, ClassifierCallError } from "./errors";
export { JevClassifier } from "./JevClassifier";
export type { JevClassifierConfig } from "./JevClassifier";
export { classifierToolGuard } from "./guard";
export type { ClassifierToolGuardOptions } from "./guard";
