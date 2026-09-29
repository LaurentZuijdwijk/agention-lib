import { classifierToolGuard } from "./guard";
import { Classifier, ClassifyResult } from "./Classifier";
import { Tool } from "../tools/Tool";
import { ToolExecutionBlockedError } from "../tools/errors";

/** A fake classifier that resolves asynchronously, to prove guards are awaited. */
const fakeClassifier = (result: ClassifyResult): Classifier => ({
  classify: jest.fn(
    () => new Promise((resolve) => setTimeout(() => resolve(result), 10))
  ),
});

const mockInputSchema = {
  type: "object" as const,
  properties: { path: { type: "string" } },
};

describe("classifierToolGuard", () => {
  it("should allow execution when the classifier picks the allow choice", async () => {
    const classifier = fakeClassifier({ choice: "allow", confidence: 0.9 });
    const execute = jest.fn().mockResolvedValue("done");
    const tool = new Tool({
      name: "delete_file",
      description: "Deletes a file",
      inputSchema: mockInputSchema,
      execute,
    });
    tool.addGuard(classifierToolGuard(classifier));

    const result = await tool.execute("agentId", "agentName", { path: "/tmp/x" }, "id");

    expect(result).toBe("done");
    expect(execute).toHaveBeenCalled();
  });

  it("should block execution when the classifier picks the block choice", async () => {
    const classifier = fakeClassifier({ choice: "block", confidence: 0.95 });
    const execute = jest.fn().mockResolvedValue("done");
    const tool = new Tool({
      name: "delete_file",
      description: "Deletes a file",
      inputSchema: mockInputSchema,
      execute,
    });
    tool.addGuard(classifierToolGuard(classifier));

    await expect(
      tool.execute("agentId", "agentName", { path: "/tmp/x" }, "id")
    ).rejects.toThrow(ToolExecutionBlockedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("should surface a reason derived from the classify result", async () => {
    const classifier = fakeClassifier({ choice: "block", confidence: 0.8 });
    const tool = new Tool({
      name: "delete_file",
      description: "Deletes a file",
      inputSchema: mockInputSchema,
      execute: jest.fn(),
    });
    tool.addGuard(
      classifierToolGuard(classifier, {
        reason: (result) => `nope: ${result.confidence}`,
      })
    );

    await expect(
      tool.execute("agentId", "agentName", { path: "/tmp/x" }, "id")
    ).rejects.toThrow("nope: 0.8");
  });

  it("should not block a low-confidence block verdict when minConfidence is set", async () => {
    const classifier = fakeClassifier({ choice: "block", confidence: 0.3 });
    const execute = jest.fn().mockResolvedValue("done");
    const tool = new Tool({
      name: "delete_file",
      description: "Deletes a file",
      inputSchema: mockInputSchema,
      execute,
    });
    tool.addGuard(classifierToolGuard(classifier, { minConfidence: 0.7 }));

    const result = await tool.execute("agentId", "agentName", { path: "/tmp/x" }, "id");

    expect(result).toBe("done");
  });

  it("should pass tool/agent context to the classifier", async () => {
    const classify = jest.fn().mockResolvedValue({ choice: "allow" });
    const tool = new Tool({
      name: "delete_file",
      description: "Deletes a file",
      inputSchema: mockInputSchema,
      execute: jest.fn().mockResolvedValue("done"),
    });
    tool.addGuard(classifierToolGuard({ classify }));

    await tool.execute("agentId1", "Agent One", { path: "/tmp/x" }, "id");

    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          agentId: "agentId1",
          agentName: "Agent One",
          tool: "delete_file",
          input: { path: "/tmp/x" },
        }),
        options: ["allow", "block"],
      }),
      expect.anything()
    );
  });
});
