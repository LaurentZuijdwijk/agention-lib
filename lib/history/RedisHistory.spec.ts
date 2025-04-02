import { RedisHistory } from "./RedisHistory";

// Mock Redis instance interface
interface MockRedisInstance {
  get: jest.Mock;
  set: jest.Mock;
}

describe("RedisHistory", () => {
  let redisInstance: MockRedisInstance;
  let redisHistory: RedisHistory;

  beforeEach(() => {
    // Create a mock Redis instance before each test
    redisInstance = {
      get: jest.fn(),
      set: jest.fn(),
    };

    // Create a new RedisHistory instance with the mock Redis
    redisHistory = new RedisHistory(redisInstance as any);
  });

  describe("save method", () => {
    it("should save history to Redis successfully", async () => {
      // Arrange
      redisInstance.set.mockResolvedValue("OK");
      redisHistory.addEntry("user", "Test message");

      // Act
      await redisHistory.save("conversation:test");

      // Assert
      expect(redisInstance.set).toHaveBeenCalledWith(
        "conversation:test",
        expect.any(String)
      );
    });

    it("should throw an error if Redis save fails", async () => {
      // Arrange
      const saveError = new Error("Redis save failed");
      redisInstance.set.mockRejectedValue(saveError);
      redisHistory.addEntry("user", "Test message");

      // Act & Assert
      await expect(redisHistory.save("conversation:test")).rejects.toThrow(
        "Failed to save history: Redis save failed"
      );
    });
  });

  describe("load method", () => {
    it("should load history from Redis successfully", async () => {
      // Arrange
      const mockHistoryEntries = JSON.stringify([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      redisInstance.get.mockResolvedValue(mockHistoryEntries);

      // Act
      await redisHistory.load("conversation:test");

      // Assert
      expect(redisInstance.get).toHaveBeenCalledWith("conversation:test");
      expect(redisHistory.entries.length).toBe(2);
      expect(redisHistory.entries[0].role).toBe("user");
      expect(redisHistory.entries[0].content).toBe("Hello");
    });

    it("should handle empty history gracefully", async () => {
      // Arrange
      redisInstance.get.mockResolvedValue(null);

      // Act
      await redisHistory.load("conversation:empty");

      // Assert
      expect(redisHistory.entries.length).toBe(0);
    });

    it("should throw an error if Redis load fails", async () => {
      // Arrange
      const loadError = new Error("Redis load failed");
      redisInstance.get.mockRejectedValue(loadError);

      // Act & Assert
      await expect(redisHistory.load("conversation:test")).rejects.toThrow(
        "Failed to load history: Redis load failed"
      );
    });
  });

  describe("save and load integration", () => {
    it("should be able to save and load history correctly", async () => {
      // Arrange
      redisInstance.set.mockResolvedValue("OK");
      redisInstance.get.mockImplementation((key) => {
        if (key === "conversation:integration") {
          return Promise.resolve(
            JSON.stringify([{ role: "user", content: "Test message" }])
          );
        }
        return Promise.resolve(null);
      });

      // Add some entries
      redisHistory.addEntry("user", "Test message");
      await redisHistory.save("conversation:integration");

      // Create a new history instance and load
      const newRedisHistory = new RedisHistory(redisInstance as any);
      await newRedisHistory.load("conversation:integration");

      // Assert
      expect(newRedisHistory.entries.length).toBe(1);
      expect(newRedisHistory.entries[0].content).toBe("Test message");
    });
  });

  describe("error handling", () => {
    it("should log errors during save", async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const saveError = new Error("Redis save failed");
      redisInstance.set.mockRejectedValue(saveError);

      // Act
      await expect(redisHistory.save("conversation:test")).rejects.toThrow();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error saving history to Redis key"),
        saveError
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it("should log errors during load", async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const loadError = new Error("Redis load failed");
      redisInstance.get.mockRejectedValue(loadError);

      // Act
      await expect(redisHistory.load("conversation:test")).rejects.toThrow();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error loading history from Redis key"),
        loadError
      );

      // Cleanup
      consoleSpy.mockRestore();
    });
  });
});
