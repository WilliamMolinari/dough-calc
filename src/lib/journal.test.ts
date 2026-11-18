import { describe, expect, it } from "vitest";
import {
  bakeFamily,
  comparisonTarget,
  deleteBakeEntry,
  doughMadeGrams,
  duplicateBakeEntry,
  familyName,
  isPlannedTrial,
  lineageOf,
  nextTrialName,
  trialLabel,
} from "./journal";
import { DEFAULT_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

const BAKE: BakeEntry = {
  id: "original",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
  name: "Friday",
  styleId: DEFAULT_FORMULA.styleId,
  styleName: "Neapolitan",
  formula: { ...DEFAULT_FORMULA },
  unit: "g",
  ratings: { crust: 4, crumb: 3, extensibility: 5, flavor: 4, overall: 4 },
  notes: "Next time: more water.",
  nextTimeNotes: "Add 20 g water.",
  flourBrand: "Caputo",
  oven: "Home oven + steel",
  tags: ["cold ferment", "00 flour"],
  photos: ["data:image/jpeg;base64,AAAA"],
  totalDough: 1120,
};

describe("duplicateBakeEntry", () => {
  it("creates an independent copy with a new identity", () => {
    const copy = duplicateBakeEntry(BAKE, "copy", "2026-11-10T10:00:00.000Z");

    expect(copy.id).toBe("copy");
    expect(copy.name).toBe("Friday (copy)");
    expect(copy.createdAt).toBe("2026-11-10T10:00:00.000Z");
    expect(copy.updatedAt).toBeUndefined();
    expect(copy.formula).toEqual(BAKE.formula);
    expect(copy.tags).toEqual(BAKE.tags);
    expect(copy.notes).toBe("");
    expect(BAKE.notes).toBe("Next time: more water.");
    expect(copy.nextTimeNotes).toBe(BAKE.nextTimeNotes);
    expect(copy.flourBrand).toBe(BAKE.flourBrand);
    expect(copy.oven).toBe(BAKE.oven);
    expect(copy.photos).toEqual([]);
  });

  it("carries the next-bake plan but clears what happened", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");

    expect(copy.notes).toBe("");
    expect(copy.nextTimeNotes).toBe("Add 20 g water.");

    const withoutPlan = duplicateBakeEntry({ ...BAKE, nextTimeNotes: undefined }, "plain");
    expect(withoutPlan.notes).toBe("");
    expect(withoutPlan.nextTimeNotes).toBeUndefined();
  });

  it("does not inherit a baked confirmation into the next trial", () => {
    const copy = duplicateBakeEntry({ ...BAKE, bakedAt: "2026-11-01T18:00:00.000Z" }, "copy");

    expect(copy.bakedAt).toBeUndefined();
    expect(isPlannedTrial(copy)).toBe(true);
  });

  it("starts the new experiment with empty ratings", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");

    expect(copy.ratings).toEqual({ crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 });
    expect(BAKE.ratings).toEqual({ crust: 4, crumb: 3, extensibility: 5, flavor: 4, overall: 4 });
  });

  it("does not share mutable state with the original", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");

    expect(copy.formula).not.toBe(BAKE.formula);
    expect(copy.ratings).not.toBe(BAKE.ratings);
    expect(copy.tags).not.toBe(BAKE.tags);
    expect(copy.formula).toEqual(BAKE.formula);
    expect(BAKE.photos).toHaveLength(1);
  });

  it("links the copy into the original's trial family", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");

    expect(copy.parentId).toBe(BAKE.id);
    expect(copy.rootId).toBe(BAKE.id);
    expect(copy.name).toBe("Friday (copy)");
  });
});

describe("trial lineage", () => {
  const copy = duplicateBakeEntry(BAKE, "copy", "2026-11-10T10:00:00.000Z", "Friday · trial 2");
  const third = duplicateBakeEntry(copy, "third", "2026-11-20T10:00:00.000Z", "Friday · trial 3");
  const bakes = [third, copy, BAKE];

  it("counts trials oldest-first and names the family root", () => {
    expect(bakeFamily(bakes, copy).map((bake) => bake.id)).toEqual(["original", "copy", "third"]);
    expect(third.rootId).toBe("original");

    const lineage = lineageOf(copy, bakes);
    expect(lineage.trial).toBe(2);
    expect(lineage.total).toBe(3);
    expect(lineage.parent?.id).toBe("original");
    expect(trialLabel(lineage)).toBe("Trial 2 of 3");
    expect(trialLabel(lineageOf(BAKE, bakes))).toBe("Trial 1 of 3");
  });

  it("keeps a lone bake out of the trial wording", () => {
    expect(trialLabel(lineageOf(BAKE, [BAKE]))).toBe("");
    expect(bakeFamily([BAKE], BAKE)).toHaveLength(1);
  });

  it("names the next experiment without stacking suffixes", () => {
    expect(nextTrialName(BAKE, [BAKE])).toBe("Friday · trial 2");
    expect(nextTrialName(copy, bakes)).toBe("Friday · trial 4");
    expect(familyName("Friday · trial 2 (copy)")).toBe("Friday");
    expect(familyName("Friday (copy)")).toBe("Friday");
  });

  it("falls back to the family when the parent no longer exists", () => {
    const orphan = { ...copy, parentId: "deleted-parent" };
    const lineage = lineageOf(orphan, [BAKE, orphan]);

    expect(lineage.parent).toBeNull();
    expect(lineage.trial).toBe(2);
    expect(comparisonTarget(orphan, [BAKE, orphan])?.id).toBe("original");
  });

  it("prefers the parent trial as the diff target", () => {
    expect(comparisonTarget(copy, bakes)?.id).toBe("original");
    expect(comparisonTarget(third, bakes)?.id).toBe("copy");
    expect(comparisonTarget(BAKE, [BAKE, third])?.id).toBe("third");
  });
});

describe("deleting a bake", () => {
  const copy = duplicateBakeEntry(BAKE, "copy", "2026-11-10T10:00:00.000Z", "Friday · trial 2");
  const third = duplicateBakeEntry(copy, "third", "2026-11-20T10:00:00.000Z", "Friday · trial 3");
  const bakes = [BAKE, copy, third];

  it("reparents the children of a deleted middle trial", () => {
    const after = deleteBakeEntry(bakes, "copy");
    const byId = new Map(after.map((bake) => [bake.id, bake]));

    expect(after.map((bake) => bake.id)).toEqual(["original", "third"]);
    expect(byId.get("third")?.parentId).toBe("original");
    expect(byId.get("third")?.rootId).toBe("original");
    expect(bakeFamily(after, byId.get("third")!).map((bake) => bake.id)).toEqual([
      "original",
      "third",
    ]);
  });

  it("detaches children and rebuilds roots when the family root is deleted", () => {
    const after = deleteBakeEntry(bakes, "original");
    const byId = new Map(after.map((bake) => [bake.id, bake]));

    expect(byId.get("copy")?.parentId).toBeUndefined();
    expect(byId.get("copy")?.rootId).toBe("copy");
    expect(byId.get("third")?.parentId).toBe("copy");
    expect(byId.get("third")?.rootId).toBe("copy");
    expect(after.some((bake) => bake.parentId === "original")).toBe(false);
  });

  it("leaves the journal untouched when the id is unknown", () => {
    expect(deleteBakeEntry(bakes, "missing")).toBe(bakes);
  });

});

describe("dough accounting", () => {
  it("leaves unrated forked trials out of the dough-made total", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");
    expect(isPlannedTrial(copy)).toBe(true);
    expect(doughMadeGrams([BAKE, copy])).toBe(1120);

    const baked = { ...copy, ratings: { ...copy.ratings, overall: 5 } };
    expect(isPlannedTrial(baked)).toBe(false);
    expect(doughMadeGrams([BAKE, baked])).toBe(2240);
  });

  it("counts a trial the baker confirms as baked even without a score", () => {
    const copy = duplicateBakeEntry(BAKE, "copy");
    const confirmed = { ...copy, bakedAt: "2026-11-10T18:00:00.000Z" };

    expect(isPlannedTrial(confirmed)).toBe(false);
    expect(doughMadeGrams([BAKE, confirmed])).toBe(2240);

    const cleared = { ...confirmed, bakedAt: undefined };
    expect(isPlannedTrial(cleared)).toBe(true);
    expect(doughMadeGrams([BAKE, cleared])).toBe(1120);
  });

  it("still counts unrated first bakes, which were really made", () => {
    const unrated = { ...BAKE, ratings: { ...BAKE.ratings, overall: 0 } };
    expect(isPlannedTrial(unrated)).toBe(false);
    expect(doughMadeGrams([unrated])).toBe(1120);
  });
});
