import { Award, Sparkles, TrendingUp } from "lucide-react";
import { buildInsights, type GroupInsight } from "../lib/insights";
import { fmtDate } from "../lib/format";
import type { BakeEntry } from "../lib/types";
import { Badge, Card, Stars, cx } from "./ui";

function Bars({ groups, empty }: { groups: GroupInsight[]; empty: string }) {
  const max = Math.max(...groups.map((group) => group.avgOverall), 1);
  if (!groups.length) {
    return <p className="font-mono text-[10px] text-cream/25">{empty}</p>;
  }
  return (
    <div className="space-y-1.5">
      {groups.slice(0, 5).map((group) => (
        <div key={group.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] text-cream/55">{group.label}</span>
            <span className="shrink-0 font-mono text-[9.5px] text-cream/35">
              {group.avgOverall.toFixed(1)} · {group.count}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember-2 via-ember to-hot"
              style={{ width: `${(group.avgOverall / Math.max(max, 5)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function JournalInsights({ bakes }: { bakes: BakeEntry[] }) {
  const insights = buildInsights(bakes);

  if (insights.ratedCount < 2) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-ember/20 bg-ember/10 text-ember">
            <TrendingUp size={16} />
          </span>
          <div>
            <p className="text-[13px] font-medium text-cream/80">Insights unlock with ratings</p>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/40">
              Rate at least two bakes and this panel will show what your best pizzas have in common:
              hydration, fermentation window, oven and flour.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const best = insights.best;
  if (!best) return null;

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr] sm:p-5">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ember/80">
              <Award size={11} /> Your benchmark
            </p>
            <h3 className="mt-1 text-[19px] font-semibold leading-tight text-cream">{best.name}</h3>
            <p className="mt-0.5 font-mono text-[9.5px] text-cream/30">
              {best.styleName} · {fmtDate(best.createdAt)} · {best.formula.hydration}% hydration
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={best.ratings.overall} size={16} label="Benchmark rating" />
              <span className="font-mono text-[11px] text-ember-2">
                {best.ratings.overall}/5
              </span>
            </div>
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-cream/45">
              {best.notes || "No notes on this one — the rating says it all."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Rated bakes", value: `${insights.ratedCount}/${insights.total}` },
              { label: "Average", value: `${insights.avgOverall.toFixed(1)}/5` },
              { label: "Bulk", value: `${best.formula.bulkHours} h` },
              { label: "Cold retard", value: `${best.formula.retardHours} h` },
            ].map((item) => (
              <div key={item.label} className="glass-inset rounded-xl px-2.5 py-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-cream/30">
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono text-[12.5px] text-cream/85">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {insights.traits.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cream/35">
              <Sparkles size={11} className="text-ember" /> What the top 25% share
            </p>
            <Badge tone="neutral">vs the rest</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {insights.traits.map((trait) => {
              const delta = trait.top - trait.rest;
              return (
                <div
                  key={trait.label}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-2.5 py-2"
                >
                  <span className="text-[11px] text-cream/55">{trait.label}</span>
                  <span className="flex items-baseline gap-1.5 font-mono text-[10px]">
                    <span className="text-cream/85">
                      {trait.top}
                      {trait.unit}
                    </span>
                    <span
                      className={cx(
                        "rounded px-1 py-0.5 text-[9px]",
                        Math.abs(delta) < 0.15
                          ? "text-cream/25"
                          : delta > 0
                            ? "bg-lime/10 text-lime/80"
                            : "bg-hot/10 text-hot/80",
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {Math.round(delta * 10) / 10}
                      {trait.unit}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-cream/25">
            Small journals make noisy averages. Treat these as clues, not rules.
          </p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: "By style", groups: insights.byStyle, empty: "No rated styles yet." },
          { title: "By oven", groups: insights.byOven, empty: "Add an oven to your bakes." },
          { title: "By hydration", groups: insights.byHydration, empty: "No rated bakes yet." },
          { title: "By ferment length", groups: insights.byFerment, empty: "No rated bakes yet." },
        ].map((section) => (
          <Card key={section.title} className="p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/35">
              {section.title}
            </p>
            <div className="mt-2.5">
              <Bars groups={section.groups} empty={section.empty} />
            </div>
          </Card>
        ))}
      </div>

      {insights.outcomes.length > 0 && (
        <Card className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/35">
            What you tasted, by score
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {insights.outcomes.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-ember/15 bg-ember/[0.06] px-2.5 py-1 font-mono text-[10px] text-cream/55"
              >
                {tag.label}
                <span className="text-ember-2">{tag.avgOverall.toFixed(1)}</span>
                <span className="text-cream/25">· {tag.count}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-cream/25">
            These are the signals you tagged, not proof of cause — the diff and your notes carry the
            rest.
          </p>
        </Card>
      )}

      {insights.tags.length > 0 && (
        <Card className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/35">
            Tags that rate highest
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {insights.tags.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-cream/55"
              >
                {tag.label}
                <span className="text-ember-2">{tag.avgOverall.toFixed(1)}</span>
                <span className="text-cream/25">· {tag.count}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
