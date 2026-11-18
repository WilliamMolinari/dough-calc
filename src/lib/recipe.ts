import type { DoughMath } from "./calc";
import type { Formula, Unit } from "./types";
import { baseFlourLabel, flourLabel, secondFlourShare } from "./flours";
import { fmtWeight } from "./format";

export const YEAST_LABEL: Record<Formula["yeastType"], string> = {
  idy: "Instant dry yeast",
  ady: "Active dry yeast",
  fresh: "Fresh yeast",
};

export const SWEETENER_LABEL: Record<Formula["sweetener"], string> = {
  none: "None",
  sugar: "Sugar",
  honey: "Honey",
  malt: "Malt extract",
};

export interface IngredientLine {
  key: string;
  label: string;
  grams: number;
  note?: string;
  accent?: "flour" | "flour2" | "water" | "leaven" | "extra";
}

/**
 * Weights to *add now*. Pre-ferment / starter flour and water are already
 * subtracted from the flour and water lines, so the list sums to the batch.
 */
export function ingredientLines(formula: Formula, math: DoughMath, unit: Unit): IngredientLine[] {
  const lines: IngredientLine[] = [];
  const heldFlour = math.flour - math.flourToAdd;
  const heldWater = math.water - math.waterToAdd;

  // A blend splits the total flour. The pre-ferment still comes out of the base
  // flour, so the two flour lines together still add up to the batch.
  const secondary = Math.min(Math.max(0, math.flourSecondary ?? 0), math.flour);
  const primary = math.flour - secondary;
  const secondaryFlourLabel = flourLabel(formula.flour2Type, formula.flour2Name);

  lines.push({
    key: "flour",
    label: baseFlourLabel(formula),
    grams: Math.max(0, primary - heldFlour),
    note:
      heldFlour > 0.5
        ? secondary > 0.5
          ? `${fmtWeight(primary, unit)} base · ${fmtWeight(heldFlour, unit)} held in the pre-ferment`
          : `${fmtWeight(math.flour, unit)} total, ${fmtWeight(heldFlour, unit)} is pre-fermented`
        : secondary > 0.5
          ? `${fmtWeight(primary, unit)} of the blend`
          : undefined,
    accent: "flour",
  });
  if (secondary > 0.5) {
    lines.push({
      key: "flour2",
      label: secondaryFlourLabel,
      grams: secondary,
      note: `${Math.round(secondFlourShare(formula))}% of the flour blend`,
      accent: "flour2",
    });
  }
  lines.push({
    key: "water",
    label: "Water",
    grams: math.waterToAdd,
    note: heldWater > 0.5 ? `${fmtWeight(math.water, unit)} total, ${fmtWeight(heldWater, unit)} is in the pre-ferment` : undefined,
    accent: "water",
  });
  lines.push({ key: "salt", label: "Salt", grams: math.salt, accent: "extra" });
  if (math.diastaticMalt > 0.005) {
    lines.push({
      key: "malt",
      label: "Diastatic malt powder",
      grams: math.diastaticMalt,
      note: `${Number(Number(formula.diastaticMalt).toFixed(2))}% of flour`,
      accent: "extra",
    });
  }

  if (formula.leavenMode === "sourdough") {
    lines.push({
      key: "starter",
      label: "Sourdough starter",
      grams: math.starter,
      note: "100% hydration · 50% flour, 50% water",
      accent: "leaven",
    });
  }

  if (formula.leavenMode === "preferment") {
    const prefMass = math.prefermentFlour + math.prefermentWater + math.prefermentYeast;
    lines.push({
      key: "preferment",
      label: formula.prefermentKind === "poolish" ? "Poolish" : "Biga",
      grams: prefMass,
      note: `${fmtWeight(math.prefermentFlour, unit)} flour + ${fmtWeight(math.prefermentWater, unit)} water + ${fmtWeight(math.prefermentYeast, unit)} yeast`,
      accent: "leaven",
    });
    const finalYeast = Math.max(0, math.yeast - math.prefermentYeast);
    if (finalYeast > 0.005) {
      lines.push({
        key: "yeast",
        label: YEAST_LABEL[formula.yeastType],
        grams: finalYeast,
        note: `${formula.yeastPct.toFixed(2)}% total · rest in the final dough`,
        accent: "leaven",
      });
    }
  } else if (formula.leavenMode === "yeast" && math.yeast > 0) {
    lines.push({
      key: "yeast",
      label: YEAST_LABEL[formula.yeastType],
      grams: math.yeast,
      note: `${formula.yeastPct.toFixed(2)}% of flour`,
      accent: "leaven",
    });
  }

  if (formula.sweetener !== "none" && math.sweetener > 0) {
    lines.push({
      key: "sweetener",
      label: SWEETENER_LABEL[formula.sweetener],
      grams: math.sweetener,
      note: `${formula.sweetenerPct}% of flour`,
      accent: "extra",
    });
  }
  if (math.oil > 0) {
    lines.push({
      key: "oil",
      label: "Olive oil",
      grams: math.oil,
      note: `${formula.oil}% of flour`,
      accent: "extra",
    });
  }

  return lines;
}

export function leavenSummary(formula: Formula, math: DoughMath, unit: Unit): string {
  if (formula.leavenMode === "sourdough") {
    return `Starter ${formula.starterPct}% · ${fmtWeight(math.starter, unit)}`;
  }
  if (formula.leavenMode === "preferment") {
    return `${formula.prefermentKind === "poolish" ? "Poolish" : "Biga"} ${formula.prefermentPct}% · ${YEAST_LABEL[formula.yeastType]} ${formula.yeastPct}%`;
  }
  return `${YEAST_LABEL[formula.yeastType]} ${formula.yeastPct}% · ${fmtWeight(math.yeast, unit)}`;
}

