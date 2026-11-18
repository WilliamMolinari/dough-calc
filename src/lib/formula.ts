import { FLOUR_NAME_MAX, FLOUR_TYPES } from "./flours";
import { clamp } from "./format";
import { OVEN_PROFILES } from "./ovens";
import { DEFAULT_FORMULA, STYLES } from "./presets";
import type { Formula } from "./types";

const NUMBER_BOUNDS: Partial<Record<keyof Formula, [number, number]>> = {
  flourWeight: [10, 20000],
  flour2Pct: [0, 95],
  ballCount: [1, 80],
  ballWeight: [40, 1200],
  hydration: [30, 120],
  salt: [0, 12],
  diastaticMalt: [0, 2],
  starterPct: [0, 100],
  yeastPct: [0, 8],
  prefermentPct: [0, 90],
  prefermentHydration: [30, 120],
  sweetenerPct: [0, 20],
  oil: [0, 30],
  roomTemp: [1, 45],
  fridgeTemp: [-2, 20],
  bulkHours: [0, 96],
  retardHours: [0, 120],
  temperHours: [0, 24],
};

const LEAVEN = ["sourdough", "yeast", "preferment"] as const;
const YEAST = ["idy", "ady", "fresh"] as const;
const PREFERMENT = ["poolish", "biga"] as const;
const SWEETENER = ["none", "sugar", "honey", "malt"] as const;

function cleanFlourName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, FLOUR_NAME_MAX);
}

function sanitizeStartTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** Accepts data from storage, a backup or a link and returns a safe formula. */
export function sanitizeFormula(raw: unknown): Formula {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: Formula = { ...DEFAULT_FORMULA };

  for (const [key, bounds] of Object.entries(NUMBER_BOUNDS) as Array<
    [keyof Formula, [number, number]]
  >) {
    const rawValue = input[key];
    const value = rawValue === null || rawValue === undefined ? Number.NaN : Number(rawValue);
    if (Number.isFinite(value)) {
      (next as unknown as Record<string, unknown>)[key] = clamp(value, bounds[0], bounds[1]);
    }
  }

  if (LEAVEN.includes(input.leavenMode as (typeof LEAVEN)[number])) {
    next.leavenMode = input.leavenMode as Formula["leavenMode"];
  }
  if (YEAST.includes(input.yeastType as (typeof YEAST)[number])) {
    next.yeastType = input.yeastType as Formula["yeastType"];
  }
  if (PREFERMENT.includes(input.prefermentKind as (typeof PREFERMENT)[number])) {
    next.prefermentKind = input.prefermentKind as Formula["prefermentKind"];
  }
  if (SWEETENER.includes(input.sweetener as (typeof SWEETENER)[number])) {
    next.sweetener = input.sweetener as Formula["sweetener"];
  }
  if (
    typeof input.flour2Type === "string" &&
    FLOUR_TYPES.some((flour) => flour.id === input.flour2Type)
  ) {
    next.flour2Type = input.flour2Type;
  }
  if (input.sizing === "flour" || input.sizing === "balls") next.sizing = input.sizing;
  if (typeof input.styleId === "string" && STYLES.some((style) => style.id === input.styleId)) {
    next.styleId = input.styleId;
  }
  if (
    typeof input.ovenProfile === "string" &&
    OVEN_PROFILES.some((oven) => oven.id === input.ovenProfile)
  ) {
    next.ovenProfile = input.ovenProfile;
  }
  next.baseFlourName = cleanFlourName(input.baseFlourName);
  next.flour2Name = cleanFlourName(input.flour2Name);
  const startTime = sanitizeStartTime(input.startTime);
  if (startTime) next.startTime = startTime;
  if (typeof input.autoLeaven === "boolean") next.autoLeaven = input.autoLeaven;
  next.ballCount = Math.max(1, Math.round(next.ballCount));
  return next;
}
