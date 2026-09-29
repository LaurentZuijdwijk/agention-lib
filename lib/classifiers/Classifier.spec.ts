import { isClassifier } from "./Classifier";

describe("isClassifier", () => {
  it("should return true for an object with a classify function", () => {
    const classifier = { classify: async () => ({ choice: "a" }) };
    expect(isClassifier(classifier)).toBe(true);
  });

  it("should return false for an object without a classify function", () => {
    expect(isClassifier({ execute: async () => "hi" })).toBe(false);
  });

  it("should return false for a classify property that isn't a function", () => {
    expect(isClassifier({ classify: "not a function" })).toBe(false);
  });

  it("should return false for null and non-objects", () => {
    expect(isClassifier(null)).toBe(false);
    expect(isClassifier(undefined)).toBe(false);
    expect(isClassifier("classify")).toBe(false);
    expect(isClassifier(42)).toBe(false);
  });
});
