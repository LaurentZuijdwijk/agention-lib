/**
 * A fast, non-generative decision model: given some context and a closed set
 * of labeled options, it answers with one of those options (plus, when the
 * backend reports one, a confidence score and/or a full probability
 * distribution over the options) instead of generating text.
 *
 * This is the shape shared by "System One"-style classifiers such as
 * TypeSafe AI's Jev ({@link JevClassifier}) — deliberately narrow rather than
 * a full reflection of any one provider's question-type system, since the
 * only two consumers in this codebase ({@link classifierToolGuard} and
 * {@link RouterExecutor}) both reduce to "pick one of N labeled options".
 */
export interface ClassifyRequest {
  /**
   * The context the classifier reasons over — either structured state or
   * plain text, passed through to the backend as-is.
   */
  context: Record<string, unknown> | string;
  /** The question being asked about `context`. */
  question: string;
  /** The closed set of labels the classifier must choose among. */
  options: string[];
  /**
   * Optional description per label in `options`, telling the classifier what
   * each label means. Backends that cannot use descriptions ignore them.
   */
  optionDescriptions?: Record<string, string>;
}

/** Result of a {@link Classifier.classify} call. */
export interface ClassifyResult {
  /** One of the request's `options`, verbatim. */
  choice: string;
  /** Confidence in `choice`, 0-1, when the backend reports one. */
  confidence?: number;
  /** Full probability distribution over `options`, when the backend reports one. */
  probabilities?: Record<string, number>;
  /** The untouched backend response, for callers that need vendor-specific detail. */
  raw?: unknown;
}

/** Per-call options for {@link Classifier.classify}, matching this codebase's cancellation conventions. */
export interface ClassifyOptions {
  signal?: AbortSignal;
  timeout?: number;
}

/**
 * A fast classifier backend. Implement this to plug a provider like Jev into
 * {@link classifierToolGuard} or {@link RouterExecutor}.
 */
export interface Classifier {
  classify(
    request: ClassifyRequest,
    options?: ClassifyOptions
  ): Promise<ClassifyResult>;
}

/** Duck-types a value as a {@link Classifier}, for APIs that accept one alongside a `BaseAgent`. */
export function isClassifier(value: unknown): value is Classifier {
  return (
    typeof value === "object" &&
    value !== null &&
    "classify" in value &&
    typeof (value as Classifier).classify === "function"
  );
}
