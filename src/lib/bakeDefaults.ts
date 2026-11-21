import { flourBlendLabel, flourLabel, secondFlourShare } from "./flours";
import type { Formula } from "./types";

/** The journal's Flour field length. */
const FLOUR_FIELD_MAX = 60;
/** Tags are short; a custom flour name still has to read as a tag. */
const TAG_MAX = 28;

/**
 * What to put in a new bake log's Flour field: the baker's own flour name from
 * the calculator, plus the blend share when a second flour is in the batch.
 */
export function flourFieldText(formula: Formula): string {
  const base = (formula.baseFlourName ?? "").trim();
  const blend = flourBlendLabel(formula);
  return [base, blend]
    .filter((part): part is string => Boolean(part))
    .join(" + ")
    .slice(0, FLOUR_FIELD_MAX)
    .trim();
}

/**
 * Process tags a formula already answers, so a new bake log starts tagged:
 * the second flour, the leaven and whether the dough was retarded or baked
 * the same day. Observations ("too wet", "great char") stay for the baker.
 */
export function formulaTags(formula: Formula): string[] {
  const tags: string[] = [];
  const add = (raw: string) => {
    const tag = raw.trim().slice(0, TAG_MAX);
    if (!tag || tags.length >= 8) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    tags.push(tag);
  };

  if (secondFlourShare(formula) > 0) {
    const label = flourLabel(formula.flour2Type, formula.flour2Name).toLowerCase();
    // "custom flour" is the placeholder for an unnamed custom flour.
    if (label !== "custom flour") add(label);
  }

  if (formula.leavenMode === "preferment") add(formula.prefermentKind);
  else if (formula.leavenMode === "sourdough") add("sourdough");

  if (formula.retardHours >= 8) add("cold ferment");
  else if (formula.retardHours <= 0 && formula.bulkHours + formula.temperHours <= 8) {
    add("same-day");
  }

  return tags;
}
