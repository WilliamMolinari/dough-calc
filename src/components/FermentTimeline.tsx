import { useMemo } from "react";
import {
  Clock3,
  Flame,
  Pizza,
  Snowflake,
  Sun,
  Utensils,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { buildSchedule, type ScheduleStep } from "../lib/calc";
import { fmtClock, fmtDay } from "../lib/format";
import type { Formula } from "../lib/types";
import { useTempUnit } from "./TempUnit";
import { cx } from "./ui";

const ICONS: Record<ScheduleStep["kind"], LucideIcon> = {
  mix: Utensils,
  fold: Waves,
  bulk: Clock3,
  chill: Snowflake,
  warm: Sun,
  fire: Flame,
  bake: Pizza,
};

const ACCENTS: Record<ScheduleStep["kind"], string> = {
  mix: "text-cream/60 border-white/12",
  fold: "text-sky/70 border-sky/20",
  bulk: "text-ember-2 border-ember/25",
  chill: "text-sky border-sky/25",
  warm: "text-lime border-lime/25",
  fire: "text-hot border-hot/25",
  bake: "text-hot border-hot/30",
};

export function FermentTimeline({
  formula,
  compact = false,
}: {
  formula: Formula;
  compact?: boolean;
}) {
  const tempUnit = useTempUnit();
  const steps = useMemo(() => buildSchedule(formula, undefined, tempUnit), [formula, tempUnit]);
  const visible = compact
    ? steps.filter((step) => step.key !== "folds" && step.kind !== "fire")
    : steps;
  const startDay = steps[0]?.at.toDateString();
  const ready = steps[steps.length - 1];

  return (
    <ol className="relative">
      {visible.map((step, index) => {
        const Icon = ICONS[step.kind];
        const isLast = index === visible.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-3.5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-white/12 to-white/5"
              />
            )}
            <span
              className={cx(
                "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border bg-ink-2",
                ACCENTS[step.kind],
              )}
            >
              <Icon size={11.5} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-medium text-cream/80">{step.label}</p>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-cream/45">
                  {fmtClock(step.at)}
                  {step.at.toDateString() !== startDay ? (
                    <span className="text-cream/30">
                      {" · "}
                      {step.at.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-cream/35">{step.detail}</p>
              {step.durationLabel && (
                <span className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.12em] text-cream/25">
                  {step.durationLabel}
                </span>
              )}
            </div>
          </li>
        );
      })}
      {ready && (
        <li className="mt-2 flex items-center gap-2 rounded-xl border border-ember/15 bg-ember/[0.06] px-2.5 py-2">
          <Pizza size={13} className="text-ember" />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember-2/80">
            Ready to bake {fmtDay(ready.at)} · {fmtClock(ready.at)}
          </p>
        </li>
      )}
    </ol>
  );
}
