import { calculateDough } from "./calc";
import { OUTCOME_LABELS } from "./outcomes";
import type { BakeEntry } from "./types";

export interface GroupInsight {
  key: string;
  label: string;
  count: number;
  avgOverall: number;
}

export interface TraitInsight {
  label: string;
  top: number;
  rest: number;
  unit: string;
}

export interface JournalInsights {
  ratedCount: number;
  total: number;
  avgOverall: number;
  best: BakeEntry | null;
  byStyle: GroupInsight[];
  byOven: GroupInsight[];
  byHydration: GroupInsight[];
  byFerment: GroupInsight[];
  tags: GroupInsight[];
  outcomes: GroupInsight[];
  traits: TraitInsight[];
}

const avg = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const round1 = (value: number): number => Math.round(value * 10) / 10;

function group(
  bakes: BakeEntry[],
  keyOf: (bake: BakeEntry) => string | null,
  labelOf: (key: string) => string = (key) => key,
): GroupInsight[] {
  const buckets = new Map<string, BakeEntry[]>();
  for (const bake of bakes) {
    const key = keyOf(bake);
    if (!key) continue;
    const entries = buckets.get(key);
    if (entries) entries.push(bake);
    else buckets.set(key, [bake]);
  }
  return [...buckets.entries()]
    .map(([key, entries]) => ({
      key,
      label: labelOf(key),
      count: entries.length,
      avgOverall: round1(avg(entries.map((entry) => entry.ratings.overall))),
    }))
    .sort((a, b) => b.avgOverall - a.avgOverall || b.count - a.count);
}

function hydrationBand(hydration: number): string {
  if (hydration < 60) return "under-60";
  if (hydration < 65) return "60-64";
  if (hydration < 70) return "65-69";
  if (hydration < 75) return "70-74";
  return "75-plus";
}

function fermentBand(hours: number): string {
  if (hours < 12) return "under-12";
  if (hours < 24) return "12-24";
  if (hours < 36) return "24-36";
  return "36-plus";
}

const HYDRATION_LABEL: Record<string, string> = {
  "under-60": "<60% hydration",
  "60-64": "60–64%",
  "65-69": "65–69%",
  "70-74": "70–74%",
  "75-plus": "75%+",
};

const FERMENT_LABEL: Record<string, string> = {
  "under-12": "<12 h effective",
  "12-24": "12–24 h",
  "24-36": "24–36 h",
  "36-plus": "36 h+",
};

function trait(label: string, top: number, rest: number, unit: string): TraitInsight {
  return { label, top: round1(top), rest: round1(rest), unit };
}

export function buildInsights(bakes: BakeEntry[]): JournalInsights {
  const rated = bakes.filter((bake) => bake.ratings.overall > 0);
  const sorted = [...rated].sort((a, b) => b.ratings.overall - a.ratings.overall);
  const best = sorted[0] ?? null;

  const topCount = Math.max(1, Math.ceil(rated.length * 0.25));
  const top = sorted.slice(0, topCount);
  const rest = sorted.slice(topCount);

  const tags = new Map<string, BakeEntry[]>();
  for (const bake of rated) {
    for (const tag of bake.tags) {
      const key = tag.toLowerCase();
      const entries = tags.get(key);
      if (entries) entries.push(bake);
      else tags.set(key, [bake]);
    }
  }

  const outcomes = new Map<string, BakeEntry[]>();
  for (const bake of rated) {
    for (const tag of bake.outcomeTags ?? []) {
      const entries = outcomes.get(tag);
      if (entries) entries.push(bake);
      else outcomes.set(tag, [bake]);
    }
  }

  const traits: TraitInsight[] = [];
  if (top.length && rest.length) {
    traits.push(
      trait("Hydration", avg(top.map((b) => b.formula.hydration)), avg(rest.map((b) => b.formula.hydration)), "%"),
      trait("Salt", avg(top.map((b) => b.formula.salt)), avg(rest.map((b) => b.formula.salt)), "%"),
      trait("Bulk", avg(top.map((b) => b.formula.bulkHours)), avg(rest.map((b) => b.formula.bulkHours)), "h"),
      trait("Cold retard", avg(top.map((b) => b.formula.retardHours)), avg(rest.map((b) => b.formula.retardHours)), "h"),
      trait(
        "Effective ferment",
        avg(top.map((b) => calculateDough(b.formula).effectiveHours)),
        avg(rest.map((b) => calculateDough(b.formula).effectiveHours)),
        "h",
      ),
      trait("Ball weight", avg(top.map((b) => b.formula.ballWeight)), avg(rest.map((b) => b.formula.ballWeight)), "g"),
    );
  }

  return {
    ratedCount: rated.length,
    total: bakes.length,
    avgOverall: round1(avg(rated.map((bake) => bake.ratings.overall))),
    best,
    byStyle: group(rated, (bake) => bake.styleName || "Custom"),
    byOven: group(rated, (bake) => bake.oven || "Unspecified"),
    byHydration: group(
      rated,
      (bake) => hydrationBand(bake.formula.hydration),
      (key) => HYDRATION_LABEL[key] ?? key,
    ),
    byFerment: group(
      rated,
      (bake) => fermentBand(calculateDough(bake.formula).effectiveHours),
      (key) => FERMENT_LABEL[key] ?? key,
    ),
    tags: [...tags.entries()]
      .map(([key, entries]) => ({
        key,
        label: `#${key}`,
        count: entries.length,
        avgOverall: round1(avg(entries.map((entry) => entry.ratings.overall))),
      }))
      .sort((a, b) => b.avgOverall - a.avgOverall || b.count - a.count)
      .slice(0, 6),
    outcomes: [...outcomes.entries()]
      .map(([key, entries]) => ({
        key,
        label: OUTCOME_LABELS[key] ?? key,
        count: entries.length,
        avgOverall: round1(avg(entries.map((entry) => entry.ratings.overall))),
      }))
      .sort((a, b) => b.avgOverall - a.avgOverall || b.count - a.count)
      .slice(0, 6),
    traits,
  };
}
