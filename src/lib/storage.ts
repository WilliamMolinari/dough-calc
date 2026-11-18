import { clamp } from "./format";
import { sanitizeFormula } from "./formula";
import { repairLineage } from "./journal";
import { normalizeOutcomeTags } from "./outcomes";
import type {
  BakeActuals,
  BakeEntry,
  Formula,
  Ratings,
  TempUnit,
  Unit,
  VisionRead,
} from "./types";

/** Browsers give or take ~5 MB per origin; we meter against that expectation. */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

export type StoragePressure = "ok" | "watch" | "tight";

export function storagePressure(
  usedBytes: number,
  budget = STORAGE_BUDGET_BYTES,
): StoragePressure {
  if (!Number.isFinite(usedBytes) || usedBytes <= 0 || budget <= 0) return "ok";
  const ratio = usedBytes / budget;
  if (ratio >= 0.85) return "tight";
  if (ratio >= 0.6) return "watch";
  return "ok";
}

/** Rough UTF-16 size of everything DoughLab owns in this browser. */
export function measureStoredBytes(): number {
  if (typeof localStorage === "undefined") return 0;
  let bytes = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("doughlab.")) continue;
      const value = localStorage.getItem(key) ?? "";
      bytes += (key.length + value.length) * 2;
    }
  } catch {
    return bytes;
  }
  return bytes;
}

export interface StorageEstimateInfo {
  bytes: number;
  budget: number;
}

/**
 * Real origin usage when the browser exposes it (localStorage + IndexedDB +
 * caches), with the old 5 MB localStorage measure as a fallback.
 */
export async function estimateStorage(): Promise<StorageEstimateInfo> {
  const fallback = { bytes: measureStoredBytes(), budget: STORAGE_BUDGET_BYTES };
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return fallback;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage === "number" && typeof quota === "number" && quota > 0) {
      return { bytes: Math.max(0, usage), budget: quota };
    }
  } catch {
    /* fall through to the localStorage meter */
  }
  return fallback;
}

/** The localStorage mirror omits photo bytes once IndexedDB holds the journal. */
export function stripBakePhotos(bakes: BakeEntry[]): BakeEntry[] {
  return bakes.map((bake) => (bake.photos.length ? { ...bake, photos: [] } : bake));
}

export const STORAGE_KEYS = {
  formula: "doughlab.formula.v1",
  unit: "doughlab.unit.v1",
  tempUnit: "doughlab.tempUnit.v1",
  bakes: "doughlab.bakes.v1",
  lastBackup: "doughlab.lastBackup.v1",
  plan: "doughlab.plan.v1",
  kitchenTimer: "doughlab.kitchenTimer.v1",
} as const;

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      error:
        /quota/i.test(name + message)
          ? "Browser storage is full. Remove a photo from an older bake and try again."
          : "Could not save to this browser's storage.",
    };
  }
}

export function loadFormula(): Formula {
  return sanitizeFormula(readStored<unknown>(STORAGE_KEYS.formula, {}));
}

export function loadUnit(): Unit {
  return readStored<unknown>(STORAGE_KEYS.unit, "g") === "oz" ? "oz" : "g";
}

export function loadTempUnit(): TempUnit {
  return readStored<unknown>(STORAGE_KEYS.tempUnit, "c") === "f" ? "f" : "c";
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function validIso(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function optionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return clamp(parsed, min, max);
}

function normalizeActuals(raw: unknown): BakeActuals | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const actuals = raw as Record<string, unknown>;
  const normalized: BakeActuals = {
    doughTempC: optionalNumber(actuals.doughTempC, 0, 60),
    roomTempC: optionalNumber(actuals.roomTempC, -20, 60),
    bakeMinutes: optionalNumber(actuals.bakeMinutes, 0, 180),
  };
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

function normalizeVision(raw: unknown): VisionRead | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const entry = raw as Record<string, unknown>;
  const summary = text(entry.summary).replace(/\s+/g, " ").trim().slice(0, 900);
  if (!summary) return undefined;

  const source =
    entry.ratings && typeof entry.ratings === "object"
      ? (entry.ratings as Record<string, unknown>)
      : {};
  const ratings: VisionRead["ratings"] = {};
  for (const key of ["crust", "crumb", "overall"] as const) {
    const value = optionalNumber(source[key], 0, 5);
    if (value !== undefined && value > 0) ratings[key] = Math.round(value);
  }

  return {
    summary,
    observations: Array.isArray(entry.observations)
      ? entry.observations
          .filter((item): item is string => typeof item === "string" && !!item.trim())
          .map((item) => item.replace(/\s+/g, " ").trim().slice(0, 160))
          .slice(0, 6)
      : [],
    tags: normalizeOutcomeTags(entry.tags),
    ratings,
    confidence:
      entry.confidence === "low" || entry.confidence === "high" ? entry.confidence : "medium",
    photoCount: Math.max(0, Math.min(6, Math.round(number(entry.photoCount)))),
    model: text(entry.model).slice(0, 80),
    at: validIso(entry.at) ?? new Date().toISOString(),
  };
}

function normalizeRatings(raw: unknown): Ratings {
  const ratings =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rating = (key: keyof Ratings) => clamp(Math.round(number(ratings[key])), 0, 5);
  return {
    crust: rating("crust"),
    crumb: rating("crumb"),
    extensibility: rating("extensibility"),
    flavor: rating("flavor"),
    overall: rating("overall"),
  };
}

export function normalizeBakes(stored: unknown): BakeEntry[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const bakes: BakeEntry[] = [];

  for (const item of stored) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);

    bakes.push({
      id,
      createdAt: validIso(entry.createdAt) ?? new Date().toISOString(),
      updatedAt: validIso(entry.updatedAt) ?? undefined,
      name: text(entry.name).trim() || "Untitled bake",
      styleId: text(entry.styleId),
      styleName: text(entry.styleName) || "Custom",
      formula: sanitizeFormula(entry.formula),
      unit: entry.unit === "oz" ? "oz" : "g",
      ratings: normalizeRatings(entry.ratings),
      notes: text(entry.notes),
      flourBrand: text(entry.flourBrand),
      oven: text(entry.oven),
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === "string" && !!tag.trim())
        : [],
      photos: Array.isArray(entry.photos)
        ? entry.photos.filter((photo): photo is string => typeof photo === "string")
        : [],
      totalDough: Math.max(0, number(entry.totalDough)),
      parentId: text(entry.parentId).trim() || undefined,
      rootId: text(entry.rootId).trim() || undefined,
      nextTimeNotes: text(entry.nextTimeNotes),
      bakedAt: validIso(entry.bakedAt) ?? undefined,
      hypothesis: text(entry.hypothesis).trim() || undefined,
      outcomeTags: normalizeOutcomeTags(entry.outcomeTags),
      actuals: normalizeActuals(entry.actuals),
      vision: normalizeVision(entry.vision),
    });
  }

  return repairLineage(bakes);
}

export function loadBakes(): BakeEntry[] {
  return normalizeBakes(readStored<unknown>(STORAGE_KEYS.bakes, []));
}
