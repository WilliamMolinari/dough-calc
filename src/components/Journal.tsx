import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookmarkPlus,
  Camera,
  DatabaseBackup,
  HardDrive,
  ImageOff,
  Pizza,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { formatBytes } from "../lib/backup";
import { fmtDate, fmtWeight, round } from "../lib/format";
import { doughMadeGrams, isPlannedTrial } from "../lib/journal";
import { STORAGE_BUDGET_BYTES, storagePressure } from "../lib/storage";
import { STYLES } from "../lib/presets";
import type { BakeEntry, Unit } from "../lib/types";
import { ActionButton, Badge, Card, Stars, cx } from "./ui";
import { JournalInsights } from "./JournalInsights";

type SortMode = "newest" | "rating";

function averageRating(bakes: BakeEntry[]): number {
  const rated = bakes.filter((bake) => bake.ratings.overall > 0);
  if (!rated.length) return 0;
  return rated.reduce((sum, bake) => sum + bake.ratings.overall, 0) / rated.length;
}

export function Journal({
  bakes,
  unit,
  storedBytes,
  storageBudget = STORAGE_BUDGET_BYTES,
  onOpenBake,
  onNewBake,
  onBackup,
  onRate,
  onMarkBaked,
}: {
  bakes: BakeEntry[];
  unit: Unit;
  /** Measured by the app after each journal write. */
  storedBytes: number;
  /** Real quota when the browser exposes it, otherwise the 5 MB target. */
  storageBudget?: number;
  onOpenBake: (bake: BakeEntry) => void;
  onNewBake: () => void;
  onBackup: () => void;
  onRate: (bake: BakeEntry, overall: number) => void;
  onMarkBaked: (bake: BakeEntry, baked: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [showInsights, setShowInsights] = useState(false);
  const [needsRating, setNeedsRating] = useState(false);

  const styleCounts = useMemo(
    () =>
      STYLES.map((preset) => ({
        ...preset,
        count: bakes.filter((bake) => bake.styleId === preset.id).length,
      })).filter((preset) => preset.count > 0),
    [bakes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = bakes.filter((bake) => {
      if (style !== "all" && bake.styleId !== style) return false;
      if (needsRating && bake.ratings.overall > 0) return false;
      if (!q) return true;
      const haystack = [
        bake.name,
        bake.notes,
        bake.nextTimeNotes,
        bake.flourBrand,
        bake.oven,
        bake.styleName,
        bake.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return [...list].sort((a, b) =>
      sort === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : b.ratings.overall - a.ratings.overall,
    );
  }, [bakes, needsRating, query, sort, style]);

  const avg = averageRating(bakes);
  const avgHydration = bakes.length
    ? round(bakes.reduce((sum, bake) => sum + bake.formula.hydration, 0) / bakes.length, 0)
    : 0;
  const totalDough = doughMadeGrams(bakes);
  const plannedCount = bakes.filter(isPlannedTrial).length;
  const awaitingCount = bakes.filter((bake) => bake.ratings.overall <= 0).length;
  const photoCount = bakes.reduce((sum, bake) => sum + (bake.photos?.length ?? 0), 0);
  const pressure = storagePressure(storedBytes, storageBudget);
  const storagePct = Math.min(
    100,
    Math.round((storedBytes / Math.max(storageBudget, 1)) * 100),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ember/80">
            Lab notebook
          </p>
          <p className="mt-0.5 text-[11.5px] text-cream/35">
            Rate, compare and mine your own bakes for patterns.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowInsights((value) => !value)}
            aria-expanded={showInsights}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] transition-colors",
              showInsights
                ? "border-ember/35 bg-ember/12 text-ember-2"
                : "border-white/10 bg-white/[0.035] text-cream/55 hover:border-white/20 hover:text-cream",
            )}
          >
            <TrendingUp size={12} /> Insights
          </button>
          <button
            type="button"
            onClick={onBackup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-cream/55 transition-colors hover:border-white/20 hover:text-cream"
          >
            <DatabaseBackup size={12} /> Backup
          </button>
        </div>
      </div>

      {showInsights && <JournalInsights bakes={bakes} />}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Bakes logged", value: String(bakes.length), icon: Pizza },
          {
            label: "Avg overall",
            value: avg ? `${round(avg, 1)} / 5` : "—",
            icon: Star,
          },
          { label: "Avg hydration", value: bakes.length ? `${avgHydration}%` : "—", icon: Sparkles },
          {
            label: "Dough made",
            value: totalDough ? `${round(totalDough / 1000, 1)} kg` : "—",
            icon: Wheat,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-3.5">
            <stat.icon size={14} className="text-ember/80" />
            <p className="mt-2 font-display text-[22px] font-semibold leading-none text-cream">
              {stat.value}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-cream/30">
              {stat.label}
            </p>
          </Card>
        ))}
      </div>

      {plannedCount > 0 && (
        <p className="font-mono text-[9.5px] leading-relaxed text-cream/25">
          “Dough made” skips {plannedCount} unscored trial{plannedCount === 1 ? "" : "s"} you
          haven't confirmed as baked. Baked one without scoring it? Tap “Baked it” on its card
          to count the dough.
        </p>
      )}

      {bakes.length > 0 && (
        <Card className="p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream/30"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bakes, notes, flours, tags…"
                aria-label="Search bakes"
                className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-9 pr-3 text-[12.5px] text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
              />
            </div>
            <label className="flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-cream/30">
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Sort bakes"
                className="appearance-none rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-[11.5px] text-cream/75 outline-none focus:border-ember/60"
              >
                <option value="newest" className="bg-[#121218]">
                  Newest first
                </option>
                <option value="rating" className="bg-[#121218]">
                  Highest rated
                </option>
              </select>
            </label>
          </div>

          <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setStyle("all")}
              aria-pressed={style === "all"}
              className={cx(
                "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                style === "all"
                  ? "border-ember/40 bg-ember/15 text-ember-2"
                  : "border-white/8 bg-white/[0.03] text-cream/40 hover:text-cream/75",
              )}
            >
              All · {bakes.length}
            </button>
            <button
              type="button"
              onClick={() => setNeedsRating((value) => !value)}
              aria-pressed={needsRating}
              disabled={awaitingCount === 0}
              className={cx(
                "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors disabled:opacity-40",
                needsRating
                  ? "border-ember/40 bg-ember/15 text-ember-2"
                  : "border-white/8 bg-white/[0.03] text-cream/40 hover:text-cream/75",
              )}
            >
              Awaiting rating · {awaitingCount}
            </button>
            {styleCounts.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setStyle(preset.id)}
                aria-pressed={style === preset.id}
                className={cx(
                  "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  style === preset.id
                    ? "border-ember/40 bg-ember/15 text-ember-2"
                    : "border-white/8 bg-white/[0.03] text-cream/40 hover:text-cream/75",
                )}
              >
                {preset.name} · {preset.count}
              </button>
            ))}
          </div>
        </Card>
      )}

      {bakes.length === 0 ? (
        <Card className="relative overflow-hidden p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, rgba(255,122,61,0.14), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-md">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl border border-ember/20 bg-ember/[0.07] text-ember">
              <Pizza size={28} strokeWidth={1.4} />
            </span>
            <h3 className="mt-4 text-2xl font-semibold text-cream">Your first bake starts here</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-cream/45">
              Save a formula with its ratings, photos and notes. Next time you mix, you'll know exactly
              what worked — and what to change.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <ActionButton variant="primary" icon={BookmarkPlus} onClick={onNewBake} className="px-4 py-2.5">
                Log this formula
              </ActionButton>
              <span className="font-mono text-[10px] text-cream/25">
                <ImageOff size={11} className="mr-1 inline" />
                photos stay on your device
              </span>
            </div>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-cream/60">No bakes match that search.</p>
          <ActionButton
            className="mt-3"
            onClick={() => {
              setQuery("");
              setStyle("all");
              setNeedsRating(false);
            }}
          >
            Clear filters
          </ActionButton>
        </Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((bake, index) => {
            const preset = STYLES.find((item) => item.id === bake.styleId) ?? STYLES[0];
            return (
              <motion.article
                key={bake.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.2) }}
                className="glass group overflow-hidden rounded-[24px] transition-colors hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => onOpenBake(bake)}
                  className="block w-full text-left"
                  aria-label={`Open bake ${bake.name}`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
                    {bake.photos?.length ? (
                      <img
                        src={bake.photos[0]}
                        alt={`${bake.name} finished bake`}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-full flex-col items-center justify-center gap-1.5"
                        style={{
                          background: `radial-gradient(120% 120% at 25% 0%, ${preset.accent}2e, transparent 65%), #0b0b10`,
                        }}
                      >
                        <Pizza size={26} className="text-cream/20" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/25">
                          no photo
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-8">
                      <p className="truncate text-[14px] font-medium text-cream">{bake.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <Stars value={bake.ratings.overall} size={11} label="Overall rating" />
                        <span className="font-mono text-[9.5px] text-cream/50">
                          {fmtDate(bake.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Badge className="absolute left-2.5 top-2.5 bg-black/45 backdrop-blur" tone="ember">
                      {preset.name}
                    </Badge>
                    {bake.photos?.length > 1 && (
                      <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 font-mono text-[9px] text-cream/70 backdrop-blur">
                        <Camera size={9} /> {bake.photos.length}
                      </span>
                    )}
                  </div>
                </button>

                <div className="p-3">
                  <button
                    type="button"
                    onClick={() => onOpenBake(bake)}
                    className="block w-full text-left"
                    aria-label={`Open bake ${bake.name} details`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-cream/50">
                        {bake.formula.hydration}% hydration
                      </span>
                      <span className="rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-cream/50">
                        {bake.formula.ballCount} × {fmtWeight(bake.formula.ballWeight, unit)}
                      </span>
                      {bake.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-white/8 bg-white/[0.02] px-1.5 py-0.5 font-mono text-[9.5px] text-cream/35"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {bake.notes && (
                      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-cream/40">
                        {bake.notes}
                      </p>
                    )}
                  </button>

                  {bake.ratings.overall <= 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-ember/20 bg-ember/[0.06] px-2 py-1.5">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ember/70">
                        Awaiting rating
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {bake.parentId && (
                          <button
                            type="button"
                            onClick={() => onMarkBaked(bake, !bake.bakedAt)}
                            aria-pressed={!!bake.bakedAt}
                            title={
                              bake.bakedAt
                                ? "Counted as baked — tap to treat it as planned again"
                                : "Baked this trial without scoring it? Count it in dough made"
                            }
                            className={cx(
                              "rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors",
                              bake.bakedAt
                                ? "border-lime/40 bg-lime/10 text-lime"
                                : "border-white/12 bg-white/[0.04] text-cream/50 hover:border-ember/40 hover:text-ember-2",
                            )}
                          >
                            {bake.bakedAt ? "Baked" : "Baked it"}
                          </button>
                        )}
                        <Stars
                          value={0}
                          onChange={(value) => onRate(bake, value)}
                          size={13}
                          label={`Rate ${bake.name}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {bakes.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9.5px]">
            <span className="flex items-center gap-1.5 uppercase tracking-[0.14em] text-cream/30">
              <HardDrive size={11} /> Browser storage
            </span>
            <span
              className={cx(
                pressure === "tight"
                  ? "text-hot/85"
                  : pressure === "watch"
                    ? "text-ember-2/85"
                    : "text-cream/30",
              )}
            >
              {formatBytes(storedBytes)} of ~{formatBytes(storageBudget)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cx(
                "h-full rounded-full transition-[width] duration-500",
                pressure === "tight"
                  ? "bg-hot"
                  : pressure === "watch"
                    ? "bg-ember"
                    : "bg-lime/70",
              )}
              style={{ width: `${storagePct}%` }}
            />
          </div>
          {pressure !== "ok" ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-cream/35">
              {pressure === "tight"
                ? "Browser storage is nearly full. Export a backup, then remove photos from older bakes."
                : "The journal is growing. Export a backup before it fills the browser's allowance."}
            </p>
          ) : (
            photoCount > 0 && (
              <p className="mt-1.5 font-mono text-[9px] text-cream/20">
                {photoCount} photo{photoCount === 1 ? "" : "s"} · photos live in the browser database,
                resized for this device
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
