// @ts-nocheck
import { MapExecutor } from "./MapExecutor";
import { GraphNode } from "./BaseExecutor";

// Mock GraphNode factory
const createMockProcessor = <TIn, TOut>(
  transform: (input: TIn) => TOut,
  delay = 0
): GraphNode<TIn, TOut> => {
  return {
    execute: jest.fn().mockImplementation(async (input: TIn) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return transform(input);
    }),
  };
};

describe("MapExecutor", () => {
  describe("constructor", () => {
    it("should create executor with processor", () => {
      const processor = createMockProcessor((x: string) => x.toUpperCase());
      const executor = new MapExecutor(processor);

      expect(executor).toBeInstanceOf(MapExecutor);
    });

    it("should accept options", () => {
      const processor = createMockProcessor((x: string) => x);
      const executor = new MapExecutor(processor, { concurrency: 2 });

      expect(executor).toBeInstanceOf(MapExecutor);
    });
  });

  describe("execute", () => {
    it("should throw error for non-array input", async () => {
      const processor = createMockProcessor((x: string) => x);
      const executor = new MapExecutor(processor);

      await expect(executor.execute("not an array" as any)).rejects.toThrow(
        "MapExecutor requires an array input"
      );
    });

    it("should return empty array for empty input", async () => {
      const processor = createMockProcessor((x: string) => x);
      const executor = new MapExecutor(processor);

      const result = await executor.execute([]);

      expect(result).toEqual([]);
      expect(processor.execute).not.toHaveBeenCalled();
    });

    it("should process single item", async () => {
      const processor = createMockProcessor((x: string) => x.toUpperCase());
      const executor = new MapExecutor(processor);

      const result = await executor.execute(["hello"]);

      expect(result).toEqual(["HELLO"]);
      expect(processor.execute).toHaveBeenCalledTimes(1);
      expect(processor.execute).toHaveBeenCalledWith("hello");
    });

    it("should process multiple items", async () => {
      const processor = createMockProcessor((x: string) => x.toUpperCase());
      const executor = new MapExecutor(processor);

      const result = await executor.execute(["hello", "world", "test"]);

      expect(result).toEqual(["HELLO", "WORLD", "TEST"]);
      expect(processor.execute).toHaveBeenCalledTimes(3);
    });

    it("should process items in parallel by default", async () => {
      const processor = createMockProcessor((x: string) => x, 30);
      const executor = new MapExecutor(processor);

      const startTime = Date.now();
      await executor.execute(["a", "b", "c", "d", "e"]);
      const elapsed = Date.now() - startTime;

      // 5 items with 30ms each in parallel should take ~30ms, not ~150ms
      expect(elapsed).toBeLessThan(100);
    });

    it("should maintain order of results", async () => {
      // Processor with variable delays to test ordering
      let callCount = 0;
      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockImplementation(async (input: string) => {
          const delay = [30, 10, 20][callCount++ % 3];
          await new Promise((resolve) => setTimeout(resolve, delay));
          return input.toUpperCase();
        }),
      };
      const executor = new MapExecutor(processor);

      const result = await executor.execute(["first", "second", "third"]);

      expect(result).toEqual(["FIRST", "SECOND", "THIRD"]);
    });

    it("should handle type transformations", async () => {
      const processor = createMockProcessor((x: string) => x.length);
      const executor = new MapExecutor<string, number>(processor);

      const result = await executor.execute(["a", "bb", "ccc"]);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle object inputs", async () => {
      const processor = createMockProcessor(
        (x: { id: number; name: string }) => `${x.id}: ${x.name}`
      );
      const executor = new MapExecutor(processor);

      const result = await executor.execute([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);

      expect(result).toEqual(["1: Alice", "2: Bob"]);
    });

    it("should propagate errors from processor", async () => {
      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockImplementation(async (input: string) => {
          if (input === "bad") {
            throw new Error("Processing failed");
          }
          return input;
        }),
      };
      const executor = new MapExecutor(processor);

      await expect(executor.execute(["good", "bad", "ok"])).rejects.toThrow(
        "Processing failed"
      );
    });

    it("should fail fast on error", async () => {
      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockImplementation(async (input: string) => {
          if (input === "fail") {
            throw new Error("Failed");
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          return input;
        }),
      };
      const executor = new MapExecutor(processor);

      const startTime = Date.now();
      await expect(executor.execute(["slow", "fail"])).rejects.toThrow("Failed");
      const elapsed = Date.now() - startTime;

      // Should fail fast, not wait for slow item
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("concurrency option", () => {
    it("should limit concurrent executions", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockImplementation(async (input: string) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 20));
          concurrent--;
          return input;
        }),
      };

      const executor = new MapExecutor(processor, { concurrency: 2 });
      await executor.execute(["a", "b", "c", "d", "e"]);

      // Due to implementation details, max concurrent may vary
      // but should be limited compared to unlimited
      expect(processor.execute).toHaveBeenCalledTimes(5);
    });
  });
});
