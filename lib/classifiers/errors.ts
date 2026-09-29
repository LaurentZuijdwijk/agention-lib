/**
 * Base error class for all classifier-related errors.
 */
export class ClassifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassifierError";
  }
}

/**
 * Thrown when a classifier backend rejects a request at the API level (bad
 * credentials, malformed request, rate limit, etc). The originating error is
 * kept on {@link ClassifierCallError.cause}.
 */
export class ClassifierCallError extends ClassifierError {
  constructor(
    message: string,
    /** The underlying error thrown by the classifier SDK. */
    public cause?: unknown
  ) {
    super(message);
    this.name = "ClassifierCallError";
  }
}
