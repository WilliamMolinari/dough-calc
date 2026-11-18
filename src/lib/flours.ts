import type { Formula } from "./types";

export const FLOUR_NAME_MAX = 40;
export const CUSTOM_FLOUR_ID = "custom";

export interface FlourType {
  id: string;
  label: string;
  /** What this flour brings to the blend. */
  note: string;
}

export const FLOUR_TYPES: FlourType[] = [
  { id: "tipo-00", label: "Tipo 00", note: "Fine and extensible — the classic Neapolitan base." },
  { id: "bread", label: "Bread flour", note: "More protein for chew, a stronger rim and a longer rise." },
  { id: "all-purpose", label: "All-purpose", note: "A softer all-rounder; expect a little less spring." },
  {
    id: "whole-wheat",
    label: "Whole wheat",
    note: "Thirsty and full of flavour. Expect a tighter crumb and a touch more water.",
  },
  { id: "semolina", label: "Semolina", note: "Golden colour and a crisp, biscuity bite." },
  { id: "rye", label: "Rye", note: "Dense and sour-sweet — keep the share low or the dough goes slack." },
  { id: "spelt", label: "Spelt", note: "Fragile gluten. Handle gently and give it a full hydration rest." },
  {
    id: CUSTOM_FLOUR_ID,
    label: "Custom…",
    note: "Your own flour. Name it and the recipe card, journal and exports use that name.",
  },
];

export function getFlourType(id: string | undefined): FlourType {
  return FLOUR_TYPES.find((flour) => flour.id === id) ?? FLOUR_TYPES[0];
}

/** Display name for a flour id, using the baker's own name for custom flours. */
export function flourLabel(id: string | undefined, customName?: string): string {
  if (id === CUSTOM_FLOUR_ID) {
    const name = (customName ?? "").trim();
    return name ? name.slice(0, FLOUR_NAME_MAX) : "Custom flour";
  }
  return getFlourType(id).label;
}

/** "Flour", "Base flour" in a blend, or the baker's own name for the main flour. */
export function baseFlourLabel(formula: Pick<Formula, "baseFlourName" | "flour2Pct">): string {
  const name = (formula.baseFlourName ?? "").trim();
  if (name) return name.slice(0, FLOUR_NAME_MAX);
  return secondFlourShare(formula) > 0 ? "Base flour" : "Flour";
}

/** Share of the total flour that is the second flour, clamped to something bakeable. */
export function secondFlourShare(formula: Pick<Formula, "flour2Pct">): number {
  const value = Number(formula.flour2Pct);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(95, value);
}

/** "30% whole wheat" — null when the batch uses a single flour. */
export function flourBlendLabel(formula: Formula): string | null {
  const share = secondFlourShare(formula);
  if (share <= 0) return null;
  return `${Math.round(share)}% ${flourLabel(formula.flour2Type, formula.flour2Name).toLowerCase()}`;
}
