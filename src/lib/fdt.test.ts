import { describe, expect, it } from "vitest";
import {
  DEFAULT_FDT,
  calibrate,
  estimateDoughTemp,
  estimateWaterTemp,
  normalizeFdtSettings,
  resetCalibration,
} from "./fdt";

describe("final dough temperature", () => {
  it("solves the three-component water temperature", () => {
    expect(estimateWaterTemp(DEFAULT_FDT, 22)).toBe(25);
    expect(estimateDoughTemp(25, 22, DEFAULT_FDT)).toBe(24);
  });

  it("learns a warmer-than-predicted mix and cools the next water suggestion", () => {
    const next = calibrate(DEFAULT_FDT, 27, 25, 22);
    expect(next.offsetC).toBe(3);
    expect(next.samples).toBe(1);
    expect(estimateWaterTemp(next, 22)).toBeLessThan(25);
  });

  it("preserves zero friction and clamps invalid stored values", () => {
    const settings = normalizeFdtSettings({ friction: 0, targetFdt: 0, samples: -3 });
    expect(settings.friction).toBe(0);
    expect(settings.targetFdt).toBe(18);
    expect(settings.samples).toBe(0);
  });

  it("resets the correction without losing target settings", () => {
    const calibrated = calibrate({ ...DEFAULT_FDT, targetFdt: 23 }, 26, 24, 22);
    const reset = resetCalibration(calibrated);
    expect(reset.offsetC).toBe(0);
    expect(reset.targetFdt).toBe(23);
  });
});
