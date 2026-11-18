/** Longest timer the kitchen allows, so a typo can't park an alarm for days. */
export const MAX_TIMER_MINUTES = 24 * 60;

/** "09:59" under an hour, "1:02:03" above it. Rounds up so it never shows 00:00 early. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Whole minutes until `target`, at least one, never more than a day. */
export function minutesUntil(target: Date, from: Date = new Date()): number {
  const ms = target.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return 1;
  return Math.min(MAX_TIMER_MINUTES, Math.max(1, Math.ceil(ms / 60_000)));
}

/** Keeps a typed duration inside the kitchen timer's safe range. */
export function clampTimerMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 1;
  return Math.min(MAX_TIMER_MINUTES, Math.max(1, Math.round(minutes)));
}
