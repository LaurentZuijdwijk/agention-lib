import { History, text, textMessage } from "./History";

describe("History module", () => {
  let history: History;

  beforeEach(() => {
    history = new History([], {});
  });

  it("should add text entries correctly", () => {
    history.addText("assistant", "test message");
    expect(history.entries).toEqual([
      { role: "assistant", content: [{ type: "text", text: "test message" }] },
    ]);
  });

  it("should add entry with content blocks", () => {
    history.addEntry({
      role: "user",
      content: [text("hello"), text("world")],
    });
    expect(history.entries).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
    ]);
  });

  it("should handle multiple entries", () => {
    history.addText("user", "user message");
    history.addText("assistant", "assistant response");
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "user message" }],
    });
    expect(history.entries[1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "assistant response" }],
    });
  });

  it("should clear all entries", () => {
    history.addText("user", "test message");
    history.clear();
    expect(history.entries).toHaveLength(0);
  });

  it("should serialize to JSON and deserialize from JSON", () => {
    history.addText("user", "user message");
    history.addText("assistant", "assistant response");

    const json = history.toJSON();
    const deserializedHistory = History.fromJSON(json);

    expect(deserializedHistory.entries).toEqual(history.entries);
  });

  it("should return the size of the history", () => {
    history.clear();
    history.addText("user", "test message");
    history.addEntry({
      role: "user",
      content: [text("a"), text("b")],
    });

    expect(history.size).toBeGreaterThan(0);
  });

  it("should add system messages", () => {
    history.addSystem("You are a helpful assistant");
    expect(history.entries[0].role).toBe("system");
    expect(history.getSystemMessage()).toBe("You are a helpful assistant");
  });

  it("should get messages without system", () => {
    history.addSystem("System prompt");
    history.addText("user", "Hello");
    history.addText("assistant", "Hi there");

    const messages = history.getMessagesWithoutSystem();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
  });

  it("should create entries using textMessage helper", () => {
    const entry = textMessage("user", "Hello");
    expect(entry).toEqual({
      role: "user",
      content: [{ type: "text", text: "Hello" }],
    });
  });

  it("should clone history", () => {
    history.addText("user", "test");
    const cloned = history.clone();
    expect(cloned.entries).toEqual(history.entries);

    // Ensure they are independent
    cloned.addText("assistant", "response");
    expect(cloned.length).toBe(2);
    expect(history.length).toBe(1);
  });
});
