import { fmtNumber, round, safe } from "./format";
import type { TempUnit } from "./types";

/** Celsius in, the selected display unit out. */
export function toTempValue(celsius: number, unit: TempUnit): number {
  return unit === "f" ? (safe(celsius) * 9) / 5 + 32 : safe(celsius);
}

/** A value typed in the selected unit, back in Celsius. */
export function fromTempValue(value: number, unit: TempUnit): number {
  return unit === "f" ? ((safe(value) - 32) * 5) / 9 : safe(value);
}

/** Temperature *differences* (friction, corrections) scale but do not shift. */
export function toTempDelta(celsius: number, unit: TempUnit): number {
  return unit === "f" ? (safe(celsius) * 9) / 5 : safe(celsius);
}

export function fromTempDelta(value: number, unit: TempUnit): number {
  return unit === "f" ? (safe(value) * 5) / 9 : safe(value);
}

export function tempSuffix(unit: TempUnit): string {
  return unit === "f" ? "°F" : "°C";
}

export function fmtTemp(celsius: number, unit: TempUnit, digits = 0): string {
  return `${fmtNumber(toTempValue(celsius, unit), digits)}${tempSuffix(unit)}`;
}

export function fmtTempDelta(celsius: number, unit: TempUnit, digits = 1): string {
  return `${fmtNumber(toTempDelta(celsius, unit), digits)}${tempSuffix(unit)}`;
}

/** A temperature a baker typed, snapped back to a tidy half degree. */
export function tempFromInput(value: number, unit: TempUnit): number {
  if (unit === "c") return value;
  return round(fromTempValue(value, unit) * 2, 0) / 2;
}

/** The same value rounded for display inside a slider or input. */
export function tempForInput(celsius: number, unit: TempUnit): number {
  return unit === "f" ? round(toTempValue(celsius, unit), 0) : round(celsius, 1);
}

const TEMPERATURE_IN_TEXT = /(-?\d+(?:\.\d+)?)(?:\s*[–—-]\s*(\d+(?:\.\d+)?))?\s*°C/g;

/**
 * Rewrites oven notes and schedule copy written in °C ("Launch at 430–450°C")
 * so a Fahrenheit baker never has to convert prose in their head.
 */
export function convertTempText(text: string, unit: TempUnit): string {
  if (unit === "c" || !text.includes("°C")) return text;
  return text.replace(TEMPERATURE_IN_TEXT, (_match, low: string, high?: string) => {
    const fahrenheit = (value: string) => fmtNumber(toTempValue(Number(value), "f"), 0);
    // A range keeps one unit at the end: "430–450°C" → "806–842°F".
    return high
      ? `${fahrenheit(low)}–${fahrenheit(high)}${tempSuffix(unit)}`
      : `${fahrenheit(low)}${tempSuffix(unit)}`;
  });
}
