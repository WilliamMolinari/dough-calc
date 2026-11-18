import { Fragment, useEffect, useRef, useState } from "react";
import { AlertTriangle, GitCompare, Loader2, Sparkles } from "lucide-react";
import { BakeSommelierError, explainBakeDiff } from "../lib/gemini";
import { ChatMarkdown } from "./BakeChatbot";
import {
  buildBakeComparison,
  comparisonDeltaIsZero,
  formatComparisonDelta,
  formatComparisonValue,
  type ComparisonSection,
} from "../lib/compare";
import { comparisonTarget, lineageOf } from "../lib/journal";
import type { BakeEntry, Unit } from "../lib/types";
import { cx } from "./ui";

const SECTIONS: ComparisonSection[] = ["Recipe", "Fermentation", "Scores"];

/** Keep long trial names readable inside the select. */
function optionLabel(item: BakeEntry, bakes: BakeEntry[]): string {
  const { trial, total } = lineageOf(item, bakes);
  return total > 1 ? `${item.name} · T${trial}` : item.name;
}

export function BakeComparison({
  bake,
  bakes,
  unit,
}: {
  bake: BakeEntry;
  bakes: BakeEntry[];
  unit: Unit;
}) {
  const [compareId, setCompareId] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const explainAbort = useRef<AbortController | null>(null);
  const others = bakes.filter((item) => item.id !== bake.id);
  // Default to the parent trial (or the nearest neighbour) rather than an unrelated bake.
  const comparison = others.find((item) => item.id === compareId) ?? comparisonTarget(bake, bakes);

  useEffect(() => {
    explainAbort.current?.abort();
    setExplanation(null);
    setExplainError(null);
    setExplaining(false);
  }, [comparison?.id]);

  useEffect(() => () => explainAbort.current?.abort(), []);

  if (!comparison) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">
          <GitCompare size={11} /> Diff
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-cream/35">
          Nothing to compare yet — log another bake, or duplicate this one to start a trial.
        </p>
      </div>
    );
  }

  const { rows, meta } = buildBakeComparison(bake, comparison);
  const lineage = lineageOf(bake, bakes);
  const comparisonLineage = lineageOf(comparison, bakes);
  const sameFamily = lineage.family.some((item) => item.id === comparison.id);

  const explain = async () => {
    if (explaining) return;
    const controller = new AbortController();
    explainAbort.current = controller;
    setExplaining(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const text = await explainBakeDiff(bake, comparison, bakes, controller.signal);
      if (!controller.signal.aborted) setExplanation(text);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setExplainError(
        caught instanceof BakeSommelierError
          ? caught.message
          : "The comparison couldn't be generated. Try again.",
      );
    } finally {
      if (!controller.signal.aborted) setExplaining(false);
      explainAbort.current = null;
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">
          <GitCompare size={11} /> Diff
        </p>
        <select
          value={comparison.id}
          onChange={(event) => setCompareId(event.target.value)}
          aria-label="Compare with another bake"
          className="max-w-[15rem] appearance-none rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10.5px] text-cream/70 outline-none focus:border-ember/60"
        >
          {others.map((item) => (
            <option key={item.id} value={item.id} className="bg-[#121218]">
              {optionLabel(item, bakes)}
            </option>
          ))}
        </select>
      </div>

      {sameFamily && (
        <p className="mt-1.5 font-mono text-[9px] text-cream/25">
          {comparison.id === lineage.parent?.id
            ? `Comparing with the trial this bake came from · T${comparisonLineage.trial}`
            : `Comparing with trial ${comparisonLineage.trial} of ${comparisonLineage.total}`}
        </p>
      )}

      {lineage.family.some((item) => item.photos.length > 0) && (
        <div className="mt-2.5">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-cream/25">
            The family, in pictures
          </p>
          <div className="no-scrollbar -mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
            {lineage.family
              .filter((item) => item.photos.length > 0)
              .slice(0, 8)
              .map((item) => {
                const current = item.id === bake.id;
                const against = item.id === comparison.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!current) setCompareId(item.id);
                    }}
                    disabled={current}
                    title={item.name}
                    className={cx(
                      "group w-[86px] shrink-0 text-left",
                      current && "cursor-default",
                    )}
                  >
                    <img
                      src={item.photos[0]}
                      alt={`${item.name} crumb`}
                      loading="lazy"
                      className={cx(
                        "aspect-square w-full rounded-lg border object-cover transition-opacity",
                        current
                          ? "border-ember/60"
                          : against
                            ? "border-sky/50"
                            : "border-white/10 opacity-70 group-hover:opacity-100",
                      )}
                    />
                    <span className="mt-1 block truncate font-mono text-[8.5px] text-cream/40">
                      {current ? "This bake" : against ? "Comparison" : item.name}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {(bake.actuals || comparison.actuals) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {([
            ["Dough", bake.actuals?.doughTempC, comparison.actuals?.doughTempC, "°C"],
            ["Room", bake.actuals?.roomTempC, comparison.actuals?.roomTempC, "°C"],
            ["Bake", bake.actuals?.bakeMinutes, comparison.actuals?.bakeMinutes, "min"],
          ] as const).map(([label, a, b, suffix]) =>
            a === undefined && b === undefined ? null : (
              <span
                key={label}
                className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] text-cream/45"
              >
                <span className="text-cream/25">{label}</span> {a ?? "—"}
                {a === undefined ? "" : suffix} → {b ?? "—"}
                {b === undefined ? "" : suffix}
              </span>
            ),
          )}
        </div>
      )}

      {meta.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] text-cream/45"
            >
              <span className="text-cream/25">{item.label}</span> {item.a} → {item.b}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[440px] text-[11px]">
          <thead>
            <tr className="text-left font-mono text-[8.5px] uppercase tracking-[0.1em] text-cream/30">
              <th scope="col" className="py-1 pr-2 font-normal">Metric</th>
              <th scope="col" className="px-2 py-1 text-right font-normal">This bake</th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                {comparison.name.length > 18 ? `${comparison.name.slice(0, 17)}…` : comparison.name}
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-normal">Δ</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => {
              const sectionRows = rows.filter((row) => row.section === section);
              if (!sectionRows.length) return null;
              return (
                <Fragment key={section}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="pb-1 pt-3 text-left font-mono text-[8px] uppercase tracking-[0.18em] text-ember/60"
                    >
                      {section}
                    </th>
                  </tr>
                  {sectionRows.map((row) => {
                    const delta = row.a - row.b;
                    const changed = !comparisonDeltaIsZero(row, delta);
                    return (
                      <tr key={row.label} className="border-t border-white/[0.055]">
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal text-cream/50">
                          {row.label}
                        </th>
                        <td className="px-2 py-1.5 text-right font-mono text-cream/85">
                          {formatComparisonValue(row, row.a, unit)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-cream/55">
                          {formatComparisonValue(row, row.b, unit)}
                        </td>
                        <td
                          className={cx(
                            "py-1.5 pl-2 text-right font-mono",
                            changed && row.higherIsBetter
                              ? delta > 0
                                ? "text-lime/80"
                                : "text-hot/80"
                              : "text-cream/35",
                          )}
                        >
                          {formatComparisonDelta(row, delta, unit)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-xl border border-ember/15 bg-ember/[0.035] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ember/70">
            <Sparkles size={11} /> AI read
          </p>
          <button
            type="button"
            onClick={() => void explain()}
            disabled={explaining}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ember/25 bg-ember/10 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ember-2 transition-colors hover:bg-ember/15 disabled:cursor-wait disabled:opacity-60"
          >
            {explaining ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Sparkles size={11} />
            )}
            {explaining ? "Reading both bakes" : explanation ? "Explain again" : "Explain this diff"}
          </button>
        </div>

        {explainError ? (
          <div role="alert" className="mt-2 flex items-start gap-2 text-[10.5px] leading-relaxed text-hot/90">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="flex-1">
              {explainError}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("doughlab:open-ai-settings"))}
                className="ml-1.5 underline decoration-hot/40 underline-offset-2 hover:text-hot"
              >
                Open AI settings
              </button>
            </span>
          </div>
        ) : explanation ? (
          <div className="mt-2 border-t border-white/8 pt-2 text-[11.5px] leading-relaxed text-cream/65">
            <ChatMarkdown text={explanation} />
            <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-cream/20">
              AI inference from your saved data · not a measurement
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-cream/30">
            Ask the sommelier to connect the formula changes, the ratings and what you noted.
          </p>
        )}
      </div>
    </div>
  );
}
