import { describe, expect, it } from "vitest";
import { calculateDough } from "./calc";
import { buildRecipeText } from "./exports";
import { flourBlendLabel } from "./flours";
import { sanitizeFormula } from "./formula";
import { BASE_FORMULA } from "./presets";
import { ingredientLines } from "./recipe";

const formula = (overrides: Partial<typeof BASE_FORMULA> = {}) => ({
  ...BASE_FORMULA,
  sizing: "flour" as const,
  flourWeight: 1000,
  ...overrides,
});

describe("diastatic malt", () => {
  it("adds powder by baker's percentage without changing hydration", () => {
    const plain = calculateDough(formula());
    const malted = calculateDough(formula({ diastaticMalt: 0.5 }));

    expect(malted.flour).toBe(plain.flour);
    expect(malted.water).toBe(plain.water);
    expect(malted.diastaticMalt).toBeCloseTo(5, 5);
    expect(malted.totalDough - plain.totalDough).toBeCloseTo(5, 5);
  });

  it("gets its own ingredient line only when dosed", () => {
    const plain = formula();
    expect(ingredientLines(plain, calculateDough(plain), "g").some((line) => line.key === "malt")).toBe(
      false,
    );

    const malted = formula({ diastaticMalt: 0.3 });
    const line = ingredientLines(malted, calculateDough(malted), "g").find((l) => l.key === "malt");
    expect(line?.label).toBe("Diastatic malt powder");
    expect(line?.grams).toBeCloseTo(3, 5);
    expect(line?.note).toBe("0.3% of flour");
  });
});

describe("custom flours", () => {
  it("uses the baker's own names in lines, labels and exports", () => {
    const custom = formula({
      baseFlourName: "Caputo Pizzeria",
      flour2Pct: 30,
      flour2Type: "custom",
      flour2Name: "Stone-ground wholemeal",
    });
    const lines = ingredientLines(custom, calculateDough(custom), "g");

    expect(lines[0].label).toBe("Caputo Pizzeria");
    expect(lines[1].label).toBe("Stone-ground wholemeal");
    expect(flourBlendLabel(custom)).toBe("30% stone-ground wholemeal");
    expect(buildRecipeText(custom, "g")).toContain("Stone-ground wholemeal");
  });

  it("falls back to a readable name when the custom flour is unnamed", () => {
    const unnamed = formula({ flour2Pct: 20, flour2Type: "custom", flour2Name: "" });
    expect(flourBlendLabel(unnamed)).toBe("20% custom flour");
  });

  it("keeps names through sanitizing and clamps the malt dose", () => {
    const clean = sanitizeFormula({
      ...formula({ diastaticMalt: 9 }),
      baseFlourName: "  Caputo   Pizzeria ",
      flour2Type: "custom",
      flour2Name: "x".repeat(60),
    });

    expect(clean.diastaticMalt).toBe(2);
    expect(clean.baseFlourName).toBe("Caputo Pizzeria");
    expect(clean.flour2Name).toHaveLength(40);
    expect(clean.flour2Type).toBe("custom");
  });
});
