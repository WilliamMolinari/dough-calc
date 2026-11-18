import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChefHat,
  Clock3,
  Flame,
  Pizza,
  Users,
  Wheat,
} from "lucide-react";
import { calculateDough } from "../lib/calc";
import { G_PER_OZ, clamp, fmtClock, fmtDay, fmtWeight, round, toUnit } from "../lib/format";
import { getOvenProfile } from "../lib/ovens";
import { normalizePlan, type PlanSettings } from "../lib/plan";
import { getStyle } from "../lib/presets";
import { readStored, STORAGE_KEYS, writeStored } from "../lib/storage";
import type { Formula, Unit } from "../lib/types";
import { flourBlendLabel } from "../lib/flours";
import { convertTempText, fmtTemp } from "../lib/temperature";
import { useTempUnit } from "./TempUnit";
import { Badge, Card, NumberField, SectionHeading, cx } from "./ui";
import { OvenProfilePicker } from "./OvenProfilePicker";

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

interface PlanRow {
  key: string;
  label: string;
  at: Date;
  detail: string;
  tone: "mix" | "ferment" | "oven" | "serve";
}

export function DinnerPlanner({
  formula,
  unit,
  onFormulaChange,
  onKitchen,
}: {
  formula: Formula;
  unit: Unit;
  onFormulaChange: (patch: Partial<Formula>) => void;
  onKitchen: (formula: Formula, startAt?: number) => void;
}) {
  const [plan, setPlan] = useState<PlanSettings>(() =>
    normalizePlan(readStored<unknown>(STORAGE_KEYS.plan, {})),
  );

  useEffect(() => {
    writeStored(STORAGE_KEYS.plan, plan);
  }, [plan]);

  const oven = getOvenProfile(formula.ovenProfile);
  const tempUnit = useTempUnit();
  const style = getStyle(formula.styleId);
  const pies = clamp(Math.round(plan.guests * plan.piesPerGuest), 1, 80);
  const ballWeight = clamp(plan.ballWeight, 80, 900);
  const ballDisplay = round(toUnit(plan.ballWeight, unit), unit === "g" ? 0 : 1);
  const ballMin = unit === "g" ? 80 : round(toUnit(80, unit), 1);
  const ballMax = unit === "g" ? 900 : round(toUnit(900, unit), 1);
  const scaled: Formula = {
    ...formula,
    sizing: "balls",
    ballCount: pies,
    ballWeight,
  };
  const math = calculateDough(scaled);
  const blend = flourBlendLabel(scaled);
  const totalDough = math.totalDough;

  const serve = useMemo(() => {
    const date = new Date(`${plan.serveDate}T${plan.serveTime || "19:00"}:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [plan.serveDate, plan.serveTime]);

  // Ovens need a small recovery gap between launches; never less than one minute.
  const launchGap = Math.max(1, oven.bakeMin + 0.75);
  const lastLaunch = addMinutes(serve, -oven.bakeMin);
  const firstLaunch = addMinutes(lastLaunch, -(pies - 1) * launchGap);
  const preheatStart = addMinutes(firstLaunch, -oven.preheatMin);

  const doughMinutes =
    20 + (formula.bulkHours + formula.retardHours + formula.temperHours) * 60;
  const mixStart = addMinutes(firstLaunch, -doughMinutes);
  const firstServe = addMinutes(firstLaunch, oven.bakeMin);

  const rows: PlanRow[] = [
    {
      key: "mix",
      label: "Mix & rest",
      at: mixStart,
      detail: `${fmtWeight(math.flour, unit)} flour${
        blend ? ` (${blend})` : ""
      } · ${fmtWeight(math.water, unit)} water · ${fmtWeight(math.salt, unit)} salt. Rest 20 min before bulk.`,
      tone: "mix",
    },
    {
      key: "bulk",
      label: "Bulk ferment",
      at: addMinutes(mixStart, 20),
      detail: `${formula.bulkHours} h at ${fmtTemp(formula.roomTemp, tempUnit)}, then divide and ball.`,
      tone: "ferment",
    },
  ];

  if (formula.retardHours > 0) {
    rows.push({
      key: "retard",
      label: "Cold retard",
      at: addMinutes(mixStart, 20 + formula.bulkHours * 60),
      detail: `${formula.retardHours} h at ${fmtTemp(formula.fridgeTemp, tempUnit)} in a sealed tray.`,
      tone: "ferment",
    });
  }

  if (formula.temperHours > 0) {
    rows.push({
      key: "temper",
      label: "Temper",
      at: addMinutes(mixStart, 20 + (formula.bulkHours + formula.retardHours) * 60),
      detail: `${formula.temperHours} h covered at room temperature before stretching.`,
      tone: "ferment",
    });
  }

  rows.push({
    key: "preheat",
    label: "Fire the oven",
    at: preheatStart,
    detail: `${oven.name} to ${fmtTemp(oven.tempC, tempUnit)} for ${oven.preheatMin} min. ${convertTempText(oven.note, tempUnit)}`,
    tone: "oven",
  });

  const listed = Math.min(pies, 4);
  for (let index = 0; index < listed; index += 1) {
    rows.push({
      key: `launch-${index}`,
      label: pies === 1 ? "Launch the pie" : `Launch pie ${index + 1}`,
      at: addMinutes(firstLaunch, index * launchGap),
      detail: `${oven.bakeMin < 2 ? `${Math.round(oven.bakeMin * 60)} s` : `${oven.bakeMin} min`} bake, turn at ${oven.turnMin < 2 ? `${Math.round(oven.turnMin * 60)} s` : `${oven.turnMin} min`}.`,
      tone: "oven",
    });
  }
  if (pies > listed) {
    rows.push({
      key: "launch-more",
      label: `Pies ${listed + 1}–${pies}`,
      at: addMinutes(firstLaunch, listed * launchGap),
      detail: `Then one every ${round(launchGap, 1)} min. Keep the finished pies warm under a towel.`,
      tone: "oven",
    });
  }

  rows.push({
    key: "serve",
    label: "Serve",
    at: firstServe,
    detail:
      pies === 1
        ? "Out of the oven and straight to the table."
        : `First pie at ${fmtClock(firstServe)}, last at ${fmtClock(serve)}. ${fmtWeight(totalDough, unit)} of dough in total.`,
    tone: "serve",
  });

  // A long preheat can begin before the mix, so display the run sheet by time.
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  const firstAction = rows[0]?.at ?? mixStart;
  const totalMinutes = (serve.getTime() - firstAction.getTime()) / 60_000;
  const startsInPast = firstAction.getTime() < Date.now();

  const styles: Record<PlanRow["tone"], string> = {
    mix: "border-white/12 bg-white/[0.03] text-cream/70",
    ferment: "border-ember/25 bg-ember/[0.06] text-ember-2",
    oven: "border-hot/25 bg-hot/[0.06] text-hot",
    serve: "border-lime/25 bg-lime/[0.06] text-lime",
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0 p-4 sm:p-5">
          <SectionHeading
            eyebrow="Dinner plan"
            title="Work backwards from the table"
            description="Set when you want to eat. The plan lines up fermentation, preheat and every launch through one oven."
            icon={CalendarClock}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-cream/60">
                <CalendarClock size={13} className="text-cream/30" /> Serve date
              </span>
              <input
                type="date"
                value={plan.serveDate}
                onChange={(event) =>
                  setPlan((prev) => ({ ...prev, serveDate: event.target.value || prev.serveDate }))
                }
                aria-label="Serve date"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[13px] text-cream outline-none focus:border-ember/60"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-cream/60">
                <Clock3 size={13} className="text-cream/30" /> Serve time
              </span>
              <input
                type="time"
                value={plan.serveTime}
                onChange={(event) =>
                  setPlan((prev) => ({ ...prev, serveTime: event.target.value || "19:00" }))
                }
                aria-label="Serve time"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[13px] text-cream outline-none focus:border-ember/60"
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              label="Guests"
              value={plan.guests}
              onChange={(value) =>
                setPlan((prev) => ({ ...prev, guests: Math.max(1, Math.round(value)) }))
              }
              min={1}
              max={40}
              step={1}
              icon={Users}
            />
            <NumberField
              label="Pies per guest"
              value={plan.piesPerGuest}
              onChange={(value) =>
                setPlan((prev) => ({ ...prev, piesPerGuest: Math.max(1, Math.round(value)) }))
              }
              min={1}
              max={5}
              step={1}
              icon={Pizza}
            />
            <NumberField
              label="Ball weight"
              value={ballDisplay}
              onChange={(value) =>
                setPlan((prev) => ({
                  ...prev,
                  ballWeight: clamp(
                    Math.round(unit === "g" ? value : value * G_PER_OZ),
                    80,
                    900,
                  ),
                }))
              }
              min={ballMin}
              max={ballMax}
              step={unit === "g" ? 10 : 0.5}
              suffix={unit}
              icon={Wheat}
            />
          </div>

          <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream/35">
                {pies} pies · {fmtWeight(totalDough, unit)} dough · {style.name}
              </p>
              <Badge tone={startsInPast ? "hot" : "lime"}>
                {startsInPast ? "Start is in the past" : "Fits the clock"}
              </Badge>
            </div>
            {startsInPast && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-hot/80">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                Move the serve time later, shorten the cold retard, or start tomorrow.
              </p>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/30">
                Oven & throughput
              </p>
              <span className="font-mono text-[9px] text-cream/25">
                ~{round(60 / launchGap, 1)} pies/hour
              </span>
            </div>
            <div className="mt-1.5">
              <OvenProfilePicker
                value={formula.ovenProfile}
                onChange={(id) => onFormulaChange({ ovenProfile: id })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ember/80">
            At a glance
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { label: "Start mixing", value: fmtClock(mixStart), sub: fmtDay(mixStart), icon: ChefHat },
              { label: "First pie", value: fmtClock(firstServe), sub: fmtDay(firstServe), icon: Flame },
              { label: "Last pie", value: fmtClock(serve), sub: fmtDay(serve), icon: Pizza },
              {
                label: "Total time",
                value: `${Math.round(Math.max(0, totalMinutes) / 60)} h`,
                sub: `${Math.max(0, Math.round(totalMinutes))} min`,
                icon: Clock3,
              },
            ].map((item) => (
              <div key={item.label} className="glass-inset flex items-center gap-2.5 rounded-xl px-3 py-2.5">
                <item.icon size={15} className="shrink-0 text-ember/80" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">
                    {item.label}
                  </p>
                  <p className="truncate font-mono text-[13px] text-cream/85">{item.value}</p>
                  <p className="font-mono text-[8.5px] text-cream/25">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const hh = String(mixStart.getHours()).padStart(2, "0");
              const mm = String(mixStart.getMinutes()).padStart(2, "0");
              onKitchen({ ...scaled, startTime: `${hh}:${mm}` }, mixStart.getTime());
            }}
            className="btn-ember sheen mt-4 w-full rounded-xl px-3 py-2.5 text-[12.5px] font-semibold"
          >
            Open kitchen mode for {pies} pies
          </button>
          <p className="mt-2 text-center font-mono text-[9px] text-cream/25">
            Uses your current formula and oven profile
          </p>
        </Card>
      </div>

      <Card className="min-w-0 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ember/80">
              Run sheet
            </p>
            <h2 className="mt-0.5 text-[19px] font-semibold text-cream">The whole day, in order</h2>
          </div>
          <Badge tone="neutral">{fmtClock(serve)} serve</Badge>
        </div>

        <ol className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className={cx("flex items-start gap-3 rounded-2xl border p-3", styles[row.tone])}
            >
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-current/20 bg-black/20 font-mono text-[10px]">
                {fmtClock(row.at)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-cream/90">
                  {row.label}
                  {row.at.toDateString() !== rows[0]?.at.toDateString() && (
                    <span className="text-cream/35"> · {fmtDay(row.at)}</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-cream/40">{row.detail}</p>
              </div>
              <span className="hidden shrink-0 font-mono text-[9px] text-cream/25 sm:block">
                {fmtDay(row.at)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-[9px] leading-relaxed text-cream/20">
          Timing assumes a fully preheated oven and a {round(launchGap, 1)} min launch cadence. The
          first pie rests while you bake the rest — hold finished pies loosely under foil.
        </p>
      </Card>
    </div>
  );
}
