import type { Formula } from "./types";

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
];

export function getFlourType(id: string | undefined): FlourType {
  return FLOUR_TYPES.find((flour) => flour.id === id) ?? FLOUR_TYPES[0];
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
  return `${Math.round(share)}% ${getFlourType(formula.flour2Type).label.toLowerCase()}`;
}
