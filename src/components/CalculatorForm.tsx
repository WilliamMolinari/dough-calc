import {
  Beaker,
  Clock,
  Droplets,
  Flame,
  FlaskConical,
  Hourglass,
  Package,
  RefreshCw,
  Scale,
  Sparkles,
  Thermometer,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { DoughMath } from "../lib/calc";
import { yeastForType } from "../lib/calc";
import { fmtWeight, round, toUnit, G_PER_OZ, clamp } from "../lib/format";
import type { Formula, SweetenerKind, Unit, YeastType } from "../lib/types";
import {
  Badge,
  Card,
  SectionHeading,
  Segmented,
  SliderField,
  NumberField,
  Toggle,
  cx,
} from "./ui";
import { OvenProfilePicker } from "./OvenProfilePicker";

const LEAVEN_OPTIONS = [
  { value: "sourdough" as const, label: "Sourdough", icon: FlaskConical },
  { value: "yeast" as const, label: "Yeast", icon: Package },
  { value: "preferment" as const, label: "Pre-ferment", icon: Hourglass },
];

const YEAST_OPTIONS: Array<{ value: YeastType; label: string }> = [
  { value: "idy", label: "Instant dry" },
  { value: "ady", label: "Active dry" },
  { value: "fresh", label: "Fresh" },
];

const SWEETENER_OPTIONS: Array<{ value: SweetenerKind; label: string }> = [
  { value: "none", label: "None" },
  { value: "sugar", label: "Sugar" },
  { value: "honey", label: "Honey" },
  { value: "malt", label: "Malt" },
];

const paceTone: Record<DoughMath["paceTone"], "sky" | "lime" | "hot"> = {
  slow: "sky",
  steady: "lime",
  fast: "hot",
};

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="glass-soft flex items-center gap-2.5 rounded-xl px-2.5 py-2">
      <Icon size={14} className="shrink-0 text-ember/80" />
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">{label}</p>
        <p className="truncate font-mono text-[12px] tabular-nums text-cream/80">{value}</p>
      </div>
    </div>
  );
}

export function CalculatorForm({
  formula,
  math,
  unit,
  onChange,
}: {
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  onChange: (patch: Partial<Formula>) => void;
}) {
  const set = <K extends keyof Formula>(key: K, value: Formula[K]) => onChange({ [key]: value } as Partial<Formula>);

  const flourDisplay = round(toUnit(formula.flourWeight, unit), unit === "g" ? 0 : 1);
  const ballDisplay = round(toUnit(formula.ballWeight, unit), unit === "g" ? 0 : 1);
  const flourRange = unit === "g" ? { min: 100, max: 10000 } : { min: 3.5, max: 350 };
  const ballRange = unit === "g" ? { min: 60, max: 900 } : { min: 2, max: 32 };
  const fromDisplay = (value: number) => (unit === "g" ? value : value * G_PER_OZ);

  const suggestedYeast = math.suggestedYeastPct;
  const suggestedStarter = math.suggestedStarterPct;

  const toggleAutoDose = (checked: boolean) => {
    if (checked) {
      onChange({ autoLeaven: true });
      return;
    }
    onChange(
      formula.leavenMode === "sourdough"
        ? { autoLeaven: false, starterPct: suggestedStarter }
        : { autoLeaven: false, yeastPct: yeastForType(suggestedYeast, formula.yeastType) },
    );
  };

  return (
    <div className="space-y-4">
      {/* Batch ------------------------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="01 — Batch"
          title="The dough"
          description="Anchor the batch by flour or by finished dough balls. Every field recalculates instantly."
          icon={Scale}
        />

        <Segmented
          label="Batch sizing mode"
          value={formula.sizing}
          onChange={(value) =>
            onChange(
              value === "flour"
                ? { sizing: "flour", flourWeight: math.flour, ballCount: math.ballCount }
                : {
                    sizing: "balls",
                    ballCount: math.ballCount,
                    ballWeight: Math.round(math.ballWeight),
                  },
            )
          }
          options={[
            { value: "flour", label: "I know my flour" },
            { value: "balls", label: "I know my dough balls" },
          ]}
        />

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {formula.sizing === "flour" ? (
            <NumberField
              label="Total flour"
              value={flourDisplay}
              onChange={(value) => onChange({ flourWeight: clamp(fromDisplay(value), 10, 20000) })}
              min={flourRange.min}
              max={flourRange.max}
              step={unit === "g" ? 10 : 0.5}
              suffix={unit}
              icon={Wheat}
            />
          ) : (
            <div className="glass-inset rounded-xl px-2.5 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">
                Total flour
              </p>
              <p className="mt-0.5 font-mono text-[15px] tabular-nums text-cream/85">
                {fmtWeight(math.flour, unit)}
              </p>
            </div>
          )}

          <NumberField
            label="Dough balls"
            value={formula.ballCount}
            onChange={(value) => set("ballCount", Math.round(value))}
            min={1}
            max={80}
            step={1}
            suffix="pcs"
          />

          {formula.sizing === "balls" ? (
            <NumberField
              label="Ball weight"
              value={ballDisplay}
              onChange={(value) => onChange({ ballWeight: clamp(fromDisplay(value), 40, 1200) })}
              min={ballRange.min}
              max={ballRange.max}
              step={unit === "g" ? 5 : 0.25}
              suffix={unit}
            />
          ) : (
            <div className="glass-inset rounded-xl px-2.5 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">
                Ball weight
              </p>
              <p className="mt-0.5 font-mono text-[15px] tabular-nums text-cream/85">
                {fmtWeight(math.ballWeight, unit)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <SliderField
            label="Hydration"
            value={formula.hydration}
            onChange={(value) => set("hydration", value)}
            min={50}
            max={100}
            step={0.5}
            suffix="%"
            hint={
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-cream/60">{math.feel.label}</span>
                <span className="text-cream/30">— {math.feel.note}</span>
              </span>
            }
          />
          <SliderField
            label="Salt"
            value={formula.salt}
            onChange={(value) => set("salt", value)}
            min={0}
            max={5}
            step={0.1}
            suffix="%"
            hint="2.5% is the pizza sweet spot; below 1.8% tastes flat."
          />
        </div>

        <div className="hairline my-4" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2.5">
            <p className="text-[12.5px] font-medium text-cream/65">Sweetener</p>
            <Segmented
              label="Sweetener type"
              size="sm"
              value={formula.sweetener}
              onChange={(value) =>
                onChange({
                  sweetener: value,
                  sweetenerPct: value !== "none" && formula.sweetenerPct <= 0 ? 1 : formula.sweetenerPct,
                })
              }
              options={SWEETENER_OPTIONS}
            />
            {formula.sweetener !== "none" && (
              <SliderField
                label="Amount"
                value={formula.sweetenerPct}
                onChange={(value) => set("sweetenerPct", value)}
                min={0}
                max={5}
                step={0.1}
                suffix="%"
              />
            )}
          </div>
          <div>
            <SliderField
              label="Oil / fat"
              value={formula.oil}
              onChange={(value) => set("oil", value)}
              min={0}
              max={8}
              step={0.5}
              suffix="%"
              hint="Olive oil softens the crumb and helps browning in home ovens."
            />
          </div>
        </div>
      </Card>

      {/* Leavening --------------------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="02 — Leavening"
          title="What lifts it"
          description="Sourdough, commercial yeast, or a pre-ferment for bakery-level flavour."
          icon={FlaskConical}
        />

        <Segmented
          label="Leavening method"
          value={formula.leavenMode}
          onChange={(value) => set("leavenMode", value)}
          options={LEAVEN_OPTIONS}
        />

        <div className="mt-4">
          {formula.leavenMode === "sourdough" && (
            <div className="space-y-3">
              <div className={cx("transition-opacity", formula.autoLeaven && "pointer-events-none opacity-55")}>
                <SliderField
                  label="Starter (100% hydration)"
                  value={formula.starterPct}
                  onChange={(value) => set("starterPct", value)}
                  min={1}
                  max={50}
                  step={1}
                  suffix="%"
                  hint={`≈ ${fmtWeight((math.flour * formula.starterPct) / 100, unit)} of ripe starter, half flour half water.`}
                />
              </div>
              <Toggle
                label="Auto dose from the schedule"
                checked={formula.autoLeaven}
                onChange={toggleAutoDose}
                description={`Lab suggests ${suggestedStarter}% for ${math.effectiveHours.toFixed(1)} effective hours`}
              />
              <p className="rounded-xl border border-lime/15 bg-lime/[0.05] px-3 py-2 text-[11px] leading-relaxed text-lime/70">
                Sourdough is temperature-sensitive: at {formula.roomTemp}°C your {formula.hydration}%
                dough wants roughly {suggestedStarter}% starter. Use a ripe, doubled starter.
              </p>
            </div>
          )}

          {formula.leavenMode === "yeast" && (
            <div className="space-y-3">
              <Segmented
                label="Yeast type"
                size="sm"
                value={formula.yeastType}
                onChange={(value) => {
                  const idy = formula.yeastType === "idy" ? formula.yeastPct : yeastForTypeReverse(formula.yeastPct, formula.yeastType);
                  onChange({ yeastType: value, yeastPct: round(yeastForType(idy, value), 2) });
                }}
                options={YEAST_OPTIONS}
              />
              <div className={cx("transition-opacity", formula.autoLeaven && "pointer-events-none opacity-55")}>
                <NumberField
                  label={`${YEAST_LABEL_SHORT[formula.yeastType]} dose`}
                  hint={`${math.suggestedYeastPct}% IDY equivalent is suggested for this schedule.`}
                  value={formula.yeastPct}
                  onChange={(value) => set("yeastPct", value)}
                  min={0}
                  max={5}
                  step={0.01}
                  suffix="%"
                />
              </div>
              <Toggle
                label="Auto dose from the schedule"
                checked={formula.autoLeaven}
                onChange={toggleAutoDose}
                description={`Lab suggests ${yeastForType(suggestedYeast, formula.yeastType)}% ${YEAST_LABEL_SHORT[formula.yeastType]}`}
              />
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="IDY" value={`${math.suggestedYeastPct}%`} icon={Package} />
                <MiniStat label="Active dry" value={`${yeastForType(math.suggestedYeastPct, "ady")}%`} icon={Package} />
                <MiniStat label="Fresh" value={`${yeastForType(math.suggestedYeastPct, "fresh")}%`} icon={Package} />
              </div>
            </div>
          )}

          {formula.leavenMode === "preferment" && (
            <div className="space-y-3">
              <Segmented
                label="Pre-ferment type"
                size="sm"
                value={formula.prefermentKind}
                onChange={(value) =>
                  onChange({
                    prefermentKind: value,
                    prefermentHydration: value === "poolish" ? 100 : 55,
                  })
                }
                options={[
                  { value: "poolish", label: "Poolish" },
                  { value: "biga", label: "Biga" },
                ]}
              />
              <SliderField
                label="Pre-fermented flour"
                value={formula.prefermentPct}
                onChange={(value) => set("prefermentPct", value)}
                min={10}
                max={60}
                step={5}
                suffix="%"
                hint={`${fmtWeight(math.prefermentFlour, unit)} flour · ${fmtWeight(math.prefermentWater, unit)} water · ${fmtWeight(math.prefermentYeast, unit)} yeast, mixed the night before.`}
              />
              <SliderField
                label="Pre-ferment hydration"
                value={formula.prefermentHydration}
                onChange={(value) => set("prefermentHydration", value)}
                min={50}
                max={110}
                step={5}
                suffix="%"
              />
              <div className={cx("transition-opacity", formula.autoLeaven && "pointer-events-none opacity-55")}>
                <NumberField
                  label="Total yeast"
                  hint={`Split 20% into the pre-ferment, 80% in the final dough. ${math.suggestedYeastPct}% IDY suggested.`}
                  value={formula.yeastPct}
                  onChange={(value) => set("yeastPct", value)}
                  min={0}
                  max={5}
                  step={0.01}
                  suffix="%"
                />
              </div>
              <Toggle
                label="Auto dose from the schedule"
                checked={formula.autoLeaven}
                onChange={toggleAutoDose}
                description={`Lab suggests ${yeastForType(suggestedYeast, formula.yeastType)}% ${YEAST_LABEL_SHORT[formula.yeastType]}`}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Fermentation ------------------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="03 — Fermentation"
          title="Time & temperature"
          description="The engine converts your room and fridge temperatures into an effective fermentation window."
          icon={Thermometer}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Room temperature"
            value={formula.roomTemp}
            onChange={(value) => set("roomTemp", value)}
            min={14}
            max={32}
            step={0.5}
            suffix="°C"
          />
          <SliderField
            label="Fridge temperature"
            value={formula.fridgeTemp}
            onChange={(value) => set("fridgeTemp", value)}
            min={0}
            max={10}
            step={0.5}
            suffix="°C"
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <NumberField
            label="Bulk"
            value={formula.bulkHours}
            onChange={(value) => set("bulkHours", value)}
            min={0}
            max={96}
            step={0.5}
            suffix="h"
            icon={Clock}
          />
          <NumberField
            label="Cold retard"
            value={formula.retardHours}
            onChange={(value) => set("retardHours", value)}
            min={0}
            max={120}
            step={1}
            suffix="h"
            icon={Droplets}
          />
          <NumberField
            label="Temper"
            value={formula.temperHours}
            onChange={(value) => set("temperHours", value)}
            min={0}
            max={24}
            step={0.5}
            suffix="h"
            icon={Sparkles}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">Mixing time</span>
            <input
              type="time"
              value={formula.startTime}
              onChange={(event) => set("startTime", event.target.value || "09:00")}
              aria-label="Dough mixing time"
              className="mt-1.5 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm text-cream outline-none focus:border-ember/60"
            />
          </label>
          <Badge tone="neutral" className="mb-1">
            <RefreshCw size={11} />
            {math.effectiveHours.toFixed(1)} h effective
          </Badge>
        </div>

        <div className="glass-inset mt-4 rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-cream/75">
              <Beaker size={14} className="text-ember/80" />
              Fermentation pace
            </span>
            <Badge tone={paceTone[math.paceTone]}>{math.paceLabel}</Badge>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-cream/40">{math.paceNote}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <MiniStat
              label="Leaven load"
              value={
                formula.leavenMode === "sourdough"
                  ? `${round(formula.starterPct, 0)}% starter`
                  : `${round(formula.yeastPct, 2)}% ${formula.yeastType.toUpperCase()}`
              }
              icon={FlaskConical}
            />
            <MiniStat
              label="Schedule match"
              value={`${Math.round(math.pace * 100)}% of target`}
              icon={RefreshCw}
            />
          </div>
        </div>
      </Card>

      {/* Oven ---------------------------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="04 — Oven"
          title="Your oven"
          description="The same formula behaves differently on steel, gas and wood. Pick your oven so the timeline and bake cues match it."
          icon={Flame}
        />
        <OvenProfilePicker
          value={formula.ovenProfile}
          onChange={(id) => onChange({ ovenProfile: id })}
        />
      </Card>
    </div>
  );
}

const YEAST_LABEL_SHORT: Record<YeastType, string> = {
  idy: "Instant dry",
  ady: "Active dry",
  fresh: "Fresh",
};

/** Given a mass of some yeast type, return the IDY-equivalent percentage. */
function yeastForTypeReverse(pct: number, type: YeastType): number {
  if (type === "fresh") return pct / 3;
  if (type === "ady") return pct / 1.25;
  return pct;
}
