export const G_PER_OZ = 28.349523125;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Never returns NaN/Infinity. */
export function safe(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export function round(n: number, precision = 0): number {
  const p = 10 ** precision;
  return Math.round(safe(n) * p) / p;
}

export function toUnit(grams: number, unit: "g" | "oz"): number {
  return unit === "g" ? grams : grams / G_PER_OZ;
}

export function fmtNumber(n: number, decimals = 0): string {
  const v = safe(n);
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Adaptive decimals so 0.8 g yeast never renders as "1". */
function weightDecimals(value: number, unit: "g" | "oz"): number {
  if (unit === "g") {
    if (value === 0) return 0;
    if (value < 1) return 2;
    if (value < 10) return 1;
    return 0;
  }
  if (value === 0) return 0;
  if (value < 0.1) return 2;
  if (value < 10) return 1;
  return 0;
}

export function fmtWeight(grams: number, unit: "g" | "oz"): string {
  const value = toUnit(safe(grams), unit);
  return `${fmtNumber(value, weightDecimals(value, unit))} ${unit}`;
}

export function fmtWeightValue(grams: number, unit: "g" | "oz"): string {
  const value = toUnit(safe(grams), unit);
  return fmtNumber(value, weightDecimals(value, unit));
}

export function fmtPct(n: number, decimals = 1): string {
  return `${fmtNumber(safe(n), decimals)}%`;
}

export function fmtHours(hours: number): string {
  const h = Math.max(0, safe(hours));
  if (h === 0) return "0 h";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 60) return `${whole + 1} h`;
  if (whole === 0) return `${mins} min`;
  if (mins === 0) return `${whole} h`;
  return `${whole} h ${mins} min`;
}

export function fmtClock(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function parseTimeOfDay(value: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!match) return { h: 9, m: 0 };
  return {
    h: Math.min(23, Math.max(0, Number(match[1]))),
    m: Math.min(59, Math.max(0, Number(match[2]))),
  };
}
