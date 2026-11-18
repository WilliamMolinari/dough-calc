import { describe, expect, it } from "vitest";
import { feedMultiplier, planStarterBuild } from "./starter";

const mixAt = new Date("2026-11-20T09:00:00");

describe("sourdough starter builds", () => {
  it("knows what a feeding ratio multiplies", () => {
    expect(feedMultiplier(1)).toBe(3);
    expect(feedMultiplier(5)).toBe(11);
    expect(feedMultiplier(10)).toBe(21);
  });

  it("reaches the target in one feed when the ratio is generous", () => {
    const plan = planStarterBuild({ neededGrams: 200, seedGrams: 20, ratio: 5, intervalHours: 8, mixAt });
    expect(plan.feeds).toHaveLength(1);
    expect(plan.feeds[0].seed).toBe(20);
    expect(plan.feeds[0].flour).toBe(100);
    expect(plan.feeds[0].water).toBe(100);
    expect(plan.finalGrams).toBe(220);
    expect(plan.leftoverGrams).toBe(20);
    expect(plan.totalFlour).toBe(100);
  });

  it("adds feeds until it has enough and spaces them backwards from mix time", () => {
    const plan = planStarterBuild({ neededGrams: 200, seedGrams: 20, ratio: 1, intervalHours: 8, mixAt });
    expect(plan.feeds).toHaveLength(3);
    expect(plan.feeds.map((feed) => feed.total)).toEqual([60, 180, 540]);
    expect(plan.finalGrams).toBe(540);
    expect(plan.leftoverGrams).toBe(340);

    const times = plan.feeds.map((feed) => feed.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(plan.firstFeedAt?.getTime()).toBe(mixAt.getTime() - 24 * 3_600_000);
    expect(plan.feeds[2].at.getTime()).toBe(mixAt.getTime() - 8 * 3_600_000);
  });

  it("says so when the seed is already enough", () => {
    const plan = planStarterBuild({ neededGrams: 200, seedGrams: 300, ratio: 5, intervalHours: 8, mixAt });
    expect(plan.feeds).toHaveLength(0);
    expect(plan.firstFeedAt).toBeNull();
    expect(plan.finalGrams).toBe(300);
    expect(plan.note).toContain("already covers");
  });

  it("keeps nonsense input inside the kitchen", () => {
    const plan = planStarterBuild({
      neededGrams: Number.NaN,
      seedGrams: -4,
      ratio: 99,
      intervalHours: 0,
      mixAt: new Date("nonsense"),
    });
    expect(plan.needed).toBeGreaterThanOrEqual(1);
    expect(plan.seedGrams).toBeGreaterThanOrEqual(1);
    expect(plan.ratio).toBeLessThanOrEqual(20);
    expect(Number.isFinite(plan.finalGrams)).toBe(true);
    expect(plan.note.length).toBeGreaterThan(0);
  });
});
