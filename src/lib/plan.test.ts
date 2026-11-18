import { describe, expect, it } from "vitest";
import { normalizePlan } from "./plan";

describe("dinner plan normalization", () => {
  it("replaces impossible dates, times and counts", () => {
    const plan = normalizePlan({
      serveDate: "2026-02-30",
      serveTime: "25:00",
      guests: 0,
      piesPerGuest: 99,
      ballWeight: 1,
    });

    expect(plan.serveDate).not.toBe("2026-02-30");
    expect(plan.serveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.serveTime).toBe("19:00");
    expect(plan.guests).toBe(1);
    expect(plan.piesPerGuest).toBe(5);
    expect(plan.ballWeight).toBe(80);
  });

  it("keeps a valid plan intact", () => {
    const plan = normalizePlan({
      serveDate: "2026-11-17",
      serveTime: "18:30",
      guests: 6,
      piesPerGuest: 2,
      ballWeight: 300,
    });

    expect(plan).toEqual({
      serveDate: "2026-11-17",
      serveTime: "18:30",
      guests: 6,
      piesPerGuest: 2,
      ballWeight: 300,
    });
  });

  it("falls back to a usable plan for non-objects", () => {
    const plan = normalizePlan(null);
    expect(plan.guests).toBe(4);
    expect(plan.piesPerGuest).toBe(2);
    expect(plan.ballWeight).toBe(280);
  });
});
