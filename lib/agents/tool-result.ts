/**
 * Turns a tool's return value into the text sent back to the model.
 *
 * Strings go through unchanged. Most tools return text — file contents, shell
 * output, logs — and `JSON.stringify` on a string produces a quoted literal
 * with every newline escaped as `\n`, so the model would read
 * `"line 1\nline 2"` instead of the output itself. Anything else (objects,
 * arrays, numbers, booleans, null) is serialized as JSON. `undefined` becomes
 * an empty string, since `JSON.stringify(undefined)` is not a string at all.
 */
export function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result) ?? "";
}
