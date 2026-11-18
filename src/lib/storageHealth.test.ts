import { afterEach, describe, expect, it, vi } from "vitest";
import { backupAgeDays, readPersistence, requestPersistence } from "./storageHealth";

describe("backup age", () => {
  const now = new Date("2026-11-18T12:00:00Z").getTime();

  it("counts whole days since the last export", () => {
    expect(backupAgeDays("2026-11-18T09:00:00Z", now)).toBe(0);
    expect(backupAgeDays("2026-11-11T12:00:00Z", now)).toBe(7);
    expect(backupAgeDays("2026-09-01T00:00:00Z", now)).toBe(78);
  });

  it("treats a future stamp as today instead of a negative age", () => {
    expect(backupAgeDays("2026-11-19T12:00:00Z", now)).toBe(0);
  });

  it("reports no age for a missing or unusable stamp", () => {
    expect(backupAgeDays(null, now)).toBeNull();
    expect(backupAgeDays("", now)).toBeNull();
    expect(backupAgeDays("not a date", now)).toBeNull();
    expect(backupAgeDays(42, now)).toBeNull();
  });
});

describe("storage persistence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports unsupported when the browser has no StorageManager", async () => {
    vi.stubGlobal("navigator", {});
    await expect(readPersistence()).resolves.toBe("unsupported");
    await expect(requestPersistence()).resolves.toBe("unsupported");
  });

  it("reports granted once the origin is persistent", async () => {
    vi.stubGlobal("navigator", {
      storage: { persisted: async () => true, persist: async () => true },
    });
    await expect(readPersistence()).resolves.toBe("granted");
    await expect(requestPersistence()).resolves.toBe("granted");
  });

  it("falls back to best-effort when the browser declines or throws", async () => {
    vi.stubGlobal("navigator", {
      storage: { persisted: async () => false, persist: async () => false },
    });
    await expect(readPersistence()).resolves.toBe("best-effort");
    await expect(requestPersistence()).resolves.toBe("best-effort");

    vi.stubGlobal("navigator", {
      storage: {
        persisted: async () => {
          throw new Error("blocked");
        },
        persist: async () => {
          throw new Error("blocked");
        },
      },
    });
    await expect(readPersistence()).resolves.toBe("best-effort");
    await expect(requestPersistence()).resolves.toBe("best-effort");
  });
});
