import { describe, expect, it } from "vitest";
import { DEFAULT_FORMULA } from "./presets";
import { parseRecipeFile } from "./recipeFile";

const file = (body: unknown): string => JSON.stringify(body);

describe("recipe files", () => {
  it("reads a recipe export back with its units", () => {
    const result = parseRecipeFile(
      file({
        app: "DoughLab",
        version: 1,
        unit: "oz",
        formula: { ...DEFAULT_FORMULA, hydration: 67.5, ballCount: 6 },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formula.hydration).toBe(67.5);
    expect(result.formula.ballCount).toBe(6);
    expect(result.unit).toBe("oz");
  });

  it("takes only the formula from a full backup", () => {
    const result = parseRecipeFile(
      file({
        app: "DoughLab",
        kind: "backup",
        bakes: [{ id: "a", name: "Friday" }],
        formula: { ...DEFAULT_FORMULA, salt: 3 },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formula.salt).toBe(3);
  });

  it("accepts a bare formula and clamps hostile values", () => {
    const result = parseRecipeFile(file({ ...DEFAULT_FORMULA, hydration: 999, flour2Pct: -4 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formula.hydration).toBe(120);
    expect(result.formula.flour2Pct).toBe(0);
    expect(result.unit).toBe("g");
  });

  it("rejects files that hold no recipe", () => {
    expect(parseRecipeFile("").ok).toBe(false);
    expect(parseRecipeFile("not json").ok).toBe(false);
    expect(parseRecipeFile("[]").ok).toBe(false);
    expect(parseRecipeFile(file({ hello: "world" })).ok).toBe(false);
    expect(parseRecipeFile(file({ app: "DoughLab", formula: {} })).ok).toBe(false);
    expect(parseRecipeFile("a".repeat(100_001)).ok).toBe(false);
  });
});
