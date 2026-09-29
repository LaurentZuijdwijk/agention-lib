// @ts-nocheck
import { JevClassifier } from "./JevClassifier";
import { ClassifierCallError } from "./errors";

// Virtual mock for @typesafe-ai/sdk — tests don't depend on the real package's behavior.
const mockSystemOne = jest.fn();
const MockTypeSafeClient = jest.fn().mockImplementation((config) => {
  MockTypeSafeClient.lastConfig = config;
  return { systemOne: mockSystemOne };
});
const mockChoice = jest.fn((instructions, criteria) => ({
  type: "choice",
  instructions,
  criteria,
}));

jest.mock(
  "@typesafe-ai/sdk",
  () => ({ TypeSafeClient: MockTypeSafeClient, choice: mockChoice }),
  { virtual: true }
);

describe("JevClassifier", () => {
  beforeEach(() => {
    MockTypeSafeClient.mockClear();
    mockSystemOne.mockReset();
    mockChoice.mockClear();
  });

  it("should not construct the SDK client until classify() is called", () => {
    new JevClassifier({ apiKey: "key" });
    expect(MockTypeSafeClient).not.toHaveBeenCalled();
  });

  it("should forward config to the SDK client", async () => {
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "billing", confidence: 0.9, probabilities: {} } },
    });

    const classifier = new JevClassifier({
      apiKey: "key",
      baseURL: "https://example.com",
      model: "jev-latest",
      timeout: 5000,
      vendorConfig: { jev: { logLevel: "debug" } },
    });
    await classifier.classify({
      context: "some text",
      question: "What is this about?",
      options: ["billing", "technical"],
    });

    expect(MockTypeSafeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "key",
        baseURL: "https://example.com",
        defaultModel: "jev-latest",
        timeout: 5000,
        logLevel: "debug",
      })
    );
  });

  it("should reuse the same client across calls", async () => {
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "a", confidence: 1, probabilities: {} } },
    });

    const classifier = new JevClassifier({ apiKey: "key" });
    await classifier.classify({ context: "x", question: "q", options: ["a", "b"] });
    await classifier.classify({ context: "y", question: "q", options: ["a", "b"] });

    expect(MockTypeSafeClient).toHaveBeenCalledTimes(1);
  });

  it("should map a choice answer to a ClassifyResult", async () => {
    mockSystemOne.mockResolvedValue({
      answers: {
        decision: { choice: "billing", confidence: 0.87, probabilities: { billing: 0.87, technical: 0.13 } },
      },
    });

    const classifier = new JevClassifier({ apiKey: "key" });
    const result = await classifier.classify({
      context: { ticket: "I was charged twice." },
      question: "What is this ticket about?",
      options: ["billing", "technical"],
    });

    expect(result.choice).toBe("billing");
    expect(result.confidence).toBe(0.87);
    expect(result.probabilities).toEqual({ billing: 0.87, technical: 0.13 });
    expect(result.raw).toBeDefined();
    expect(mockChoice).toHaveBeenCalledWith("What is this ticket about?", {
      billing: null,
      technical: null,
    });
  });

  it("should send optionDescriptions as the choice criteria", async () => {
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "a", confidence: 1, probabilities: {} } },
    });

    const classifier = new JevClassifier({ apiKey: "key" });
    await classifier.classify({
      context: "x",
      question: "q",
      options: ["a", "b"],
      optionDescriptions: { a: "Billing questions" },
    });

    expect(mockChoice).toHaveBeenCalledWith("q", {
      a: "Billing questions",
      b: null,
    });
  });

  it("should build one client for concurrent first calls", async () => {
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "a", confidence: 1, probabilities: {} } },
    });

    const classifier = new JevClassifier({ apiKey: "key" });
    await Promise.all([
      classifier.classify({ context: "x", question: "q", options: ["a", "b"] }),
      classifier.classify({ context: "y", question: "q", options: ["a", "b"] }),
    ]);

    expect(MockTypeSafeClient).toHaveBeenCalledTimes(1);
  });

  it("should wrap a client construction failure and retry on the next call", async () => {
    MockTypeSafeClient.mockImplementationOnce(() => {
      throw new Error("Missing API key");
    });
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "a", confidence: 1, probabilities: {} } },
    });

    const classifier = new JevClassifier();
    const request = { context: "x", question: "q", options: ["a", "b"] };

    await expect(classifier.classify(request)).rejects.toThrow(ClassifierCallError);
    await expect(classifier.classify(request)).resolves.toMatchObject({ choice: "a" });
    expect(MockTypeSafeClient).toHaveBeenCalledTimes(2);
  });

  it("should forward signal and timeout to systemOne", async () => {
    mockSystemOne.mockResolvedValue({
      answers: { decision: { choice: "a", confidence: 1, probabilities: {} } },
    });
    const controller = new AbortController();

    const classifier = new JevClassifier({ apiKey: "key" });
    await classifier.classify(
      { context: "x", question: "q", options: ["a", "b"] },
      { signal: controller.signal, timeout: 2000 }
    );

    expect(mockSystemOne).toHaveBeenCalledWith(
      expect.anything(),
      { signal: controller.signal, timeout: 2000 }
    );
  });

  it("should wrap a genuine SDK failure in a ClassifierCallError", async () => {
    mockSystemOne.mockRejectedValue(new Error("rate limited"));

    const classifier = new JevClassifier({ apiKey: "key" });

    await expect(
      classifier.classify({ context: "x", question: "q", options: ["a", "b"] })
    ).rejects.toThrow(ClassifierCallError);
  });

  it("should rethrow a cancellation unwrapped", async () => {
    const controller = new AbortController();
    mockSystemOne.mockImplementation(async () => {
      controller.abort();
      throw Object.assign(new Error("aborted"), { name: "APIUserAbortError" });
    });

    const classifier = new JevClassifier({ apiKey: "key" });

    await expect(
      classifier.classify(
        { context: "x", question: "q", options: ["a", "b"] },
        { signal: controller.signal }
      )
    ).rejects.toThrow("aborted");
    await expect(
      classifier.classify(
        { context: "x", question: "q", options: ["a", "b"] },
        { signal: controller.signal }
      )
    ).rejects.not.toBeInstanceOf(ClassifierCallError);
  });
});
