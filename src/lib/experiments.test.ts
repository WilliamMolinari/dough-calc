import { describe, expect, it } from "vitest";
import { adjustFormula, formulaValue, trialChangeLabel } from "./experiments";
import { DEFAULT_FORMULA } from "./presets";

describe("guided trial changes", () => {
  it("changes exactly one variable", () => {
    const next = adjustFormula(DEFAULT_FORMULA, "hydration", 2);
    expect(next.hydration).toBe(DEFAULT_FORMULA.hydration + 2);
    expect({ ...next, hydration: DEFAULT_FORMULA.hydration }).toEqual(DEFAULT_FORMULA);
  });

  it("clamps to the variable's safe range", () => {
    expect(adjustFormula(DEFAULT_FORMULA, "hydration", 500).hydration).toBe(100);
    expect(adjustFormula(DEFAULT_FORMULA, "salt", -99).salt).toBe(0);
    expect(adjustFormula(DEFAULT_FORMULA, "ballWeight", 9_999).ballWeight).toBe(600);
  });

  it("rounds fractional steps and leaves the formula alone for a zero change", () => {
    const salt = adjustFormula(DEFAULT_FORMULA, "salt", 0.2);
    expect(salt.salt).toBe(Math.round((DEFAULT_FORMULA.salt + 0.2) * 10) / 10);
    expect(adjustFormula(DEFAULT_FORMULA, "salt", 0)).toEqual(DEFAULT_FORMULA);
  });

  it("labels the change for the hypothesis", () => {
    expect(trialChangeLabel("hydration", 2)).toBe("Hydration +2%");
    expect(trialChangeLabel("retardHours", -2)).toBe("Cold retard -2h");
    expect(formulaValue(DEFAULT_FORMULA, "salt")).toBe(DEFAULT_FORMULA.salt);
  });
});
