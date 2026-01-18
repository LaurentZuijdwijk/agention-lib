// @ts-nocheck
import { Pipeline } from "./Pipeline";
import { GraphNode } from "./BaseExecutor";

// Mock GraphNode factory
const createMockNode = <TIn, TOut>(
  transform: (input: TIn) => TOut
): GraphNode<TIn, TOut> => {
  return {
    execute: jest.fn().mockImplementation(async (input: TIn) => transform(input)),
  };
};

describe("Pipeline", () => {
  describe("constructor", () => {
    it("should create empty pipeline", () => {
      const pipeline = new Pipeline();
      expect(pipeline.length).toBe(0);
    });

    it("should create pipeline with stages", () => {
      const stage1 = createMockNode((x: string) => x.toUpperCase());
      const stage2 = createMockNode((x: string) => x + "!");
      const pipeline = new Pipeline(stage1, stage2);

      expect(pipeline.length).toBe(2);
    });
  });

  describe("addStage", () => {
    it("should add stage to pipeline", () => {
      const pipeline = new Pipeline();
      const stage = createMockNode((x: string) => x);

      pipeline.addStage(stage);

      expect(pipeline.length).toBe(1);
    });

    it("should return pipeline for chaining", () => {
      const pipeline = new Pipeline();
      const stage1 = createMockNode((x: string) => x);
      const stage2 = createMockNode((x: string) => x);

      const result = pipeline.addStage(stage1).addStage(stage2);

      expect(result).toBe(pipeline);
      expect(pipeline.length).toBe(2);
    });
  });

  describe("execute", () => {
    it("should return input when no stages", async () => {
      const pipeline = new Pipeline<string, string>();
      const result = await pipeline.execute("test input");

      expect(result).toBe("test input");
    });

    it("should execute single stage", async () => {
      const stage = createMockNode((x: string) => x.toUpperCase());
      const pipeline = new Pipeline(stage);

      const result = await pipeline.execute("hello");

      expect(result).toBe("HELLO");
      expect(stage.execute).toHaveBeenCalledWith("hello");
    });

    it("should chain stages in sequence", async () => {
      const stage1 = createMockNode((x: string) => x.toUpperCase());
      const stage2 = createMockNode((x: string) => x + "!");
      const stage3 = createMockNode((x: string) => x.repeat(2));
      const pipeline = new Pipeline(stage1, stage2, stage3);

      const result = await pipeline.execute("hi");

      expect(result).toBe("HI!HI!");
    });

    it("should pass output of each stage to next stage", async () => {
      const stage1 = createMockNode((x: string) => x + "-1");
      const stage2 = createMockNode((x: string) => x + "-2");
      const pipeline = new Pipeline(stage1, stage2);

      await pipeline.execute("start");

      expect(stage1.execute).toHaveBeenCalledWith("start");
      expect(stage2.execute).toHaveBeenCalledWith("start-1");
    });

    it("should handle type transformations between stages", async () => {
      const stage1 = createMockNode((x: string) => x.split(","));
      const stage2 = createMockNode((x: string[]) => x.length);
      const stage3 = createMockNode((x: number) => x * 2);
      const pipeline = new Pipeline(stage1, stage2, stage3);

      const result = await pipeline.execute("a,b,c");

      expect(result).toBe(6);
    });

    it("should handle object inputs and outputs", async () => {
      const stage1 = createMockNode((x: { name: string }) => ({
        ...x,
        greeting: `Hello ${x.name}`,
      }));
      const stage2 = createMockNode(
        (x: { name: string; greeting: string }) => x.greeting
      );
      const pipeline = new Pipeline(stage1, stage2);

      const result = await pipeline.execute({ name: "World" });

      expect(result).toBe("Hello World");
    });

    it("should propagate errors from stages", async () => {
      const stage1 = createMockNode((x: string) => x);
      const stage2: GraphNode = {
        execute: jest.fn().mockRejectedValue(new Error("Stage failed")),
      };
      const pipeline = new Pipeline(stage1, stage2);

      await expect(pipeline.execute("test")).rejects.toThrow("Stage failed");
    });

    it("should stop execution on error", async () => {
      const stage1 = createMockNode((x: string) => x);
      const stage2: GraphNode = {
        execute: jest.fn().mockRejectedValue(new Error("Stage failed")),
      };
      const stage3 = createMockNode((x: string) => x);
      const pipeline = new Pipeline(stage1, stage2, stage3);

      await expect(pipeline.execute("test")).rejects.toThrow("Stage failed");

      expect(stage1.execute).toHaveBeenCalled();
      expect(stage2.execute).toHaveBeenCalled();
      expect(stage3.execute).not.toHaveBeenCalled();
    });
  });

  describe("integration with addStage", () => {
    it("should execute stages added via addStage", async () => {
      const pipeline = new Pipeline<string, string>();
      const stage1 = createMockNode((x: string) => x.toUpperCase());
      const stage2 = createMockNode((x: string) => x + "!");

      pipeline.addStage(stage1).addStage(stage2);

      const result = await pipeline.execute("hello");

      expect(result).toBe("HELLO!");
    });

    it("should handle mixed constructor and addStage stages", async () => {
      const stage1 = createMockNode((x: number) => x * 2);
      const pipeline = new Pipeline(stage1);

      const stage2 = createMockNode((x: number) => x + 10);
      pipeline.addStage(stage2);

      const result = await pipeline.execute(5);

      expect(result).toBe(20); // (5 * 2) + 10
    });
  });
});
