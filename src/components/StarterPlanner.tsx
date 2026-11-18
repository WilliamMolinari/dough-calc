import { useMemo, useState } from "react";
import { CalendarPlus, FlaskConical, Wheat } from "lucide-react";
import type { DoughMath } from "../lib/calc";
import { fmtClock, fmtDay, fmtWeight, round } from "../lib/format";
import { planStarterBuild } from "../lib/starter";
import type { Formula, Unit } from "../lib/types";
import { downloadTimerIcs } from "../lib/exports";
import { Badge, Card, NumberField, SectionHeading, Segmented, cx } from "./ui";

const RATIOS = [
  { value: "1", label: "1:1:1" },
  { value: "2", label: "1:2:2" },
  { value: "5", label: "1:5:5" },
  { value: "10", label: "1:10:10" },
];

/**
 * Backwards from the dough: how much starter to build, how many feeds it takes
 * and when the first one has to start. The calculator already knows the grams.
 */
export function StarterPlanner({
  formula,
  math,
  unit,
  onToast,
}: {
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const sourdough = formula.leavenMode === "sourdough";
  const [needed, setNeeded] = useState(() =>
    sourdough ? Math.max(20, Math.round(math.starter)) : 150,
  );
  const [seed, setSeed] = useState(20);
  const [ratio, setRatio] = useState("5");
  const [intervalHours, setIntervalHours] = useState(8);
  const [touched, setTouched] = useState(false);

  // Follow the calculator until the baker overrides the amount by hand.
  const target = touched ? needed : sourdough ? Math.max(20, Math.round(math.starter)) : needed;

  const mixAt = useMemo(() => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(formula.startTime);
    const date = new Date();
    date.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0, 0, 0);
    return date;
  }, [formula.startTime]);

  const plan = useMemo(
    () =>
      planStarterBuild({
        neededGrams: target,
        seedGrams: seed,
        ratio: Number(ratio),
        intervalHours,
        mixAt,
      }),
    [intervalHours, mixAt, ratio, seed, target],
  );

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading
        eyebrow="Plan — leaven"
        title="Build the starter"
        description="Work backwards from the starter this dough needs. Feed amounts, times, and what to keep for next time."
        icon={FlaskConical}
        action={<Badge tone={sourdough ? "lime" : "neutral"}>{sourdough ? "In use" : "Preview"}</Badge>}
      />

      {!sourdough && (
        <p className="mb-3 rounded-xl border border-sky/20 bg-sky/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky/80">
          This formula uses {formula.leavenMode === "preferment" ? "a pre-ferment" : "commercial yeast"}.
          The build below is a 150 g example — switch the calculator to sourdough and it sizes itself
          from your dough.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Starter needed"
          value={target}
          onChange={(value) => {
            setTouched(true);
            setNeeded(Math.round(value));
          }}
          min={10}
          max={2000}
          step={5}
          suffix="g"
          hint={sourdough ? `${fmtWeight(math.starter, unit)} from your current formula` : undefined}
          icon={Wheat}
        />
        <NumberField
          label="Seed you have"
          value={seed}
          onChange={(value) => setSeed(Math.round(value))}
          min={1}
          max={500}
          step={5}
          suffix="g"
          hint="A spoonful of fridge starter is plenty."
        />
        <NumberField
          label="Between feeds"
          value={intervalHours}
          onChange={(value) => setIntervalHours(value)}
          min={4}
          max={24}
          step={1}
          suffix="h"
        />
      </div>

      <div className="mt-3">
        <p className="text-[12px] font-medium text-cream/60">Feeding ratio (starter : flour : water)</p>
        <div className="mt-1.5">
          <Segmented label="Feeding ratio" size="sm" value={ratio} onChange={setRatio} options={RATIOS} />
        </div>
      </div>

      <div className="mt-3.5 rounded-2xl border border-white/8 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">
            {plan.feeds.length ? `${plan.feeds.length} feeds` : "No feeds needed"}
          </p>
          <p className="font-mono text-[9.5px] text-cream/30">mix at {fmtClock(mixAt)}</p>
        </div>

        {plan.feeds.length > 0 ? (
          <ol className="mt-2 space-y-1.5">
            {plan.feeds.map((feed) => (
              <li
                key={feed.index}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className="font-mono text-[10.5px] text-ember-2">
                  Feed {feed.index} · {fmtClock(feed.at)}
                  <span className="text-cream/25"> · {fmtDay(feed.at)}</span>
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-cream/65">
                  {round(feed.seed, 0)} g starter + {round(feed.flour, 0)} g flour +{" "}
                  {round(feed.water, 0)} g water = {round(feed.total, 0)} g
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[11.5px] leading-relaxed text-cream/45">
            You already have more than this dough needs. Feed it so it peaks at mix time.
          </p>
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-cream/40">{plan.note}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9.5px] text-cream/25">
            uses {round(plan.totalFlour, 0)} g flour · {round(plan.totalWater, 0)} g water
          </span>
          {plan.feeds[0] && (
            <button
              type="button"
              onClick={() => {
                downloadTimerIcs("Start the starter build", plan.feeds[0].at.getTime(), "DoughLab starter");
                onToast("Alarm file downloaded — open it to add it to your calendar", "success");
              }}
              className={cx(
                "ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04]",
                "px-2.5 py-1.5 text-[11px] text-cream/60 transition-colors hover:text-cream",
              )}
            >
              <CalendarPlus size={12} /> Alarm for the first feed
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
