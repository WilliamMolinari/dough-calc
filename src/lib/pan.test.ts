import { describe, expect, it } from "vitest";
import { calculateDough } from "./calc";
import { sanitizeFormula } from "./formula";
import { BASE_FORMULA, getStyle } from "./presets";
import type { Formula } from "./types";

const panFormula = (overrides: Partial<Formula> = {}): Formula => ({
  ...BASE_FORMULA,
  sizing: "pan",
  ballCount: 2,
  panLength: 25,
  panWidth: 20,
  doughLoading: 0.9,
  ...overrides,
});

describe("pan sizing", () => {
  it("turns area × loading into the dough weight", () => {
    const math = calculateDough(panFormula());
    expect(math.panArea).toBe(500);
    expect(math.panDough).toBe(450);
    expect(math.totalDough).toBeCloseTo(900, 6);
    expect(math.ballWeight).toBeCloseTo(450, 6);
  });

  it("scales with the number of pans", () => {
    const one = calculateDough(panFormula({ ballCount: 1 }));
    const three = calculateDough(panFormula({ ballCount: 3 }));
    expect(three.totalDough).toBeCloseTo(one.totalDough * 3, 6);
  });

  it("keeps dough balls and flour weight unaffected", () => {
    const balls = calculateDough({
      ...BASE_FORMULA,
      sizing: "balls",
      ballCount: 4,
      ballWeight: 280,
      panLength: 40,
      panWidth: 30,
      doughLoading: 1.2,
    });
    expect(balls.totalDough).toBeCloseTo(1120, 6);

    const flour = calculateDough({ ...BASE_FORMULA, sizing: "flour", flourWeight: 1000 });
    expect(flour.flour).toBeCloseTo(1000, 6);
  });

  it("holds a pan bake's depth fixed while hydration moves", () => {
    const dry = calculateDough(panFormula({ hydration: 60 }));
    const wet = calculateDough(panFormula({ hydration: 80 }));
    expect(dry.totalDough).toBeCloseTo(900, 6);
    expect(wet.totalDough).toBeCloseTo(900, 6);
    expect(wet.flour).toBeLessThan(dry.flour);
    expect(wet.water).toBeGreaterThan(dry.water);
  });

  it("ships pan presets that land on sensible weights", () => {
    const detroit = getStyle("detroit").formula;
    expect(detroit.sizing).toBe("pan");
    const detroitMath = calculateDough(detroit);
    expect(detroitMath.ballWeight).toBeGreaterThan(400);
    expect(detroitMath.ballWeight).toBeLessThan(500);

    const roman = getStyle("roman-pan").formula;
    expect(roman.sizing).toBe("pan");
    const romanMath = calculateDough(roman);
    expect(romanMath.totalDough).toBeGreaterThan(700);
    expect(romanMath.totalDough).toBeLessThan(850);
  });
});

describe("sanitizeFormula pan fields", () => {
  it("clamps dimensions and loading", () => {
    const cleaned = sanitizeFormula({
      sizing: "pan",
      panLength: 5,
      panWidth: 400,
      doughLoading: 9,
    });
    expect(cleaned.sizing).toBe("pan");
    expect(cleaned.panLength).toBe(10);
    expect(cleaned.panWidth).toBe(60);
    expect(cleaned.doughLoading).toBe(1.6);
  });

  it("gives older formulas usable pan defaults", () => {
    const cleaned = sanitizeFormula({ hydration: 65 });
    expect(cleaned.sizing).toBe("balls");
    expect(cleaned.panLength).toBeGreaterThan(0);
    expect(cleaned.panWidth).toBeGreaterThan(0);
    expect(cleaned.doughLoading).toBeGreaterThan(0);
  });
});
