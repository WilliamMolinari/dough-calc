import { calculateDough } from "./calc";
import { fmtNumber, fmtWeight } from "./format";
import type { BakeEntry, Unit } from "./types";

export type ComparisonSection = "Recipe" | "Fermentation" | "Scores";

export interface ComparisonRow {
  label: string;
  section: ComparisonSection;
  a: number;
  b: number;
  unit: string;
  digits: number;
  /** Values are grams and should be formatted with the selected unit. */
  weight?: boolean;
  /** Positive deltas are improvements (ratings). */
  higherIsBetter?: boolean;
}

export interface ComparisonMeta {
  label: string;
  a: string;
  b: string;
}

export interface BakeComparison {
  rows: ComparisonRow[];
  meta: ComparisonMeta[];
}

/**
 * Build the numeric diff between two saved bakes. Values stay in their base
 * units (grams for weights) so the UI can render the same rows in g or oz.
 */
export function buildBakeComparison(a: BakeEntry, b: BakeEntry): BakeComparison {
  const mathA = calculateDough(a.formula);
  const mathB = calculateDough(b.formula);

  const recipeRows: ComparisonRow[] = [
    { label: "Hydration", section: "Recipe", a: a.formula.hydration, b: b.formula.hydration, unit: "%", digits: 1 },
    { label: "Salt", section: "Recipe", a: a.formula.salt, b: b.formula.salt, unit: "%", digits: 1 },
    { label: "Oil", section: "Recipe", a: a.formula.oil, b: b.formula.oil, unit: "%", digits: 1 },
    { label: "Total dough", section: "Recipe", a: mathA.totalDough, b: mathB.totalDough, unit: "", digits: 0, weight: true },
    { label: "Total flour", section: "Recipe", a: mathA.flour, b: mathB.flour, unit: "", digits: 0, weight: true },
    { label: "Water", section: "Recipe", a: mathA.water, b: mathB.water, unit: "", digits: 0, weight: true },
  ];

  if (a.formula.leavenMode === "sourdough" || b.formula.leavenMode === "sourdough") {
    recipeRows.push({
      label: "Starter",
      section: "Recipe",
      a: mathA.starter,
      b: mathB.starter,
      unit: "",
      digits: 0,
      weight: true,
    });
  }
  if (a.formula.leavenMode !== "sourdough" || b.formula.leavenMode !== "sourdough") {
    recipeRows.push({
      label: "Yeast",
      section: "Recipe",
      a: mathA.yeast,
      b: mathB.yeast,
      unit: "",
      digits: 0,
      weight: true,
    });
  }
  if (a.formula.sweetener !== "none" || b.formula.sweetener !== "none") {
    recipeRows.push({
      label: "Sweetener",
      section: "Recipe",
      a: mathA.sweetener,
      b: mathB.sweetener,
      unit: "",
      digits: 0,
      weight: true,
    });
  }

  const rows: ComparisonRow[] = [
    ...recipeRows,
    { label: "Salt weight", section: "Recipe", a: mathA.salt, b: mathB.salt, unit: "", digits: 0, weight: true },
    { label: "Oil weight", section: "Recipe", a: mathA.oil, b: mathB.oil, unit: "", digits: 0, weight: true },
    { label: "Balls", section: "Recipe", a: mathA.ballCount, b: mathB.ballCount, unit: "", digits: 0 },
    { label: "Ball weight", section: "Recipe", a: mathA.ballWeight, b: mathB.ballWeight, unit: "", digits: 0, weight: true },
    { label: "Bulk", section: "Fermentation", a: a.formula.bulkHours, b: b.formula.bulkHours, unit: " h", digits: 1 },
    { label: "Cold retard", section: "Fermentation", a: a.formula.retardHours, b: b.formula.retardHours, unit: " h", digits: 1 },
    { label: "Temper", section: "Fermentation", a: a.formula.temperHours, b: b.formula.temperHours, unit: " h", digits: 1 },
    { label: "Room temp", section: "Fermentation", a: a.formula.roomTemp, b: b.formula.roomTemp, unit: "°C", digits: 1 },
    { label: "Fridge temp", section: "Fermentation", a: a.formula.fridgeTemp, b: b.formula.fridgeTemp, unit: "°C", digits: 1 },
    { label: "Effective ferment", section: "Fermentation", a: mathA.effectiveHours, b: mathB.effectiveHours, unit: " h", digits: 1 },
    { label: "Overall", section: "Scores", a: a.ratings.overall, b: b.ratings.overall, unit: "/5", digits: 0, higherIsBetter: true },
    { label: "Crust", section: "Scores", a: a.ratings.crust, b: b.ratings.crust, unit: "/5", digits: 0, higherIsBetter: true },
    { label: "Crumb", section: "Scores", a: a.ratings.crumb, b: b.ratings.crumb, unit: "/5", digits: 0, higherIsBetter: true },
    { label: "Extensibility", section: "Scores", a: a.ratings.extensibility, b: b.ratings.extensibility, unit: "/5", digits: 0, higherIsBetter: true },
    { label: "Flavour", section: "Scores", a: a.ratings.flavor, b: b.ratings.flavor, unit: "/5", digits: 0, higherIsBetter: true },
  ];

  const meta: ComparisonMeta[] = [
    { label: "Style", a: a.styleName || "Custom", b: b.styleName || "Custom" },
    { label: "Flour", a: a.flourBrand || "—", b: b.flourBrand || "—" },
    { label: "Oven", a: a.oven || "—", b: b.oven || "—" },
  ].filter((item) => item.a !== item.b);

  return { rows, meta };
}

export function formatComparisonValue(row: ComparisonRow, value: number, unit: Unit): string {
  return row.weight ? fmtWeight(value, unit) : `${fmtNumber(value, row.digits)}${row.unit}`;
}

export function comparisonDeltaIsZero(row: ComparisonRow, delta: number): boolean {
  const threshold = row.weight ? 0.5 : 0.5 * 10 ** -row.digits;
  return Math.abs(delta) < threshold;
}

export function formatComparisonDelta(row: ComparisonRow, delta: number, unit: Unit): string {
  if (comparisonDeltaIsZero(row, delta)) return "—";
  const sign = delta > 0 ? "+" : "-";
  const magnitude = Math.abs(delta);
  return `${sign}${row.weight ? fmtWeight(magnitude, unit) : `${fmtNumber(magnitude, row.digits)}${row.unit}`}`;
}
