import { describe, expect, it } from "vitest";
import { MAX_TIMER_MINUTES, clampTimerMinutes, formatCountdown, minutesUntil } from "./timer";

describe("kitchen timer helpers", () => {
  it("formats a countdown without ever showing zero early", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-4000)).toBe("00:00");
    expect(formatCountdown(59_400)).toBe("01:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(3_600_000)).toBe("1:00:00");
    expect(formatCountdown(3_725_000)).toBe("1:02:05");
  });

  it("rounds the next step up to whole minutes", () => {
    const from = new Date("2026-11-17T10:00:00.000Z");
    expect(minutesUntil(new Date("2026-11-17T10:01:30.000Z"), from)).toBe(2);
    expect(minutesUntil(new Date("2026-11-17T10:20:00.000Z"), from)).toBe(20);
    expect(minutesUntil(new Date("2026-11-17T10:00:00.000Z"), from)).toBe(1);
    expect(minutesUntil(new Date("2026-11-17T09:40:00.000Z"), from)).toBe(1);
  });

  it("caps durations at a day and rejects junk input", () => {
    expect(clampTimerMinutes(0)).toBe(1);
    expect(clampTimerMinutes(-5)).toBe(1);
    expect(clampTimerMinutes(Number.NaN)).toBe(1);
    expect(clampTimerMinutes(12.6)).toBe(13);
    expect(clampTimerMinutes(MAX_TIMER_MINUTES + 500)).toBe(MAX_TIMER_MINUTES);
    expect(minutesUntil(new Date("2027-01-01T00:00:00.000Z"), new Date("2026-11-17T10:00:00.000Z"))).toBe(
      MAX_TIMER_MINUTES,
    );
  });
});
