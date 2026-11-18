export const OUTCOME_TAGS = [
  { key: "open-crumb", label: "Open crumb" },
  { key: "tight-crumb", label: "Tight crumb" },
  { key: "crisp-base", label: "Crisp base" },
  { key: "pale-base", label: "Pale base" },
  { key: "charred", label: "Charred spots" },
  { key: "gum-line", label: "Gum line" },
  { key: "even-bake", label: "Even bake" },
  { key: "dense", label: "Dense" },
] as const;

export type OutcomeTag = (typeof OUTCOME_TAGS)[number];
export type OutcomeTagKey = OutcomeTag["key"];

export const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  OUTCOME_TAGS.map((tag) => [tag.key, tag.label]),
);

const VALID = new Set<string>(OUTCOME_TAGS.map((tag) => tag.key));

/** Keeps only known keys, de-duplicated, in the picker's order. */
export function normalizeOutcomeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const chosen = new Set(raw.filter((value): value is string => typeof value === "string"));
  return OUTCOME_TAGS.map((tag) => tag.key).filter((key) => chosen.has(key));
}

export function isOutcomeTag(value: string): value is OutcomeTagKey {
  return VALID.has(value);
}
