// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { loadJournalFromDb, resetJournalDbCache } from "./journalDb";
import { hydrateJournal } from "./journalStore";
import { BASE_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

const legacyBake: BakeEntry = {
  id: "legacy-1",
  createdAt: "2026-01-02T09:00:00.000Z",
  name: "Old Friday",
  styleId: "new-york",
  styleName: "New York",
  formula: { ...BASE_FORMULA },
  unit: "g",
  ratings: { crust: 3, crumb: 4, extensibility: 0, flavor: 4, overall: 4 },
  notes: "Saved by the single-blob version",
  flourBrand: "",
  oven: "",
  tags: [],
  photos: ["data:image/jpeg;base64,AAAA"],
  totalDough: 1100,
};

/** Builds the shape DoughLab shipped before per-bake records existed. */
function createV1Database(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doughlab", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("journal");
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("journal", "readwrite");
      // v1 kept the whole journal array under one key.
      tx.objectStore("journal").put([legacyBake], "bakes");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

describe("v1 → v2 journal migration", () => {
  it("splits the old single blob into per-bake records on open", async () => {
    resetJournalDbCache();
    await createV1Database();

    const loaded = await loadJournalFromDb();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.bakes?.map((bake) => bake.id)).toEqual(["legacy-1"]);
    expect(loaded.bakes?.[0].photos).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(loaded.bakes?.[0].ratings.overall).toBe(4);
  });

  it("reports the migrated journal as coming from the database", async () => {
    resetJournalDbCache();
    const result = await hydrateJournal();
    expect(result.dbAvailable).toBe(true);
    expect(result.source).toBe("db");
    expect(result.bakes.map((bake) => bake.name)).toEqual(["Old Friday"]);
  });
});
