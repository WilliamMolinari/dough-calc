import { describe, expect, it } from "vitest";
import { createBackup, mergeBakes, parseBackup } from "./backup";
import { DEFAULT_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

function bake(id: string, name: string, updatedAt?: string): BakeEntry {
  return {
    id,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt,
    name,
    styleId: "new-york",
    styleName: "New York",
    formula: { ...DEFAULT_FORMULA },
    unit: "g",
    ratings: { crust: 4, crumb: 3, extensibility: 4, flavor: 5, overall: 4 },
    notes: "note",
    flourBrand: "Caputo",
    oven: "Home oven + steel",
    tags: ["cold ferment"],
    photos: ["data:image/jpeg;base64,AAAA"],
    totalDough: 1120,
  };
}

describe("backup & restore", () => {
  it("includes photos and restores a valid file", () => {
    const data = createBackup([bake("a", "Friday")], DEFAULT_FORMULA, "g");
    const result = parseBackup(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bakes).toHaveLength(1);
    expect(result.bakes[0].photos[0]).toContain("data:image/jpeg");
    expect(result.bakes[0].formula.ovenProfile).toBe(DEFAULT_FORMULA.ovenProfile);
  });

  it("merges by id and keeps the newest edit", () => {
    const current = [bake("a", "Old")];
    const incoming = [bake("a", "New", "2026-02-01T00:00:00.000Z"), bake("b", "Second")];
    const merged = mergeBakes(current, incoming, "merge");

    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === "a")?.name).toBe("New");
  });

  it("replaces when asked", () => {
    const merged = mergeBakes([bake("a", "Old")], [bake("b", "Only")], "replace");
    expect(merged.map((item) => item.id)).toEqual(["b"]);
  });

  it("rejects malformed files", () => {
    expect(parseBackup("not json").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ bakes: "nope" })).ok).toBe(false);
  });
});
