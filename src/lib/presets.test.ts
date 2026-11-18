import { describe, expect, it } from "vitest";
import { calculateDough } from "./calc";
import { STYLES } from "./presets";

describe("style presets", () => {
  // Detroit and Roman Pan once matched a short bake instead of their own 7-hour
  // ferment and opened on "Fast lane"; the label is the badge the calculator shows.
  it("opens every style on schedule", () => {
    for (const style of STYLES) {
      expect(calculateDough(style.formula).paceLabel, style.name).toBe("On schedule");
    }
  });
});
