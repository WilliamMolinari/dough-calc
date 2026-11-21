import { sanitizeFormula } from "./formula";
import type { Formula, Unit } from "./types";

/** A recipe file is a few hundred bytes; anything this big is not one. */
const MAX_CHARS = 100_000;

export type RecipeFileResult =
  | { ok: true; formula: Formula; unit: Unit }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeFormula(value: Record<string, unknown>): boolean {
  return (
    "hydration" in value ||
    "sizing" in value ||
    "styleId" in value ||
    "flourWeight" in value
  );
}

/**
 * Reads just the recipe out of a DoughLab recipe export, a full backup file or
 * a bare formula. Everything outside the formula — bakes, photos, ratings — is
 * ignored, and the formula is run through the same sanitiser as storage, a
 * backup restore or a share link.
 */
export function parseRecipeFile(text: string): RecipeFileResult {
  if (!text.trim()) return { ok: false, error: "That file is empty." };
  if (text.length > MAX_CHARS) {
    return { ok: false, error: "That file is too large to be a recipe." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "That file does not contain a DoughLab recipe." };
  }

  const nested = parsed.formula;
  const source = isRecord(nested)
    ? nested
    : looksLikeFormula(parsed)
      ? parsed
      : null;

  if (!source || Object.keys(source).length === 0) {
    return {
      ok: false,
      error: "No recipe found in that file. Export one from the weigh & bake panel first.",
    };
  }

  return {
    ok: true,
    formula: sanitizeFormula(source),
    unit: parsed.unit === "oz" ? "oz" : "g",
  };
}
