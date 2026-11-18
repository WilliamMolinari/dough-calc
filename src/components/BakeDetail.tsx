import { useState } from "react";
import {
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flame,
  FlaskConical,
  Image as ImageIcon,
  Pencil,
  Pizza,
  Repeat2,
  RotateCcw,
  Trash2,
  Download,
  FileJson,
  DownloadCloud,
} from "lucide-react";
import { calculateDough } from "../lib/calc";
import { fmtDate, fmtWeight } from "../lib/format";
import { getStyle } from "../lib/presets";
import { lineageOf, trialLabel } from "../lib/journal";
import { OUTCOME_LABELS } from "../lib/outcomes";
import { ingredientLines, leavenSummary } from "../lib/recipe";
import { downloadJson, downloadRecipeImage, bakeJson, slugify } from "../lib/exports";
import type { BakeEntry, Unit } from "../lib/types";
import { ActionButton, Badge, Modal, Stars, cx } from "./ui";
import { BakeComparison } from "./BakeComparison";
import { FermentTimeline } from "./FermentTimeline";

const RATING_ROWS = [
  { key: "crust", label: "Crust" },
  { key: "crumb", label: "Crumb" },
  { key: "extensibility", label: "Extensibility" },
  { key: "flavor", label: "Flavour" },
] as const;

export function BakeDetail({
  bake,
  bakes,
  unit,
  onClose,
  onCarryForward,
  onDelete,
  onEdit,
  onDuplicate,
  onBakeAgain,
  onDesignTrial,
  onRate,
  onMarkBaked,
  onKitchen,
  onToast,
}: {
  bake: BakeEntry | null;
  bakes: BakeEntry[];
  unit: Unit;
  onClose: () => void;
  onCarryForward: (bake: BakeEntry) => void;
  onDelete: (id: string) => void;
  onEdit: (bake: BakeEntry) => void;
  onDuplicate: (bake: BakeEntry) => void;
  onBakeAgain: (bake: BakeEntry) => void;
  onDesignTrial: (bake: BakeEntry) => void;
  onRate: (bake: BakeEntry, overall: number) => void;
  onMarkBaked: (bake: BakeEntry, baked: boolean) => void;
  onKitchen: (bake: BakeEntry) => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rendering, setRendering] = useState(false);

  if (!bake) return null;

  const style = getStyle(bake.styleId);
  const math = calculateDough(bake.formula);
  const lines = ingredientLines(bake.formula, math, unit);
  const photos = bake.photos ?? [];
  // Editing can remove the photo that was open; clamp instead of rendering a gap.
  const activePhotoIndex = photos.length ? Math.min(photoIndex, photos.length - 1) : 0;
  const hasRating =
    bake.ratings.overall ||
    bake.ratings.crust ||
    bake.ratings.crumb ||
    bake.ratings.flavor ||
    bake.ratings.extensibility;
  const lineage = lineageOf(bake, bakes);
  const trial = trialLabel(lineage);
  const handleImage = async () => {
    setRendering(true);
    try {
      await downloadRecipeImage(bake.formula, unit, bake.name);
      onToast("Share card downloaded", "success");
    } catch {
      onToast("Could not render the share image", "error");
    } finally {
      setRendering(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={bake.name}
      subtitle={`${style.name} · ${fmtDate(bake.createdAt)}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-hot/80">Delete permanently?</span>
              <ActionButton variant="danger" onClick={() => onDelete(bake.id)}>
                Delete
              </ActionButton>
              <ActionButton onClick={() => setConfirmDelete(false)}>Keep</ActionButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-cream/30 transition-colors hover:text-hot"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionButton
              onClick={handleImage}
              icon={rendering ? ImageIcon : DownloadCloud}
              ariaLabel="Download bake share image"
              disabled={rendering}
            >
              Image
            </ActionButton>
            <ActionButton
              icon={FileJson}
              ariaLabel="Export bake as JSON"
              onClick={() => {
                downloadJson(bakeJson(bake), `${slugify(bake.name)}-bake.json`);
                onToast("Bake JSON exported", "success");
              }}
            >
              JSON
            </ActionButton>
            <ActionButton
              icon={RotateCcw}
              onClick={() => onCarryForward(bake)}
              ariaLabel="Carry this formula forward into the calculator"
            >
              Carry forward
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {photos.length > 0 ? (
              <>
                <img
                  src={photos[activePhotoIndex]}
                  alt={`${bake.name} — photo ${activePhotoIndex + 1} of ${photos.length}`}
                  className="h-full w-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoIndex((activePhotoIndex - 1 + photos.length) % photos.length)
                      }
                      aria-label="Previous photo"
                      className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-cream/80 backdrop-blur transition-colors hover:bg-black/80"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoIndex((activePhotoIndex + 1) % photos.length)}
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-cream/80 backdrop-blur transition-colors hover:bg-black/80"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 font-mono text-[9.5px] text-cream/70">
                  {activePhotoIndex + 1} / {photos.length}
                </span>
              </>
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center gap-2"
                style={{
                  background: `radial-gradient(120% 120% at 20% 0%, ${style.accent}33, transparent 60%), #0b0b10`,
                }}
              >
                <Pizza size={30} className="text-cream/25" />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/30">
                  No photos yet
                </p>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {photos.map((photo, index) => (
                <button
                  key={`${photo.slice(-20)}-${index}`}
                  type="button"
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={index === activePhotoIndex}
                  className={cx(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-all",
                    index === activePhotoIndex
                      ? "border-ember/70 ring-1 ring-ember/40"
                      : "border-white/10 opacity-65 hover:opacity-100",
                  )}
                >
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="ember">{style.name}</Badge>
          <Badge tone="neutral">
            <CalendarDays size={10} />
            {fmtDate(bake.createdAt)}
          </Badge>
          {trial && <Badge tone="neutral">{trial}</Badge>}
          {lineage.parent && (
            <Badge tone="neutral">from {lineage.parent.name.slice(0, 24)}</Badge>
          )}
          {bake.updatedAt && <Badge tone="neutral">edited {fmtDate(bake.updatedAt)}</Badge>}
          {bake.oven && <Badge tone="neutral">{bake.oven}</Badge>}
          {bake.flourBrand && <Badge tone="sky">{bake.flourBrand}</Badge>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ActionButton
            variant="primary"
            icon={Repeat2}
            onClick={() => onBakeAgain(bake)}
            ariaLabel="Start the next trial from this formula"
          >
            Bake this again
          </ActionButton>
          <ActionButton icon={FlaskConical} onClick={() => onDesignTrial(bake)}>
            Design trial
          </ActionButton>
          <ActionButton icon={Pencil} onClick={() => onEdit(bake)}>
            Edit log
          </ActionButton>
          <ActionButton icon={Copy} onClick={() => onDuplicate(bake)}>
            Duplicate
          </ActionButton>
          <ActionButton icon={ChefHat} onClick={() => onKitchen(bake)}>
            Cook mode
          </ActionButton>
        </div>

        {/* Ratings */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/30">Overall</p>
              <div className="mt-1 flex items-center gap-2">
                <Stars
                  value={bake.ratings.overall}
                  onChange={(value) => onRate(bake, value)}
                  size={19}
                  label="Overall rating"
                />
                <span className="font-mono text-[11px] text-cream/40">
                  {bake.ratings.overall ? `${bake.ratings.overall}/5` : "unrated"}
                </span>
              </div>
            </div>
            <p className="max-w-[15rem] font-mono text-[10px] leading-relaxed text-cream/25">
              {hasRating
                ? "Tap a star to change the score."
                : lineage.parent
                  ? bake.bakedAt
                    ? "Marked as baked but unscored — add a score whenever you like."
                    : "New trial, no score yet — tap a star once you have tasted it."
                  : "Tap a star to score this bake now or later."}
            </p>
          </div>

          {lineage.parent && !bake.ratings.overall && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
              <span className="text-[10.5px] leading-relaxed text-cream/40">
                Unscored trials are left out of “Dough made”.
              </span>
              <button
                type="button"
                onClick={() => onMarkBaked(bake, !bake.bakedAt)}
                aria-pressed={!!bake.bakedAt}
                className={cx(
                  "rounded-lg border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors",
                  bake.bakedAt
                    ? "border-lime/40 bg-lime/10 text-lime"
                    : "border-white/12 bg-white/[0.04] text-cream/55 hover:border-ember/40 hover:text-ember-2",
                )}
              >
                {bake.bakedAt ? "Baked — counted" : "Baked it, just didn't score it"}
              </button>
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {RATING_ROWS.map((row) => {
              const value = bake.ratings[row.key] ?? 0;
              return (
                <div key={row.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-cream/60">{row.label}</span>
                    <span className="font-mono text-[10px] text-cream/35">{value}/5</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-2 via-ember to-hot transition-[width] duration-500"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formula snapshot */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">
            Formula snapshot
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total dough", value: fmtWeight(math.totalDough, unit) },
              { label: "Balls", value: `${math.ballCount} × ${fmtWeight(math.ballWeight, unit)}` },
              { label: "Hydration", value: `${bake.formula.hydration}%` },
              { label: "Salt", value: `${bake.formula.salt}%` },
            ].map((stat) => (
              <div key={stat.label} className="glass-inset rounded-xl px-2.5 py-2">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">
                  {stat.label}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11.5px] tabular-nums text-cream/85">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-2xl border border-white/8 bg-black/20 p-3">
            <ul className="grid gap-x-5 sm:grid-cols-2">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between border-b border-white/[0.05] py-1.5 last:border-0"
                >
                  <span className="truncate pr-2 text-[12px] text-cream/65">{line.label}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-cream/85">
                    {fmtWeight(line.grams, unit)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2">
              <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cream/30">
                <Flame size={10} className="text-ember/70" /> {leavenSummary(bake.formula, math, unit)}
              </span>
              <span className="font-mono text-[9.5px] text-cream/30">
                {math.effectiveHours.toFixed(1)} h effective
              </span>
            </div>
          </div>
        </div>

        <BakeComparison bake={bake} bakes={bakes} unit={unit} />

        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">Schedule</p>
          <FermentTimeline formula={bake.formula} compact />
        </div>

        {(bake.hypothesis || bake.actuals || (bake.outcomeTags?.length ?? 0) > 0) && (
          <div className="space-y-3 rounded-2xl border border-ember/15 bg-ember/[0.035] p-3.5">
            {bake.hypothesis && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ember/60">
                  Hypothesis
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-cream/75">
                  {bake.hypothesis}
                </p>
              </div>
            )}
            {bake.actuals && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">
                  Actuals
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {([
                    ["Dough", bake.actuals.doughTempC, "°C"],
                    ["Room", bake.actuals.roomTempC, "°C"],
                    ["Bake", bake.actuals.bakeMinutes, "min"],
                  ] as const).map(([label, value, suffix]) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-black/15 px-2 py-1.5">
                      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-cream/25">
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-cream/80">
                        {value === undefined ? "—" : `${value}${suffix}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(bake.outcomeTags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bake.outcomeTags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-ember/20 bg-ember/10 px-2 py-1 font-mono text-[9.5px] text-ember-2/90"
                  >
                    {OUTCOME_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {(bake.notes || bake.nextTimeNotes || bake.tags.length > 0) && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
            {bake.notes && (
              <>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">
                  What happened
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-cream/70">
                  {bake.notes}
                </p>
              </>
            )}
            {bake.nextTimeNotes && (
              <div className={bake.notes ? "mt-3" : ""}>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ember/60">
                  Next time
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-cream/70">
                  {bake.nextTimeNotes}
                </p>
              </div>
            )}
            {bake.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {bake.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] text-cream/45"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 font-mono text-[9.5px] text-cream/20">
          <Download size={10} /> stored locally in this browser
        </p>
      </div>
    </Modal>
  );
}
