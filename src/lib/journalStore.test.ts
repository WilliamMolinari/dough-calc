// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  failureReason,
  listSnapshots,
  loadJournalFromDb,
  loadSnapshot,
  resetJournalDbCache,
  saveJournalToDb,
  saveSnapshot,
  MAX_SNAPSHOTS,
} from "./journalDb";
import {
  hydrateJournal,
  maybeSnapshot,
  persistJournal,
  shouldSnapshot,
  SNAPSHOT_INTERVAL_MS,
} from "./journalStore";
import { STORAGE_KEYS, writeStored } from "./storage";
import type { BakeEntry } from "./types";
import { BASE_FORMULA } from "./presets";

function makeBake(id: string, overrides: Partial<BakeEntry> = {}): BakeEntry {
  return {
    id,
    createdAt: "2026-11-01T09:00:00.000Z",
    name: id,
    styleId: "neapolitan",
    styleName: "Neapolitan",
    formula: { ...BASE_FORMULA },
    unit: "g",
    ratings: { crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 },
    notes: "",
    flourBrand: "",
    oven: "",
    tags: [],
    photos: [],
    totalDough: 1000,
    ...overrides,
  };
}

/** Clears every store without deleting the database (which stays open). */
async function clearDatabase(): Promise<void> {
  const open = indexedDB.open("doughlab");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const names = Array.from(db.objectStoreNames);
  if (names.length) {
    const tx = db.transaction(names, "readwrite");
    for (const name of names) tx.objectStore(name).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  db.close();
}

beforeEach(async () => {
  resetJournalDbCache();
  localStorage.clear();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await clearDatabase();
});

describe("hydrateJournal", () => {
  it("reports an empty database as the source", async () => {
    const result = await hydrateJournal();
    expect(result.dbAvailable).toBe(true);
    expect(result.source).toBe("db");
    expect(result.bakes).toEqual([]);
  });

  it("migrates the localStorage mirror once, then reads the database", async () => {
    writeStored(STORAGE_KEYS.bakes, [makeBake("a")]);

    const first = await hydrateJournal();
    expect(first.migrated).toBe(true);
    expect(first.source).toBe("mirror");
    expect(first.bakes.map((bake) => bake.id)).toEqual(["a"]);

    const second = await hydrateJournal();
    expect(second.migrated).toBe(false);
    expect(second.source).toBe("db");
    expect(second.bakes.map((bake) => bake.id)).toEqual(["a"]);
  });

  it("prefers the database over a stale mirror", async () => {
    await persistJournal([makeBake("from-db")]);
    writeStored(STORAGE_KEYS.bakes, [makeBake("from-mirror")]);

    const result = await hydrateJournal();
    expect(result.source).toBe("db");
    expect(result.bakes.map((bake) => bake.id)).toEqual(["from-db"]);
  });

  it("falls back to the mirror when IndexedDB does not exist", async () => {
    writeStored(STORAGE_KEYS.bakes, [makeBake("mirror-only")]);
    vi.stubGlobal("indexedDB", undefined);
    try {
      const result = await hydrateJournal();
      expect(result.dbAvailable).toBe(false);
      expect(result.source).toBe("mirror");
      expect(result.bakes.map((bake) => bake.id)).toEqual(["mirror-only"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("persistJournal", () => {
  it("drops photo bytes from the mirror only after the database keeps them", async () => {
    const photo = "data:image/jpeg;base64,AAAA";
    const result = await persistJournal([makeBake("a", { photos: [photo] })]);
    expect(result.dbSaved).toBe(true);
    expect(result.mirrorOk).toBe(true);

    const mirror = JSON.parse(localStorage.getItem(STORAGE_KEYS.bakes) ?? "[]");
    expect(mirror[0].photos).toEqual([]);

    const loaded = await loadJournalFromDb();
    expect(loaded.ok && loaded.bakes?.[0].photos).toEqual([photo]);
  });

  it("keeps the whole journal in the mirror when the database is unavailable", async () => {
    const photo = "data:image/jpeg;base64,AAAA";
    vi.stubGlobal("indexedDB", undefined);
    try {
      const result = await persistJournal([makeBake("a", { photos: [photo] })]);
      expect(result.dbSaved).toBe(false);
      expect(result.mirrorOk).toBe(true);

      const mirror = JSON.parse(localStorage.getItem(STORAGE_KEYS.bakes) ?? "[]");
      expect(mirror[0].photos).toEqual([photo]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("writes only the bake that changed", async () => {
    const first = makeBake("a");
    const second = makeBake("b", { createdAt: "2026-10-01T09:00:00.000Z" });
    await saveJournalToDb([first, second]);

    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    try {
      await saveJournalToDb([{ ...first, notes: "wetter" }, second]);
      const writes = put.mock.contexts.filter(
        (store) => (store as IDBObjectStore).name === "bakes",
      );
      expect(writes).toHaveLength(1);
    } finally {
      put.mockRestore();
    }
  });

  it("removes deleted bakes and preserves journal order", async () => {
    const a = makeBake("a");
    const b = makeBake("b", { createdAt: "2026-10-01T09:00:00.000Z" });
    const c = makeBake("c", { createdAt: "2026-09-01T09:00:00.000Z" });
    await saveJournalToDb([c, a, b]);

    const loaded = await loadJournalFromDb();
    expect(loaded.ok && loaded.bakes?.map((bake) => bake.id)).toEqual(["c", "a", "b"]);

    await saveJournalToDb([c, b]);
    const afterDelete = await loadJournalFromDb();
    expect(afterDelete.ok && afterDelete.bakes?.map((bake) => bake.id)).toEqual(["c", "b"]);
  });
});

describe("snapshots", () => {
  it("stores, lists newest first, restores and prunes to the limit", async () => {
    const base = Date.now() - 60 * 60_000;
    for (let index = 0; index < MAX_SNAPSHOTS + 2; index += 1) {
      await saveSnapshot([makeBake(`bake-${index}`)], "auto", base + index * 1000);
    }

    const list = await listSnapshots();
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(new Date(list[0].at).getTime()).toBeGreaterThan(new Date(list[1].at).getTime());

    const restored = await loadSnapshot(list[0].id);
    expect(restored?.[0].id).toBe(`bake-${MAX_SNAPSHOTS + 1}`);
    expect(list[0].photos).toBe(false);
  });

  it("records whether photos were included", async () => {
    const meta = await saveSnapshot([
      makeBake("with-photo", { photos: ["data:image/jpeg;base64,AAAA"] }),
    ]);
    expect(meta?.photos).toBe(true);
    expect(meta?.count).toBe(1);
  });

  it("only takes an automatic snapshot when the rules say so", async () => {
    const now = Date.now();
    expect(shouldSnapshot({ lastAt: null, now, previousCount: 2, nextCount: 2 })).toBe(true);
    expect(
      shouldSnapshot({
        lastAt: new Date(now - 60_000).toISOString(),
        now,
        previousCount: 2,
        nextCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldSnapshot({
        lastAt: new Date(now - 60_000).toISOString(),
        now,
        previousCount: 3,
        nextCount: 2,
      }),
    ).toBe(true);
    expect(
      shouldSnapshot({
        lastAt: new Date(now - SNAPSHOT_INTERVAL_MS - 1000).toISOString(),
        now,
        previousCount: 2,
        nextCount: 2,
      }),
    ).toBe(true);

    expect(await maybeSnapshot([], 0)).toBeNull();
    const taken = await maybeSnapshot([makeBake("a")], 1, now);
    expect(taken).not.toBeNull();
    // A second change a moment later is inside the interval: no extra snapshot.
    expect(await maybeSnapshot([makeBake("a")], 1, now + 1000)).toBeNull();
  });

  it("classifies a full disk as a quota failure", () => {
    expect(failureReason(new DOMException("full", "QuotaExceededError"))).toBe("quota");
    expect(failureReason(new Error("IndexedDB is blocked by another tab"))).toBe("blocked");
    expect(failureReason(new Error("something odd"))).toBe("unknown");
  });
});
