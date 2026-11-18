import { describe, expect, it } from "vitest";
import { buildSchedule } from "./calc";
import { buildRecipeText } from "./exports";
import { DEFAULT_FORMULA } from "./presets";
import {
  convertTempText,
  fmtTemp,
  fmtTempDelta,
  fromTempValue,
  tempFromInput,
  toTempValue,
} from "./temperature";

describe("temperature units", () => {
  it("converts between Celsius and Fahrenheit", () => {
    expect(toTempValue(0, "f")).toBe(32);
    expect(toTempValue(100, "f")).toBe(212);
    expect(toTempValue(22, "c")).toBe(22);
    expect(fromTempValue(72, "f")).toBeCloseTo(22.22, 2);
  });

  it("formats a temperature with the selected suffix", () => {
    expect(fmtTemp(22, "c")).toBe("22°C");
    expect(fmtTemp(22, "f")).toBe("72°F");
    expect(fmtTempDelta(4, "f")).toBe("7.2°F");
  });

  it("snaps a typed Fahrenheit temperature back to a half degree Celsius", () => {
    expect(tempFromInput(72, "f")).toBe(22);
    expect(tempFromInput(70, "f")).toBe(21);
    expect(tempFromInput(22.5, "c")).toBe(22.5);
  });

  it("uses the chosen unit in schedules and copied recipe text", () => {
    const formula = { ...DEFAULT_FORMULA };
    const fire = buildSchedule(formula, new Date(), "f").find((step) => step.kind === "fire");
    expect(fire?.detail).toContain("527°F");
    expect(fire?.detail).not.toContain("°C");

    const text = buildRecipeText(formula, "g", "Test bake", "f");
    expect(text).toContain("°F");
    expect(text).not.toContain("°C");
  });

  it("rewrites temperatures and ranges inside prose", () => {
    expect(convertTempText("Launch at 430–450°C", "f")).toBe("Launch at 806–842°F");
    expect(convertTempText("Keep the floor at ~470°C", "f")).toBe("Keep the floor at ~878°F");
    expect(convertTempText("Bake at 250°C", "c")).toBe("Bake at 250°C");
  });
});
