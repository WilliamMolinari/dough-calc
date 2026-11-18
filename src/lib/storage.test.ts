import { describe, expect, it } from "vitest";
import {
  STORAGE_BUDGET_BYTES,
  estimateStorage,
  normalizeBakes,
  storagePressure,
  stripBakePhotos,
} from "./storage";
import { DEFAULT_FORMULA } from "./presets";

describe("stored bake normalization", () => {
  it("repairs malformed formulas, ratings, units and unused values", () => {
    const bakes = normalizeBakes([
      {
        id: "a",
        name: "  Friday  ",
        formula: {
          hydration: 999,
          salt: -4,
          ballCount: 0,
          ovenProfile: "not-an-oven",
          startTime: "25:99",
        },
        ratings: { overall: "9", crust: -2, crumb: 3 },
        unit: "lb",
        createdAt: "not-a-date",
        updatedAt: "also-not-a-date",
        tags: ["cold ferment", 4, ""],
        photos: ["data:image/jpeg;base64,AAAA", 3],
        totalDough: "nope",
      },
    ]);

    expect(bakes).toHaveLength(1);
    const bake = bakes[0];
    expect(bake.name).toBe("Friday");
    expect(bake.formula.hydration).toBe(120);
    expect(bake.formula.salt).toBe(0);
    expect(bake.formula.ballCount).toBeGreaterThanOrEqual(1);
    expect(bake.formula.ovenProfile).toBe(DEFAULT_FORMULA.ovenProfile);
    expect(bake.formula.startTime).toBe(DEFAULT_FORMULA.startTime);
    expect(bake.ratings.overall).toBe(5);
    expect(bake.ratings.crust).toBe(0);
    expect(bake.ratings.crumb).toBe(3);
    expect(bake.unit).toBe("g");
    expect(bake.tags).toEqual(["cold ferment"]);
    expect(bake.photos).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(bake.totalDough).toBe(0);
    expect(Number.isNaN(new Date(bake.createdAt).getTime())).toBe(false);
    expect(bake.updatedAt).toBeUndefined();
  });

  it("drops duplicate ids but keeps separate bakes", () => {
    const bakes = normalizeBakes([
      { id: "a", name: "First" },
      { id: "a", name: "Duplicate" },
      { id: "b", name: "Second" },
    ]);

    expect(bakes.map((bake) => bake.name)).toEqual(["First", "Second"]);
  });

  it("rebuilds trial roots and drops dangling or self parents", () => {
    const bakes = normalizeBakes([
      { id: "root", name: "Original" },
      { id: "child", name: "Trial 2", parentId: "root" },
      { id: "grandchild", name: "Trial 3", parentId: "child", rootId: "stale-root" },
      { id: "orphan", name: "Orphan", parentId: "missing" },
      { id: "loop", name: "Loop", parentId: "loop" },
    ]);

    const byId = new Map(bakes.map((bake) => [bake.id, bake]));
    expect(byId.get("root")?.rootId).toBe("root");
    expect(byId.get("child")?.rootId).toBe("root");
    expect(byId.get("grandchild")?.rootId).toBe("root");
    expect(byId.get("orphan")?.parentId).toBeUndefined();
    expect(byId.get("orphan")?.rootId).toBe("orphan");
    expect(byId.get("loop")?.parentId).toBeUndefined();
    expect(byId.get("loop")?.rootId).toBe("loop");
  });

  it("keeps a valid baked confirmation and drops invalid ones", () => {
    const bakes = normalizeBakes([
      { id: "a", name: "First", parentId: "missing", bakedAt: "2026-11-10T18:00:00.000Z" },
      { id: "b", name: "Second", parentId: "missing", bakedAt: "not-a-date" },
    ]);

    expect(bakes[0]?.bakedAt).toBe("2026-11-10T18:00:00.000Z");
    expect(bakes[1]?.bakedAt).toBeUndefined();
  });

  it("keeps the split next-time notes and defaults them to empty", () => {
    const bakes = normalizeBakes([
      { id: "a", name: "First", notes: "Tight crumb.", nextTimeNotes: "More water." },
      { id: "b", name: "Second" },
    ]);

    expect(bakes[0]?.nextTimeNotes).toBe("More water.");
    expect(bakes[1]?.nextTimeNotes).toBe("");
  });
});

describe("IndexedDB mirror", () => {
  it("drops photo bytes from the localStorage mirror without mutating the bakes", () => {
    const [bake] = normalizeBakes([
      { id: "a", name: "First", photos: ["data:image/jpeg;base64,AAAA"] },
    ]);
    const mirror = stripBakePhotos([bake]);

    expect(mirror[0].photos).toEqual([]);
    expect(mirror[0].name).toBe("First");
    expect(bake.photos).toHaveLength(1);
  });

  it("falls back to the localStorage meter when the browser has no estimate API", async () => {
    const info = await estimateStorage();
    expect(info.bytes).toBeGreaterThanOrEqual(0);
    expect(info.budget).toBeGreaterThan(0);
  });
});

describe("storage headroom", () => {
  it("warns once the journal starts crowding the browser budget", () => {
    expect(storagePressure(0)).toBe("ok");
    expect(storagePressure(STORAGE_BUDGET_BYTES * 0.4)).toBe("ok");
    expect(storagePressure(STORAGE_BUDGET_BYTES * 0.7)).toBe("watch");
    expect(storagePressure(STORAGE_BUDGET_BYTES * 0.9)).toBe("tight");
    expect(storagePressure(Number.NaN)).toBe("ok");
  });
});
