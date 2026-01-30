import { ContextStore } from "./ContextStore";

describe("ContextStore", () => {
  describe("constructor", () => {
    it("should create an empty store by default", () => {
      const store = new ContextStore();
      expect(store.size).toBe(0);
      expect(store.keys()).toEqual([]);
    });

    it("should initialize with provided values", () => {
      const store = new ContextStore({ foo: "bar", count: 42 });
      expect(store.size).toBe(2);
      expect(store.get("foo")).toBe("bar");
      expect(store.get("count")).toBe(42);
    });
  });

  describe("set and get", () => {
    it("should store and retrieve string values", () => {
      const store = new ContextStore();
      store.set("key", "value");
      expect(store.get("key")).toBe("value");
    });

    it("should store and retrieve complex objects", () => {
      const store = new ContextStore();
      const data = { nested: { value: 123 }, array: [1, 2, 3] };
      store.set("data", data);
      expect(store.get("data")).toEqual(data);
    });

    it("should return undefined for non-existent keys", () => {
      const store = new ContextStore();
      expect(store.get("nonexistent")).toBeUndefined();
    });

    it("should overwrite existing values", () => {
      const store = new ContextStore();
      store.set("key", "first");
      store.set("key", "second");
      expect(store.get("key")).toBe("second");
    });

    it("should support typed get", () => {
      const store = new ContextStore();
      store.set("user", { name: "Alice", age: 30 });
      const user = store.get<{ name: string; age: number }>("user");
      expect(user?.name).toBe("Alice");
      expect(user?.age).toBe(30);
    });
  });

  describe("has", () => {
    it("should return true for existing keys", () => {
      const store = new ContextStore({ existing: "value" });
      expect(store.has("existing")).toBe(true);
    });

    it("should return false for non-existent keys", () => {
      const store = new ContextStore();
      expect(store.has("nonexistent")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing keys and return true", () => {
      const store = new ContextStore({ key: "value" });
      expect(store.delete("key")).toBe(true);
      expect(store.has("key")).toBe(false);
    });

    it("should return false for non-existent keys", () => {
      const store = new ContextStore();
      expect(store.delete("nonexistent")).toBe(false);
    });
  });

  describe("keys", () => {
    it("should return all keys", () => {
      const store = new ContextStore({ a: 1, b: 2, c: 3 });
      expect(store.keys().sort()).toEqual(["a", "b", "c"]);
    });

    it("should return empty array for empty store", () => {
      const store = new ContextStore();
      expect(store.keys()).toEqual([]);
    });
  });

  describe("size", () => {
    it("should return the number of entries", () => {
      const store = new ContextStore({ a: 1, b: 2 });
      expect(store.size).toBe(2);
      store.set("c", 3);
      expect(store.size).toBe(3);
      store.delete("a");
      expect(store.size).toBe(2);
    });
  });

  describe("toObject", () => {
    it("should return all entries as plain object", () => {
      const store = new ContextStore({ foo: "bar", num: 42 });
      expect(store.toObject()).toEqual({ foo: "bar", num: 42 });
    });

    it("should return empty object for empty store", () => {
      const store = new ContextStore();
      expect(store.toObject()).toEqual({});
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      const store = new ContextStore({ a: 1, b: 2, c: 3 });
      store.clear();
      expect(store.size).toBe(0);
      expect(store.keys()).toEqual([]);
    });
  });

  describe("clone", () => {
    it("should create independent copy", () => {
      const original = new ContextStore({ key: "value" });
      const clone = original.clone();

      // Modify original
      original.set("key", "modified");
      original.set("new", "entry");

      // Clone should be unchanged
      expect(clone.get("key")).toBe("value");
      expect(clone.has("new")).toBe(false);
    });
  });
});
