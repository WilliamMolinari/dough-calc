import type { Formula } from "./types";

export type TrialVariable = "hydration" | "salt" | "oil" | "bulkHours" | "retardHours" | "ballWeight";

export interface TrialVariableSpec {
  key: TrialVariable;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
}

export const TRIAL_VARIABLES: TrialVariableSpec[] = [
  { key: "hydration", label: "Hydration", unit: "%", step: 2, min: 50, max: 100 },
  { key: "salt", label: "Salt", unit: "%", step: 0.2, min: 0, max: 6 },
  { key: "oil", label: "Oil", unit: "%", step: 1, min: 0, max: 12 },
  { key: "bulkHours", label: "Bulk ferment", unit: "h", step: 1, min: 0.5, max: 24 },
  { key: "retardHours", label: "Cold retard", unit: "h", step: 2, min: 0, max: 72 },
  { key: "ballWeight", label: "Ball weight", unit: "g", step: 10, min: 120, max: 600 },
];

export function trialVariableSpec(variable: TrialVariable): TrialVariableSpec {
  return TRIAL_VARIABLES.find((item) => item.key === variable) ?? TRIAL_VARIABLES[0];
}

export function formulaValue(formula: Formula, variable: TrialVariable): number {
  return formula[variable];
}

/** Applies a single-variable change without letting a typo break the formula. */
export function adjustFormula(formula: Formula, variable: TrialVariable, delta: number): Formula {
  const spec = trialVariableSpec(variable);
  if (!Number.isFinite(delta) || delta === 0) return { ...formula };
  const next = Math.min(spec.max, Math.max(spec.min, formulaValue(formula, variable) + delta));
  const rounded = Math.round(next * 10) / 10;
  return { ...formula, [variable]: rounded };
}

/** "Hydration +2%" — the one-line hypothesis label. */
export function trialChangeLabel(variable: TrialVariable, delta: number): string {
  const spec = trialVariableSpec(variable);
  const value = Math.round(delta * 10) / 10;
  return `${spec.label} ${value > 0 ? "+" : ""}${value}${spec.unit}`;
}
