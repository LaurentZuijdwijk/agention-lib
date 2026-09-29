import { ToolGuard } from "../tools/Tool";
import { Classifier, ClassifyResult } from "./Classifier";

/** Options for {@link classifierToolGuard}. */
export interface ClassifierToolGuardOptions {
  /** The question posed to the classifier about the proposed call. */
  question?: string;
  /** Option label that means "allow". */
  allowChoice?: string;
  /** Option label that means "block". */
  blockChoice?: string;
  /**
   * Minimum confidence in a "block" choice required to actually prevent
   * execution. Unset (the default) blocks on any "block" verdict, regardless
   * of confidence — the safe-by-default choice; loosen it deliberately.
   */
  minConfidence?: number;
  /** Builds the reason string surfaced to the agent when a call is blocked. */
  reason?: (result: ClassifyResult) => string;
}

const DEFAULT_QUESTION = "Should this tool call be allowed?";
const DEFAULT_ALLOW = "allow";
const DEFAULT_BLOCK = "block";

/**
 * Adapts any {@link Classifier} into a {@link ToolGuard}: before a tool call
 * executes, asks the classifier whether it should be allowed, and blocks it
 * (with a reason surfaced back to the calling agent) when the classifier says
 * so. Register it on one or more tools via `tool.addGuard(...)`.
 *
 * @example
 * ```typescript
 * const guard = classifierToolGuard(new JevClassifier({ apiKey }));
 * dangerousTool.addGuard(guard);
 * ```
 */
export function classifierToolGuard(
  classifier: Classifier,
  options: ClassifierToolGuardOptions = {}
): ToolGuard {
  const allowChoice = options.allowChoice ?? DEFAULT_ALLOW;
  const blockChoice = options.blockChoice ?? DEFAULT_BLOCK;

  return async (event, execOptions) => {
    const result = await classifier.classify(
      {
        context: {
          agentId: event.agentId,
          agentName: event.agentName,
          tool: event.target.name,
          input: event.input,
        },
        question: options.question ?? DEFAULT_QUESTION,
        options: [allowChoice, blockChoice],
      },
      { signal: execOptions?.signal }
    );

    const shouldBlock =
      result.choice === blockChoice &&
      (options.minConfidence === undefined ||
        (result.confidence ?? 1) >= options.minConfidence);

    if (shouldBlock) {
      event.preventDefault(
        options.reason?.(result) ??
          `Blocked by classifier (confidence ${result.confidence ?? "unknown"})`
      );
    }
  };
}
