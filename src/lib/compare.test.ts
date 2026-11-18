import { describe, expect, it } from "vitest";
import {
  buildBakeComparison,
  comparisonDeltaIsZero,
  formatComparisonDelta,
  formatComparisonValue,
} from "./compare";
import { DEFAULT_FORMULA } from "./presets";
import type { BakeEntry, Formula, Ratings } from "./types";

const BASE_RATINGS: Ratings = {
  crust: 0,
  crumb: 0,
  extensibility: 0,
  flavor: 0,
  overall: 0,
};

function makeBake(
  overrides: Partial<BakeEntry> = {},
  formulaPatch: Partial<Formula> = {},
): BakeEntry {
  const { ratings, ...rest } = overrides;
  return {
    id: "a",
    createdAt: "2026-11-01T10:00:00.000Z",
    name: "Friday",
    styleId: DEFAULT_FORMULA.styleId,
    styleName: "Neapolitan",
    formula: { ...DEFAULT_FORMULA, ...formulaPatch },
    unit: "g",
    ratings: { ...BASE_RATINGS, ...ratings },
    notes: "",
    flourBrand: "",
    oven: "",
    tags: [],
    photos: [],
    totalDough: 1120,
    ...rest,
  };
}

describe("bake comparison", () => {
  it("diffs recipe, fermentation and every score in one pass", () => {
    const a = makeBake(
      {
        name: "Friday",
        flourBrand: "Caputo",
        ratings: { ...BASE_RATINGS, overall: 4, crust: 5, crumb: 3, flavor: 4 },
      },
      { hydration: 65 },
    );
    const b = makeBake(
      {
        id: "b",
        name: "Saturday",
        flourBrand: "King Arthur",
        ratings: { ...BASE_RATINGS, overall: 2, crust: 2, crumb: 4, flavor: 3 },
      },
      { hydration: 60 },
    );

    const { rows, meta } = buildBakeComparison(a, b);
    const byLabel = new Map(rows.map((row) => [row.label, row]));

    expect(byLabel.get("Hydration")).toMatchObject({ a: 65, b: 60, section: "Recipe" });
    expect(byLabel.get("Water")?.weight).toBe(true);
    expect(byLabel.get("Effective ferment")?.section).toBe("Fermentation");
    expect(byLabel.get("Overall")).toMatchObject({ a: 4, b: 2, higherIsBetter: true });
    expect(byLabel.get("Crust")).toMatchObject({ a: 5, b: 2, higherIsBetter: true });
    expect(byLabel.get("Crumb")).toMatchObject({ a: 3, b: 4 });
    expect(meta.find((item) => item.label === "Flour")).toMatchObject({
      a: "Caputo",
      b: "King Arthur",
    });
  });

  it("only emits leaven rows that can differ", () => {
    const sourdough = makeBake({}, { leavenMode: "sourdough", starterPct: 20 });
    const yeast = makeBake({ id: "b" }, { leavenMode: "yeast", yeastPct: 0.2 });

    const labels = buildBakeComparison(sourdough, yeast).rows.map((row) => row.label);
    expect(labels).toContain("Starter");
    expect(labels).toContain("Yeast");

    const bothYeast = buildBakeComparison(yeast, makeBake({ id: "c" }, { leavenMode: "yeast" }));
    const yeastLabels = bothYeast.rows.map((row) => row.label);
    expect(yeastLabels).not.toContain("Starter");
    expect(yeastLabels).toContain("Yeast");
  });

  it("omits metadata that did not change", () => {
    const a = makeBake({ flourBrand: "Caputo", oven: "Home oven + steel" });
    const b = makeBake({ id: "b", flourBrand: "Caputo", oven: "Home oven + steel" });

    expect(buildBakeComparison(a, b).meta).toEqual([]);
  });

  it("formats values and signed deltas in the selected unit", () => {
    const { rows } = buildBakeComparison(makeBake(), makeBake({ id: "b" }));
    const water = rows.find((row) => row.label === "Water")!;
    const hydration = rows.find((row) => row.label === "Hydration")!;

    expect(formatComparisonValue(water, 100, "oz")).toBe("3.5 oz");
    expect(formatComparisonDelta(hydration, 1.2, "g")).toBe("+1.2%");
    expect(formatComparisonDelta(hydration, -1.2, "g")).toBe("-1.2%");
    expect(formatComparisonDelta(hydration, 0.01, "g")).toBe("—");
    expect(comparisonDeltaIsZero(water, 0.2)).toBe(true);
  });
});
