import { clamp, round } from "./format";

/**
 * Sourdough starter builds.
 *
 * The calculator assumes a ripe starter exists. This works backwards from the
 * grams the dough needs: with a feeding ratio and a seed you already have, how
 * many feeds does it take, what goes into each one, and when do they start?
 *
 * Ratio is expressed the way bakers say it — 1:5:5 means one part starter to
 * five parts flour and five parts water — so `ratio` here is the 5.
 */

export interface StarterFeedInput {
  /** Grams of starter the final dough needs. */
  neededGrams: number;
  /** Grams of starter you can start from (fridge scrap or a fresh feed). */
  seedGrams: number;
  /** Flour (and water) per one part starter: 1, 2, 5, 10… */
  ratio: number;
  /** Hours between feeds, e.g. 8 for an overnight build. */
  intervalHours: number;
  /** When the dough gets mixed, i.e. when the starter must be ripe. */
  mixAt: Date;
}

export interface StarterFeed {
  /** 1 is the first feed of the build. */
  index: number;
  at: Date;
  /** Starter carried into this feed. */
  seed: number;
  flour: number;
  water: number;
  /** Total starter after this feed. */
  total: number;
}

export interface StarterPlan {
  needed: number;
  seedGrams: number;
  ratio: number;
  intervalHours: number;
  /** Feeds required; 0 means the seed is already enough. */
  feeds: StarterFeed[];
  finalGrams: number;
  /** Starter left over after taking what the dough needs. */
  leftoverGrams: number;
  firstFeedAt: Date | null;
  /** Total flour and water the build consumes. */
  totalFlour: number;
  totalWater: number;
  note: string;
}

/** How much one feed multiplies the starter: 1:5:5 turns 10 g into 110 g. */
export function feedMultiplier(ratio: number): number {
  const safeRatio = clamp(Number.isFinite(ratio) ? ratio : 1, 0.2, 20);
  return 1 + 2 * safeRatio;
}

export function planStarterBuild(input: StarterFeedInput): StarterPlan {
  const needed = clamp(Number.isFinite(input.neededGrams) ? input.neededGrams : 0, 1, 5000);
  const seed = clamp(Number.isFinite(input.seedGrams) ? input.seedGrams : 0, 1, 2000);
  const ratio = clamp(Number.isFinite(input.ratio) ? input.ratio : 1, 0.2, 20);
  const intervalHours = clamp(
    Number.isFinite(input.intervalHours) ? input.intervalHours : 8,
    1,
    48,
  );
  const multiplier = feedMultiplier(ratio);

  // Smallest number of feeds that reaches the target from this seed.
  let feedCount = 0;
  let projected = seed;
  while (projected < needed && feedCount < 12) {
    projected *= multiplier;
    feedCount += 1;
  }

  const mixAt = Number.isNaN(input.mixAt.getTime()) ? new Date() : input.mixAt;
  const feeds: StarterFeed[] = [];
  let carried = seed;
  let totalFlour = 0;
  let totalWater = 0;

  for (let index = 1; index <= feedCount; index += 1) {
    const flour = carried * ratio;
    const water = carried * ratio;
    const total = carried + flour + water;
    totalFlour += flour;
    totalWater += water;
    const at = new Date(
      mixAt.getTime() - (feedCount - index + 1) * intervalHours * 3_600_000,
    );
    feeds.push({
      index,
      at,
      seed: round(carried, 1),
      flour: round(flour, 1),
      water: round(water, 1),
      total: round(total, 1),
    });
    carried = total;
  }

  const finalGrams = feedCount === 0 ? seed : carried;
  const leftoverGrams = Math.max(0, finalGrams - needed);

  const note =
    feedCount === 0
      ? `Your ${round(seed, 0)} g seed already covers the ${round(needed, 0)} g this dough needs. Feed it as usual so it is ripe at mix time.`
      : `${feedCount} feed${feedCount === 1 ? "" : "s"} at 1:${ratio}:${ratio}, ${intervalHours} h apart. ` +
        `Start ${feeds[0].at.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}, ` +
        `then mix at ${mixAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. ` +
        `You will have ${round(finalGrams, 0)} g — take ${round(needed, 0)} g and keep ${round(leftoverGrams, 0)} g back as your next seed.`;

  return {
    needed: round(needed, 1),
    seedGrams: round(seed, 1),
    ratio,
    intervalHours,
    feeds,
    finalGrams: round(finalGrams, 1),
    leftoverGrams: round(leftoverGrams, 1),
    firstFeedAt: feeds[0]?.at ?? null,
    totalFlour: round(totalFlour, 1),
    totalWater: round(totalWater, 1),
    note,
  };
}
