import { History, Role } from "./History";

describe("History module", () => {
  let history: History;

  beforeEach(() => {
    history = new History([], {});
  });

  it("should add string entries correctly", () => {
    history.addEntry("assistant", "test message");
    expect(history.entries).toEqual([
      { role: "assistant", content: "test message" },
    ]);
  });

  it("should add object entries correctly", () => {
    const content = { text: "test object", value: 123 };
    history.addEntry("user", content);
    expect(history.entries).toEqual([{ role: "user", content }]);
  });

  it("should handle multiple entries", () => {
    history.addEntry("user", "user message");
    history.addEntry("assistant", "assistant response");
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]).toEqual({
      role: "user",
      content: "user message",
    });
    expect(history.entries[1]).toEqual({
      role: "assistant",
      content: "assistant response",
    });
  });

  it("should clear all entries", () => {
    history.addEntry("user", "test message");
    history.clear();
    expect(history.entries).toHaveLength(0);
  });

  it("should serialize to JSON and deserialize from JSON", () => {
    history.addEntry("user", "user message");
    history.addEntry("assistant", "assistant response");

    const json = history.toJSON();
    const deserializedHistory = History.fromJSON(json);

    expect(deserializedHistory.entries).toEqual(history.entries);
  });

  it("should return the size of the history", () => {
    history.clear();
    history.addEntry("user", "test message");
    history.addEntry("user", ["a", "b"]);

    expect(history.size).toEqual(14);
  });
});
