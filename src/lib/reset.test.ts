// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { listSnapshots, loadJournalFromDb, resetJournalDbCache, saveSnapshot } from "./journalDb";
import { persistJournal } from "./journalStore";
import { hydrateJournal } from "./journalStore";
import { clearAllData, isAppStorageKey } from "./reset";
import { STORAGE_KEYS, writeStored } from "./storage";
import { BASE_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

const bake: BakeEntry = {
  id: "bake-1",
  createdAt: "2026-11-01T09:00:00.000Z",
  name: "Friday",
  styleId: "new-york",
  styleName: "New York",
  formula: { ...BASE_FORMULA },
  unit: "g",
  ratings: { crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 },
  notes: "",
  flourBrand: "",
  oven: "",
  tags: [],
  photos: ["data:image/jpeg;base64,AAAA"],
  totalDough: 1000,
};

async function clearDatabase(): Promise<void> {
  const request = indexedDB.open("doughlab");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

describe("clear all data", () => {
  it("empties the journal, its photos and restore points", async () => {
    await persistJournal([bake]);
    await saveSnapshot([bake], "manual");

    const result = await clearAllData();
    expect(result.database).toBe(true);
    expect(result.keysRemoved).toBeGreaterThan(0);

    const loaded = await loadJournalFromDb();
    expect(loaded.ok && loaded.bakes).toBeNull();
    expect(await listSnapshots()).toEqual([]);

    const hydrated = await hydrateJournal();
    expect(hydrated.bakes).toEqual([]);
  });

  it("removes DoughLab preferences but leaves other apps alone", async () => {
    writeStored(STORAGE_KEYS.formula, BASE_FORMULA);
    writeStored(STORAGE_KEYS.bakes, [bake]);
    localStorage.setItem("other-app.setting", "keep me");

    await clearAllData();

    expect(localStorage.getItem(STORAGE_KEYS.formula)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.bakes)).toBeNull();
    expect(localStorage.getItem("other-app.setting")).toBe("keep me");
  });

  it("accepts writes again afterwards", async () => {
    await persistJournal([bake]);
    await clearAllData();

    const fresh: BakeEntry = { ...bake, id: "after-wipe", photos: [] };
    const saved = await persistJournal([fresh]);
    expect(saved.dbSaved).toBe(true);

    const loaded = await loadJournalFromDb();
    expect(loaded.ok && loaded.bakes?.map((entry) => entry.id)).toEqual(["after-wipe"]);
  });

  it("knows which keys it owns", () => {
    expect(isAppStorageKey("doughlab.formula.v1")).toBe(true);
    expect(isAppStorageKey("other-app.setting")).toBe(false);
  });
});
