import { describe, expect, it } from "vitest";
import { sanitizeFormula } from "./formula";
import { DEFAULT_FORMULA } from "./presets";
import { decodeShare, encodeShare } from "./share";

describe("share links", () => {
  it("round-trips the formula and unit", () => {
    const encoded = encodeShare(
      { ...DEFAULT_FORMULA, hydration: 67.5, ballCount: 6, ovenProfile: "ooni-gas" },
      "oz",
    );
    const decoded = decodeShare(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.formula.hydration).toBe(67.5);
    expect(decoded?.formula.ballCount).toBe(6);
    expect(decoded?.formula.ovenProfile).toBe("ooni-gas");
    expect(decoded?.unit).toBe("oz");
  });

  it("clamps hostile values and falls back for unknown enums", () => {
    const clean = sanitizeFormula({
      hydration: 999,
      salt: -4,
      ballCount: 0,
      ovenProfile: "not-an-oven",
      leavenMode: "magic",
      startTime: "25:99",
    });

    expect(clean.hydration).toBe(120);
    expect(clean.salt).toBe(0);
    expect(clean.ballCount).toBeGreaterThanOrEqual(1);
    expect(clean.ovenProfile).toBe(DEFAULT_FORMULA.ovenProfile);
    expect(clean.leavenMode).toBe(DEFAULT_FORMULA.leavenMode);
    expect(clean.startTime).toBe(DEFAULT_FORMULA.startTime);
  });

  it("uses defaults for missing values and normalizes a valid time", () => {
    const clean = sanitizeFormula({ hydration: null, startTime: "9:05" });
    expect(clean.hydration).toBe(DEFAULT_FORMULA.hydration);
    expect(clean.startTime).toBe("09:05");
  });

  it("rejects invalid or truncated links", () => {
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("garbage")).toBeNull();
    expect(decodeShare("a".repeat(5000))).toBeNull();
  });
});
