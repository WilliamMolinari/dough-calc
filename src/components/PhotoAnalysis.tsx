import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getKeySource } from "../lib/gemini";
import { OUTCOME_LABELS } from "../lib/outcomes";
import type { VisionRead } from "../lib/types";
import {
  MAX_VISION_PHOTOS,
  analyzeBakePhotos,
  type PhotoAnalysisContext,
} from "../lib/vision";
import { cx } from "./ui";

const RATING_LABELS = {
  crust: "Crust",
  crumb: "Crumb",
  overall: "Overall",
} as const;

/**
 * Opt-in Gemini vision read. Nothing is uploaded until the baker taps the
 * button, and the result only touches the bake when they apply it.
 */
export function PhotoAnalysis({
  photos,
  read,
  context,
  onApply,
}: {
  photos: string[];
  /** A previously stored read, shown even when the photos are gone. */
  read?: VisionRead;
  context?: PhotoAnalysisContext;
  onApply: (suggestion: { ratings: VisionRead["ratings"]; tags: string[]; read: VisionRead }) => void;
}) {
  const [result, setResult] = useState<VisionRead | undefined>(read);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(read);
  }, [read]);

  useEffect(() => {
    setError(null);
  }, [photos]);

  if (photos.length === 0 && !result) return null;

  const hasKey = getKeySource() !== "none";
  const ratingEntries = result
    ? (Object.keys(result.ratings) as Array<keyof VisionRead["ratings"]>)
        .filter((key) => (result.ratings[key] ?? 0) > 0)
        .map((key) => `${RATING_LABELS[key]} ${result.ratings[key]}/5`)
    : [];

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await analyzeBakePhotos(photos, context);
      setResult(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The photo read failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sky/15 bg-sky/[0.035] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-cream/80">
            <Sparkles size={13} className="text-sky" /> Read the photos
          </p>
          <p className="mt-0.5 font-mono text-[9.5px] text-cream/30">
            {result
              ? `saved read · ${result.confidence} confidence · ${result.photoCount} photo${result.photoCount === 1 ? "" : "s"}`
              : "opt-in · nothing is sent until you tap"}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy || !hasKey || photos.length === 0}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            busy || !hasKey || photos.length === 0
              ? "cursor-not-allowed border-white/8 bg-white/[0.03] text-cream/25"
              : "border-sky/40 bg-sky/10 text-sky-2 hover:bg-sky/15",
          )}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {busy ? "Reading…" : result ? "Read again" : "Analyze"}
        </button>
      </div>

      {!hasKey && (
        <p className="mt-2 text-[11px] leading-relaxed text-cream/40">
          Add a Gemini API key in the AI panel to let the model look at your photos.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-xl border border-hot/20 bg-hot/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-hot/90">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2.5">
          <p className="text-[12px] leading-relaxed text-cream/75">{result.summary}</p>

          {result.observations.length > 0 && (
            <ul className="space-y-1">
              {result.observations.map((observation) => (
                <li
                  key={observation}
                  className="flex gap-1.5 text-[11px] leading-relaxed text-cream/50"
                >
                  <span className="mt-[3px] size-1 shrink-0 rounded-full bg-sky/60" />
                  {observation}
                </li>
              ))}
            </ul>
          )}

          {result.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-sky/20 bg-sky/10 px-2 py-1 font-mono text-[9.5px] text-sky-2/90"
                >
                  {OUTCOME_LABELS[tag] ?? tag}
                </span>
              ))}
            </div>
          )}

          {ratingEntries.length > 0 && (
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-cream/35">
              Suggested {ratingEntries.join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-[16rem] font-mono text-[9px] leading-relaxed text-cream/25">
              A photo can't judge flavour or texture — those stay yours to score.
            </p>
            <button
              type="button"
              onClick={() =>
                onApply({ ratings: result.ratings, tags: result.tags, read: result })
              }
              className="rounded-xl border border-ember/40 bg-ember/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ember-2 transition-colors hover:bg-ember/20"
            >
              Apply to log
            </button>
          </div>
        </div>
      )}

      <p className="mt-2.5 font-mono text-[9px] leading-relaxed text-cream/20">
        Sends up to {MAX_VISION_PHOTOS} photos, compressed to 768 px, to Google Gemini. Photos stay
        on this device until you tap analyze.
      </p>
    </div>
  );
}
