import { clamp } from "./format";

export interface PlanSettings {
  serveDate: string;
  serveTime: string;
  guests: number;
  piesPerGuest: number;
  ballWeight: number;
}

function todayISO(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function isDateInput(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

function isTimeInput(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const DEFAULT_PLAN: PlanSettings = {
  serveDate: todayISO(),
  serveTime: "19:00",
  guests: 4,
  piesPerGuest: 2,
  ballWeight: 280,
};

export function normalizePlan(raw: unknown): PlanSettings {
  const input = raw && typeof raw === "object" ? (raw as Partial<PlanSettings>) : {};
  return {
    serveDate: isDateInput(input.serveDate) ? input.serveDate : todayISO(),
    serveTime: isTimeInput(input.serveTime) ? input.serveTime : DEFAULT_PLAN.serveTime,
    guests: clamp(Math.round(finite(input.guests, DEFAULT_PLAN.guests)), 1, 40),
    piesPerGuest: clamp(
      Math.round(finite(input.piesPerGuest, DEFAULT_PLAN.piesPerGuest)),
      1,
      5,
    ),
    ballWeight: clamp(finite(input.ballWeight, DEFAULT_PLAN.ballWeight), 80, 900),
  };
}
