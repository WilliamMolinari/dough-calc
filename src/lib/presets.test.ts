import { describe, expect, it } from "vitest";
import { calculateDough } from "./calc";
import { STYLES } from "./presets";
import type { Formula } from "./types";

/** The two styles whose leaven is more than a yeast dose. */
const LEAVEN_BY_STYLE: Record<string, Formula["leavenMode"]> = {
  sourdough: "sourdough",
  poolish: "preferment",
};

describe("style presets", () => {
  // Detroit and Roman Pan once matched a short bake instead of their own 7-hour
  // ferment and opened on "Fast lane"; the label is the badge the calculator shows.
  it("opens every style on schedule", () => {
    for (const style of STYLES) {
      expect(calculateDough(style.formula).paceLabel, style.name).toBe("On schedule");
    }
  });

  // The journal prints formula.ballWeight while the calculator derives it from
  // the pan, so a pan preset's field has to agree with its own dimensions.
  it("sizes a pan preset to the dough weight it declares", () => {
    for (const style of STYLES) {
      if (style.formula.sizing !== "pan") continue;
      expect(calculateDough(style.formula).ballWeight, style.name).toBeCloseTo(
        style.formula.ballWeight,
        6,
      );
    }
  });

  // getStyle() falls back to the first preset, so a mismatched styleId would
  // silently label a bake as Neapolitan and file it under the wrong journal filter.
  it("points every preset's formula at its own style", () => {
    for (const style of STYLES) {
      expect(style.formula.styleId, style.name).toBe(style.id);
    }
  });

  // Pace alone misses a style that swaps leaven but keeps a matching dose: Detroit on
  // "sourdough" reads On schedule off the base starter and would demand a starter build.
  it("keeps every style on the leaven it is named for", () => {
    for (const style of STYLES) {
      expect(style.formula.leavenMode, style.name).toBe(LEAVEN_BY_STYLE[style.id] ?? "yeast");
    }
  });
});
