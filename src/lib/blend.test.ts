import { describe, expect, it } from "vitest";
import { calculateDough } from "./calc";
import { buildRecipeText } from "./exports";
import { flourBlendLabel, secondFlourShare } from "./flours";
import { DEFAULT_FORMULA } from "./presets";
import { ingredientLines } from "./recipe";
import type { Formula } from "./types";

const formula = (patch: Partial<Formula> = {}): Formula => ({ ...DEFAULT_FORMULA, ...patch });

describe("two-flour blend", () => {
  it("splits the total flour instead of adding to it", () => {
    const f = formula({
      sizing: "flour",
      flourWeight: 1000,
      flour2Pct: 30,
      flour2Type: "whole-wheat",
    });
    const math = calculateDough(f);
    const lines = ingredientLines(f, math, "g");

    expect(math.flour).toBe(1000);
    expect(math.flourSecondary).toBe(300);
    expect(lines.find((line) => line.key === "flour")?.grams).toBe(700);
    expect(lines.find((line) => line.key === "flour2")?.grams).toBe(300);
    expect(lines.find((line) => line.key === "flour2")?.label).toBe("Whole wheat");
  });

  it("keeps a single flour line when no blend is set", () => {
    const f = formula({ flour2Pct: 0 });
    const math = calculateDough(f);

    expect(math.flourSecondary).toBe(0);
    expect(ingredientLines(f, math, "g").some((line) => line.key === "flour2")).toBe(false);
    expect(flourBlendLabel(f)).toBeNull();
  });

  it("takes pre-ferment flour out of the base flour only", () => {
    const f = formula({
      sizing: "flour",
      flourWeight: 1000,
      flour2Pct: 30,
      leavenMode: "preferment",
      prefermentPct: 30,
    });
    const math = calculateDough(f);
    const lines = ingredientLines(f, math, "g");

    expect(lines.find((line) => line.key === "flour2")?.grams).toBe(300);
    expect(lines.find((line) => line.key === "flour")?.grams).toBe(400);
  });

  it("lists both flours with their weights in exports", () => {
    const f = formula({
      sizing: "flour",
      flourWeight: 1000,
      flour2Pct: 30,
      flour2Type: "whole-wheat",
    });
    const text = buildRecipeText(f, "g");

    expect(text).toContain("Whole wheat");
    expect(text).toContain("700 g");
    expect(text).toContain("300 g");
  });

  it("labels the blend and clamps absurd shares", () => {
    expect(flourBlendLabel(formula({ flour2Pct: 30, flour2Type: "rye" }))).toBe("30% rye");
    expect(secondFlourShare(formula({ flour2Pct: 140 }))).toBe(95);
    expect(secondFlourShare(formula({ flour2Pct: -5 }))).toBe(0);
  });
});
