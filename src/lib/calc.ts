import type { Formula, TempUnit } from "./types";
import { clamp, fmtHours, parseTimeOfDay, round, safe } from "./format";
import { getOvenProfile } from "./ovens";
import { convertTempText, fmtTemp } from "./temperature";

export type PaceTone = "slow" | "steady" | "fast";

export interface DoughMath {
  flour: number;
  flourToAdd: number;
  /** Grams of that flour which come from the second flour in the blend. */
  flourSecondary: number;
  water: number;
  waterToAdd: number;
  salt: number;
  /** Grams of diastatic malt powder. */
  diastaticMalt: number;
  sweetener: number;
  oil: number;
  yeast: number;
  starter: number;
  starterFlour: number;
  starterWater: number;
  prefermentFlour: number;
  prefermentWater: number;
  prefermentYeast: number;
  prefermentPct: number;
  totalDough: number;
  ballCount: number;
  /** Per ball, or per pan when the batch is sized by pan. */
  ballWeight: number;
  /** Pan area in cm², whether or not pan sizing is active. */
  panArea: number;
  /** Dough that fits one pan at the chosen loading. */
  panDough: number;
  panLoading: number;
  effectiveHours: number;
  suggestedYeastPct: number;
  suggestedStarterPct: number;
  actualLeavenPct: number;
  pace: number;
  paceLabel: string;
  paceNote: string;
  paceTone: PaceTone;
  feel: { label: string; note: string };
  trueHydration: number;
}

const num = (n: number, min: number, max: number, fallback = 0) =>
  clamp(safe(n, fallback), min, max);

/** Fermentation speed relative to a 24°C kitchen (~2× every 7°C). */
export function fermentationRate(tempC: number): number {
  return Math.pow(2, (clamp(safe(tempC, 22), 0, 45) - 24) / 7);
}

/**
 * Convert a dose of a given yeast type into instant-dry-yeast equivalents.
 * Fresh yeast is ~3× the mass of IDY for the same activity.
 */
export function yeastIdyEquivalent(pct: number, type: Formula["yeastType"]): number {
  if (type === "fresh") return pct / 3;
  if (type === "ady") return pct / 1.25;
  return pct;
}

/** Recommended IDY % for an effective fermentation window. */
export function suggestYeastPct(effectiveHours: number): number {
  return round(clamp(1.15 / Math.max(effectiveHours, 0.4), 0.02, 1.5), 2);
}

export function suggestStarterPct(effectiveHours: number): number {
  return round(clamp(132 / Math.max(effectiveHours, 0.8), 2, 60), 0);
}

export function yeastForType(idyPct: number, type: Formula["yeastType"]): number {
  if (type === "fresh") return round(idyPct * 3, 2);
  if (type === "ady") return round(idyPct * 1.25, 2);
  return round(idyPct, 2);
}

export function doughFeel(hydration: number): { label: string; note: string } {
  const h = safe(hydration, 62);
  if (h < 58) return { label: "Stiff & tight", note: "Rolls out cleanly — think bagels and cracker-thin bases." };
  if (h < 62) return { label: "Firm", note: "Bagel-adjacent. Easy to handle, chewy crumb." };
  if (h < 66) return { label: "Classic", note: "The hand-stretch sweet spot. Silky and cooperative." };
  if (h < 70) return { label: "Open & airy", note: "Sticky at first, then beautifully extensible." };
  if (h < 75) return { label: "High hydration", note: "Slap-and-fold territory. Big, glossy crumb." };
  if (h < 80) return { label: "Very wet", note: "Needs coil folds and confident shaping." };
  return { label: "Extreme", note: "Barely a dough. Wet your hands and trust the gluten." };
}

function paceFromRatio(ratio: number): { label: string; note: string; tone: PaceTone } {
  if (ratio < 0.6)
    return {
      label: "Slow lane",
      note: "Less leaven than this schedule wants — expect a longer wait or move the dough somewhere warm.",
      tone: "slow",
    };
  if (ratio < 0.85)
    return {
      label: "Gentle",
      note: "A relaxed ferment. Great flavour, but check the dough rather than the clock.",
      tone: "slow",
    };
  if (ratio <= 1.15)
    return {
      label: "On schedule",
      note: "Leaven and timings are matched. Follow the timeline as written.",
      tone: "steady",
    };
  if (ratio <= 1.5)
    return {
      label: "Brisk",
      note: "A little more leaven than the clock needs — watch for early doubling.",
      tone: "fast",
    };
  return {
    label: "Fast lane",
    note: "A lot of leaven for this window. Shorten bulk or drop the fridge temperature.",
    tone: "fast",
  };
}

export function calculateDough(formula: Formula): DoughMath {
  const hydration = num(formula.hydration, 30, 120, 65);
  const saltPct = num(formula.salt, 0, 12, 2.5);
  const maltPct = num(formula.diastaticMalt, 0, 2, 0);
  const oilPct = num(formula.oil, 0, 30, 0);
  const sweetPct = formula.sweetener === "none" ? 0 : num(formula.sweetenerPct, 0, 20, 0);
  const roomTemp = num(formula.roomTemp, 1, 45, 22);
  const fridgeTemp = num(formula.fridgeTemp, -2, 20, 4);
  const bulkHours = num(formula.bulkHours, 0, 96, 2);
  const retardHours = num(formula.retardHours, 0, 120, 22);
  const temperHours = num(formula.temperHours, 0, 24, 1);
  const ballCount = Math.max(1, Math.round(num(formula.ballCount, 1, 80, 4)));
  const ballWeightInput = num(formula.ballWeight, 40, 1200, 280);
  const panLength = num(formula.panLength, 10, 80, 30);
  const panWidth = num(formula.panWidth, 10, 60, 20);
  const doughLoading = num(formula.doughLoading, 0.2, 1.6, 0.75);
  const panArea = panLength * panWidth;
  const panDough = panArea * doughLoading;

  const starterPct = formula.leavenMode === "sourdough" ? num(formula.starterPct, 0, 100, 20) : 0;
  const yeastPct =
    formula.leavenMode === "yeast" || formula.leavenMode === "preferment"
      ? num(formula.yeastPct, 0, 8, 0.3)
      : 0;
  const prefermentPct =
    formula.leavenMode === "preferment" ? num(formula.prefermentPct, 0, 90, 30) : 0;
  const prefermentHydration =
    formula.leavenMode === "preferment"
      ? num(formula.prefermentHydration, 30, 120, formula.prefermentKind === "poolish" ? 100 : 55)
      : 0;

  // Baker's math, all percentages relative to total flour.
  const multiplier =
    1 +
    hydration / 100 +
    saltPct / 100 +
    sweetPct / 100 +
    oilPct / 100 +
    maltPct / 100 +
    yeastPct / 100;

  // Three ways to anchor a batch: flour weight, finished balls, or pans whose
  // area × loading already implies the dough weight.
  const flour =
    formula.sizing === "balls"
      ? (ballCount * ballWeightInput) / Math.max(multiplier, 0.5)
      : formula.sizing === "pan"
        ? (ballCount * panDough) / Math.max(multiplier, 0.5)
        : num(formula.flourWeight, 10, 20000, 1000);

  // The second flour is a share of total flour, not an addition to it.
  const flourSecondary = (flour * num(formula.flour2Pct, 0, 95, 0)) / 100;

  const water = (flour * hydration) / 100;
  const salt = (flour * saltPct) / 100;
  const diastaticMalt = (flour * maltPct) / 100;
  const sweetener = (flour * sweetPct) / 100;
  const oil = (flour * oilPct) / 100;
  const yeast = (flour * yeastPct) / 100;
  const starter = (flour * starterPct) / 100;
  const starterFlour = starter / 2;
  const starterWater = starter / 2;
  const prefermentFlour = (flour * prefermentPct) / 100;
  const prefermentWater = (prefermentFlour * prefermentHydration) / 100;
  const prefermentYeast = yeast * 0.2;
  const flourToAdd = Math.max(0, flour - starterFlour - prefermentFlour);
  const waterToAdd = Math.max(0, water - starterWater - prefermentWater);
  const totalDough = flour + water + salt + diastaticMalt + sweetener + oil + yeast;
  const ballWeight = totalDough / ballCount;

  const effectiveHours = round(
    bulkHours * fermentationRate(roomTemp) +
      retardHours * fermentationRate(fridgeTemp) +
      temperHours * fermentationRate(roomTemp),
    2,
  );
  const suggestedYeastPct = suggestYeastPct(effectiveHours);
  const suggestedStarterPct = suggestStarterPct(effectiveHours);

  const actualLeavenPct = formula.leavenMode === "sourdough" ? starterPct : yeastPct;
  const paceRatio =
    formula.leavenMode === "sourdough"
      ? starterPct / Math.max(suggestedStarterPct, 0.1)
      : yeastIdyEquivalent(yeastPct, formula.yeastType) / Math.max(suggestedYeastPct, 0.01);
  const pace = round(paceRatio, 2);
  const paceInfo = paceFromRatio(pace);

  return {
    flour,
    flourToAdd,
    flourSecondary,
    water,
    waterToAdd,
    salt,
    diastaticMalt,
    sweetener,
    oil,
    yeast,
    starter,
    starterFlour,
    starterWater,
    prefermentFlour,
    prefermentWater,
    prefermentYeast,
    prefermentPct,
    totalDough,
    ballCount,
    ballWeight,
    panArea,
    panDough,
    panLoading: doughLoading,
    effectiveHours,
    suggestedYeastPct,
    suggestedStarterPct,
    actualLeavenPct,
    pace,
    paceLabel: paceInfo.label,
    paceNote: paceInfo.note,
    paceTone: paceInfo.tone,
    feel: doughFeel(hydration),
    trueHydration: (water / Math.max(flour, 1)) * 100,
  };
}

export interface ScheduleStep {
  key: string;
  label: string;
  detail: string;
  at: Date;
  durationLabel?: string;
  kind: "mix" | "bulk" | "fold" | "chill" | "warm" | "fire" | "bake";
  minutesFromStart: number;
}

export function buildSchedule(
  formula: Formula,
  startISO = new Date(),
  tempUnit: TempUnit = "c",
): ScheduleStep[] {
  const bulk = num(formula.bulkHours, 0, 96, 2);
  const retard = num(formula.retardHours, 0, 120, 22);
  const temper = num(formula.temperHours, 0, 24, 1);
  const room = num(formula.roomTemp, 1, 45, 22);
  const oven = getOvenProfile(formula.ovenProfile);
  const { h, m } = parseTimeOfDay(formula.startTime);

  const start = new Date(startISO);
  start.setHours(h, m, 0, 0);
  const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

  const steps: ScheduleStep[] = [];
  const push = (
    key: string,
    label: string,
    detail: string,
    minutes: number,
    kind: ScheduleStep["kind"],
    durationLabel?: string,
  ) => {
    steps.push({ key, label, detail, at: at(minutes), minutesFromStart: minutes, kind, durationLabel });
  };

  const foldPoints: number[] = [];
  if (bulk >= 1.5) {
    const count = bulk >= 4 ? 4 : bulk >= 2.5 ? 3 : 2;
    const gap = Math.min(25, (bulk * 60) / (count + 2));
    for (let i = 1; i <= count; i += 1) foldPoints.push(Math.round(20 + gap * (i - 1)));
  }

  push(
    "mix",
    "Mix & rest",
    formula.leavenMode === "sourdough"
      ? "Flour + water autolyse 20 min, then salt and starter."
      : "Combine everything, then rest 20 min for the flour to hydrate.",
    0,
    "mix",
    "20 min",
  );

  let cursorMinutes = 20;
  if (foldPoints.length) {
    push(
      "folds",
      "Stretch & folds",
      `${foldPoints.length} sets, roughly every ${foldPoints.length > 1 ? Math.round(foldPoints[1] - foldPoints[0]) : 20} min during bulk.`,
      cursorMinutes + foldPoints[0],
      "fold",
    );
  }

  push(
    "bulk",
    formula.leavenMode === "sourdough" ? "Bulk ferment" : "Bulk ferment",
    `Target ${fmtTemp(room, tempUnit)} dough temperature · ${fmtHours(bulk)} · until domed and jiggly.`,
    cursorMinutes,
    "bulk",
    fmtHours(bulk),
  );
  cursorMinutes += Math.round(bulk * 60);

  if (retard > 0) {
    push(
      "ball",
      "Ball & cold retard",
      `Shape tight balls, then ${fmtHours(retard)} at ${fmtTemp(num(formula.fridgeTemp, -2, 20, 4), tempUnit)} in a sealed tray.`,
      cursorMinutes,
      "chill",
      fmtHours(retard),
    );
    cursorMinutes += Math.round(retard * 60);
  }

  if (temper > 0) {
    push(
      "temper",
      "Temper",
      `Leave covered at room temperature for ${fmtHours(temper)} before stretching.`,
      cursorMinutes,
      "warm",
      fmtHours(temper),
    );
    cursorMinutes += Math.round(temper * 60);
  }

  push(
    "fire",
    `Fire the ${oven.name.toLowerCase()}`,
    `Preheat to ${fmtTemp(oven.tempC, tempUnit)} for ${oven.preheatMin} minutes. ${convertTempText(oven.note, tempUnit)}`,
    cursorMinutes - oven.preheatMin,
    "fire",
    `${oven.preheatMin} min`,
  );
  push(
    "bake",
    "Bake",
    `Launch at ${fmtTemp(oven.tempC, tempUnit)} · about ${oven.bakeMin < 2 ? `${Math.round(oven.bakeMin * 60)} s` : `${oven.bakeMin} min`}. ${convertTempText(oven.note, tempUnit)}`,
    cursorMinutes,
    "bake",
    oven.bakeMin < 2 ? `${Math.round(oven.bakeMin * 60)} s` : `${oven.bakeMin} min`,
  );

  return steps.sort((a, b) => a.minutesFromStart - b.minutesFromStart);
}

export function bakeReadyAt(formula: Formula): Date {
  const steps = buildSchedule(formula);
  return steps[steps.length - 1]?.at ?? new Date();
}

export function hydrationBand(hydration: number): number {
  // 0 → 1 across the 50–90% range, for gauges and bars.
  return clamp((safe(hydration, 65) - 50) / 40, 0, 1);
}
