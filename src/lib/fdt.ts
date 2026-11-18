import { clamp, round } from "./format";

export interface FdtSettings {
  targetFdt: number;
  flourTemp: number;
  friction: number;
  /** Kitchen-specific correction learned from a measured mix. */
  offsetC: number;
  updatedAt?: string;
  samples?: number;
}

export const FDT_STORAGE = "doughlab.fdt.v1";

export const DEFAULT_FDT: FdtSettings = {
  targetFdt: 24,
  flourTemp: 22,
  friction: 3,
  offsetC: 0,
  samples: 0,
};

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeFdtSettings(raw: unknown): FdtSettings {
  const input = raw && typeof raw === "object" ? (raw as Partial<FdtSettings>) : {};
  return {
    targetFdt: clamp(number(input.targetFdt, DEFAULT_FDT.targetFdt), 18, 30),
    flourTemp: clamp(number(input.flourTemp, DEFAULT_FDT.flourTemp), 5, 35),
    // Zero friction is valid for a no-machine mix, so do not use `||`.
    friction: clamp(number(input.friction, DEFAULT_FDT.friction), 0, 8),
    offsetC: clamp(number(input.offsetC, 0), -5, 5),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
    samples: Math.max(0, Math.round(number(input.samples, 0))),
  };
}

export function loadFdtSettings(): FdtSettings {
  try {
    const raw = localStorage.getItem(FDT_STORAGE);
    return raw ? normalizeFdtSettings(JSON.parse(raw)) : { ...DEFAULT_FDT };
  } catch {
    return { ...DEFAULT_FDT };
  }
}

export function saveFdtSettings(settings: FdtSettings): void {
  try {
    localStorage.setItem(FDT_STORAGE, JSON.stringify(settings));
  } catch {
    /* settings are nice to have */
  }
}

/**
 * Standard three-component mix: water, room air and flour, plus a friction
 * allowance for the mixer. The measured-offset correction is applied here so
 * the suggestion gets closer to the baker's real kitchen every time.
 */
export function estimateWaterTemp(
  settings: Pick<FdtSettings, "targetFdt" | "flourTemp" | "friction" | "offsetC">,
  roomTemp: number,
): number {
  const base = settings.targetFdt * 3 - (roomTemp + settings.flourTemp + settings.friction);
  return round(clamp(base - settings.offsetC * 3, -5, 60), 1);
}

export function estimateDoughTemp(
  waterTemp: number,
  roomTemp: number,
  settings: Pick<FdtSettings, "flourTemp" | "friction">,
): number {
  return round((waterTemp + roomTemp + settings.flourTemp + settings.friction) / 3, 1);
}

/** Turn one measured mix into a personal correction. */
export function calibrate(
  settings: FdtSettings,
  measuredDoughTemp: number,
  waterTempUsed: number,
  roomTemp: number,
): FdtSettings {
  const predicted = estimateDoughTemp(waterTempUsed, roomTemp, settings);
  const sampleOffset = measuredDoughTemp - predicted;
  const samples = (settings.samples ?? 0) + 1;
  // Weight new evidence a little more heavily, then keep it inside sanity bounds.
  const blended = samples <= 2 ? sampleOffset : settings.offsetC * 0.55 + sampleOffset * 0.45;
  return {
    ...settings,
    offsetC: round(clamp(blended, -5, 5), 1),
    samples,
    updatedAt: new Date().toISOString(),
  };
}

export function resetCalibration(settings: FdtSettings): FdtSettings {
  return { ...settings, offsetC: 0, samples: 0, updatedAt: undefined };
}
