import { describe, expect, it } from "vitest";
import { buildInsights } from "./insights";
import { DEFAULT_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

function bake(id: string, overall: number, hydration: number, oven: string): BakeEntry {
  return {
    id,
    createdAt: `2026-0${overall}-01T10:00:00.000Z`,
    name: `Bake ${id}`,
    styleId: "new-york",
    styleName: "New York",
    formula: { ...DEFAULT_FORMULA, hydration },
    unit: "g",
    ratings: { crust: overall, crumb: overall, extensibility: overall, flavor: overall, overall },
    notes: "",
    flourBrand: "",
    oven,
    tags: overall >= 4 ? ["cold ferment"] : [],
    photos: [],
    totalDough: 1120,
  };
}

describe("journal insights", () => {
  const bakes = [
    bake("a", 5, 70, "Ooni / gas"),
    bake("b", 2, 60, "Home oven + steel"),
    bake("c", 3, 60, "Home oven + steel"),
    bake("d", 4, 60, "Ooni / gas"),
  ];

  it("finds the benchmark and the rated count", () => {
    const insights = buildInsights(bakes);
    expect(insights.ratedCount).toBe(4);
    expect(insights.best?.id).toBe("a");
    expect(insights.avgOverall).toBe(3.5);
  });

  it("compares the top quartile against the rest", () => {
    const traits = buildInsights(bakes).traits;
    const hydration = traits.find((trait) => trait.label === "Hydration");
    expect(hydration?.top).toBe(70);
    expect(hydration?.rest).toBe(60);
  });

  it("groups by oven and returns an empty result safely", () => {
    const insights = buildInsights(bakes);
    expect(insights.byOven[0].count).toBeGreaterThan(0);
    expect(buildInsights([]).ratedCount).toBe(0);
  });
});
