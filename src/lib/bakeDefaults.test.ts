import { describe, expect, it } from "vitest";
import { flourFieldText, formulaTags } from "./bakeDefaults";
import { DEFAULT_FORMULA } from "./presets";
import type { Formula } from "./types";

const formula = (patch: Partial<Formula> = {}): Formula => ({ ...DEFAULT_FORMULA, ...patch });

describe("new bake log defaults", () => {
  it("puts the named flour and the blend into the Flour field", () => {
    expect(flourFieldText(formula())).toBe("");
    expect(flourFieldText(formula({ baseFlourName: "  Caputo Pizzeria  " }))).toBe(
      "Caputo Pizzeria",
    );
    expect(
      flourFieldText(formula({ baseFlourName: "Caputo", flour2Pct: 30, flour2Type: "rye" })),
    ).toBe("Caputo + 30% rye");
    expect(flourFieldText(formula({ flour2Pct: 20, flour2Type: "semolina" }))).toBe(
      "20% semolina",
    );
  });

  it("keeps the Flour field inside the input's limit", () => {
    const text = flourFieldText(
      formula({ baseFlourName: "A".repeat(40), flour2Pct: 30, flour2Name: "B".repeat(40), flour2Type: "custom" }),
    );
    expect(text.length).toBeLessThanOrEqual(60);
  });

  it("tags the leaven, blend and cold ferment a formula already describes", () => {
    expect(formulaTags(formula())).toEqual(["cold ferment"]);
    expect(
      formulaTags(formula({ leavenMode: "preferment", prefermentKind: "biga", retardHours: 0, bulkHours: 6 })),
    ).toEqual(["biga", "same-day"]);
    expect(
      formulaTags(formula({ leavenMode: "sourdough", flour2Pct: 25, flour2Type: "whole-wheat" })),
    ).toEqual(["whole wheat", "sourdough", "cold ferment"]);
  });

  it("does not tag an unnamed custom flour", () => {
    expect(formulaTags(formula({ flour2Pct: 20, flour2Type: "custom", flour2Name: "" }))).not.toContain(
      "custom flour",
    );
  });
});
