import { describe, expect, it } from "vitest";
import { buildSchedule, calculateDough, suggestYeastPct } from "./calc";
import { DEFAULT_FORMULA } from "./presets";
import type { Formula } from "./types";

const formula = (patch: Partial<Formula> = {}): Formula => ({ ...DEFAULT_FORMULA, ...patch });

describe("calculateDough", () => {
  it("keeps baker's percentages exact for a 1 kg flour batch", () => {
    const math = calculateDough(
      formula({
        sizing: "flour",
        flourWeight: 1000,
        hydration: 65,
        salt: 2.5,
        oil: 0,
        sweetener: "none",
        leavenMode: "yeast",
        yeastPct: 0.2,
        prefermentPct: 0,
      }),
    );

    expect(math.flour).toBe(1000);
    expect(math.water).toBe(650);
    expect(math.salt).toBe(25);
    expect(math.yeast).toBe(2);
    expect(math.totalDough).toBeCloseTo(1677, 5);
  });

  it("sizes a batch from dough balls without drifting", () => {
    const math = calculateDough(
      formula({ sizing: "balls", ballCount: 4, ballWeight: 280, hydration: 63, salt: 2.5 }),
    );

    expect(math.ballCount).toBe(4);
    expect(math.ballWeight).toBeCloseTo(280, 5);
    expect(math.totalDough).toBeCloseTo(1120, 5);
  });

  it("uses the selected oven profile for the bake schedule", () => {
    const steps = buildSchedule(formula({ ovenProfile: "ooni-gas" }));
    const fire = steps.find((step) => step.kind === "fire");
    const bake = steps.find((step) => step.kind === "bake");

    expect(fire?.detail).toContain("430");
    expect(fire?.durationLabel).toBe("25 min");
    expect(bake?.durationLabel).toBe("90 s");
  });

  it("keeps the planner's largest batch size instead of clamping it", () => {
    const math = calculateDough(
      formula({ sizing: "balls", ballCount: 80, ballWeight: 280, hydration: 63 }),
    );
    expect(math.ballCount).toBe(80);
    expect(math.ballWeight).toBeCloseTo(280, 5);
  });

  it("schedules a long preheat before the mix when fermentation is shorter", () => {
    const steps = buildSchedule(
      formula({ bulkHours: 0, retardHours: 0, temperHours: 0, ovenProfile: "home-steel" }),
    );
    const fire = steps.find((step) => step.kind === "fire");
    const mix = steps.find((step) => step.kind === "mix");

    expect(fire?.minutesFromStart).toBeLessThan(0);
    expect(mix?.minutesFromStart).toBe(0);
    expect(steps[0].key).toBe("fire");
  });

  it("never suggests a nonsensical yeast dose", () => {
    expect(suggestYeastPct(0)).toBeGreaterThan(0);
    expect(suggestYeastPct(24)).toBeLessThan(1);
    expect(suggestYeastPct(1000)).toBeGreaterThan(0);
  });
});
