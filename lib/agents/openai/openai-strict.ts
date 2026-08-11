/**
 * OpenAI strict function schemas.
 *
 * `strict: true` is a stronger contract than JSON Schema: OpenAI requires
 * `required` to list *every* key in `properties`, so a tool with an optional
 * parameter is rejected with a 400 before the model ever runs. Sending it
 * unconditionally makes any such tool break the whole request — and since the
 * tool belt is identical on every retry, every request of the session fails.
 *
 * The alternative fix is to declare optional parameters as nullable and require
 * them anyway, per OpenAI's own guidance. In a library that is worse: it
 * changes the schema every *other* provider sees (Gemini does not accept a
 * `["string", "null"]` type union), and it makes each tool responsible for
 * telling an explicit null from an omitted argument. Deciding `strict` per tool
 * leaves the schemas untouched and keeps the guarantee for the tools that can
 * already honour it.
 */

/**
 * Whether OpenAI will accept this parameter schema under `strict: true`.
 *
 * Conservative on purpose: a false negative costs the schema-adherence
 * guarantee for one tool, a false positive costs the whole request. MCP tools
 * come from servers the host does not control, so "unrecognised shape" has to
 * mean no.
 */
export function canUseStrictSchema(parameters: unknown): boolean {
  if (!parameters || typeof parameters !== "object") return false;
  const schema = parameters as { properties?: unknown; required?: unknown };

  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, unknown>)
      : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  // Strict mode also wants `additionalProperties: false` on every nested
  // object, which `getToolDefinitions()` only sets at the top level. Rather
  // than rewrite anyone's schema, treat a nested object as reason enough to
  // drop the guarantee.
  const isNested = (property: unknown): boolean => {
    if (!property || typeof property !== "object") return false;
    const value = property as { type?: unknown; items?: unknown };
    return value.type === "object" || isNested(value.items);
  };

  return (
    Object.keys(properties).every((key) => required.includes(key)) &&
    !Object.values(properties).some(isNested)
  );
}
