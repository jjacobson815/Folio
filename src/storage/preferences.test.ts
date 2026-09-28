import { describe, expect, it } from "vitest";
import { MemoryStorage } from "@/test/memory-storage";
import { LEGACY_KEY, readLegacyWorkspace } from "./legacy";
import { readPreferences, SPLIT_LIMITS, writePreferences } from "./preferences";

describe("preferences", () => {
  it("round-trips through storage", () => {
    const storage = new MemoryStorage();
    writePreferences(storage, { theme: "brutalist", device: "mobile", splitRatio: 0.5 });
    expect(readPreferences(storage)).toEqual({ theme: "brutalist", device: "mobile", splitRatio: 0.5 });
  });

  it("drops malformed fields and clamps the split ratio", () => {
    const storage = new MemoryStorage();
    storage.setItem("folio-prefs", JSON.stringify({ version: 1, value: { theme: "neon", device: "desktop", splitRatio: 5 } }));
    expect(readPreferences(storage)).toEqual({ device: "desktop", splitRatio: SPLIT_LIMITS.max });
  });

  it("survives corrupt JSON and blocked storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("folio-prefs", "{not json");
    expect(readPreferences(storage)).toEqual({});
    expect(readPreferences(null)).toEqual({});

    const blocked = new MemoryStorage();
    blocked.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    blocked.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(readPreferences(blocked)).toEqual({});
    expect(() => writePreferences(blocked, { theme: "glass", device: "desktop", splitRatio: 0.4 })).not.toThrow();
  });
});

describe("legacy workspace", () => {
  it("reads the zustand blob written by the localStorage build", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, JSON.stringify({ state: { source: "# Jane", formatPreference: "markdown", theme: "minimal", device: "tablet", splitRatio: 0.3 }, version: 1 }));
    expect(readLegacyWorkspace(storage)).toEqual({
      source: "# Jane",
      formatPreference: "markdown",
      preferences: { theme: "minimal", device: "tablet", splitRatio: 0.3 },
    });
  });

  it("ignores missing or corrupt data", () => {
    const storage = new MemoryStorage();
    expect(readLegacyWorkspace(storage)).toBeNull();
    storage.setItem(LEGACY_KEY, "{not json");
    expect(readLegacyWorkspace(storage)).toBeNull();
    storage.setItem(LEGACY_KEY, JSON.stringify({ state: { formatPreference: "bogus" } }));
    expect(readLegacyWorkspace(storage)).toEqual({ source: null, formatPreference: "auto", preferences: {} });
  });
});
