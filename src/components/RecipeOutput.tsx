import { lazy, Suspense, useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChefHat,
  ClipboardCopy,
  Download,
  Droplets,
  FileJson,
  Flame,
  Image as ImageIcon,
  Loader2,
  Printer,
  Share2,
  Sparkles,
  Thermometer,
  Timer,
  Wheat,
} from "lucide-react";
import type { DoughMath } from "../lib/calc";
import { baseFlourLabel, flourBlendLabel, flourLabel } from "../lib/flours";
import { fmtHours, fmtWeight, fmtWeightValue, round } from "../lib/format";
import { ingredientLines } from "../lib/recipe";
import { convertTempText, fmtTemp } from "../lib/temperature";
import type { Formula, Unit } from "../lib/types";
import {
  buildRecipeText,
  copyText,
  downloadJson,
  downloadRecipeImage,
  recipeJson,
} from "../lib/exports";
import { getOvenProfile } from "../lib/ovens";
import { buildShareUrl } from "../lib/share";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useTempUnit } from "./TempUnit";
import { ActionButton, Badge, Card, cx } from "./ui";
import { FermentTimeline } from "./FermentTimeline";

const CompositionChart = lazy(() =>
  import("./CompositionChart").then((module) => ({ default: module.CompositionChart })),
);

const DOT: Record<string, string> = {
  flour: "#f3e3c8",
  flour2: "#e0b98b",
  water: "#79c9ff",
  leaven: "#ffb066",
  extra: "#c6f45f",
};

const PACE_TONE: Record<DoughMath["paceTone"], "sky" | "lime" | "hot"> = {
  slow: "sky",
  steady: "lime",
  fast: "hot",
};

function AnimatedWeight({ grams, unit }: { grams: number; unit: Unit }) {
  const animated = useAnimatedNumber(grams, 500);
  return <span className="tabular-nums">{fmtWeight(animated, unit)}</span>;
}

function AnimatedTotal({ grams, unit }: { grams: number; unit: Unit }) {
  const animated = useAnimatedNumber(grams, 500);
  return <span className="tabular-nums">{fmtWeightValue(animated, unit)}</span>;
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wheat;
}) {
  return (
    <div className="glass-inset rounded-xl px-2.5 py-2">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">
        <Icon size={10} />
        {label}
      </div>
      <p className="mt-1 truncate font-mono text-[12px] tabular-nums text-cream/85">{value}</p>
    </div>
  );
}

export function RecipeOutput({
  formula,
  math,
  unit,
  onSave,
  onPrint,
  onKitchen,
  onToast,
}: {
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  onSave: () => void;
  onPrint: () => void;
  onKitchen: () => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [rendering, setRendering] = useState(false);
  const lines = ingredientLines(formula, math, unit);
  const tempUnit = useTempUnit();
  const blend = flourBlendLabel(formula);
  const oven = getOvenProfile(formula.ovenProfile);

  const handleCopy = async () => {
    const ok = await copyText(buildRecipeText(formula, unit, undefined, tempUnit));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      onToast("Recipe copied to your clipboard", "success");
    } else {
      onToast("Clipboard access was blocked by the browser", "error");
    }
  };

  const handleJson = () => {
    downloadJson(recipeJson(formula, unit, "DoughLab formula"), "doughlab-formula.json");
    onToast("Formula JSON downloaded", "success");
  };

  const handleImage = async () => {
    setRendering(true);
    try {
      await downloadRecipeImage(formula, unit, "Pizza dough formula", tempUnit);
      onToast("Shareable card downloaded", "success");
    } catch {
      onToast("Could not render the share image", "error");
    } finally {
      setRendering(false);
    }
  };

  const handleShare = async () => {
    const url = buildShareUrl(formula, unit);
    if (navigator.share) {
      try {
        await navigator.share({ title: "DoughLab formula", url });
        return;
      } catch (error) {
        // A cancelled share sheet is not a request to copy the link.
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }
    const ok = await copyText(url);
    if (ok) {
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
      onToast("Share link copied — it restores this exact formula", "success");
    } else {
      onToast("Could not copy the link. Copy it from the address bar after opening it.", "error");
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember/80">
            Live output
          </p>
          <h2 className="mt-0.5 text-[19px] font-semibold text-cream">Weigh & bake</h2>
        </div>
        <Badge tone={PACE_TONE[math.paceTone]}>{math.paceLabel}</Badge>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-cream/30">
            Total dough
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[38px] font-semibold leading-none tracking-[-0.03em] text-cream">
              <AnimatedTotal grams={math.totalDough} unit={unit} />
            </span>
            <span className="font-mono text-[13px] text-cream/35">{unit}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-cream/45">
            {formula.sizing === "pan"
              ? `${math.ballCount} × ${formula.panLength}×${formula.panWidth} cm pan · ${fmtWeight(math.ballWeight, unit)} each`
              : `${math.ballCount} × ${fmtWeight(math.ballWeight, unit)}`}{" "}
            · {formula.hydration}% hydration
            {blend ? ` · ${blend}` : ""}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] text-cream/45">
            <Flame size={10} className="text-ember" />
            {fmtHours(math.effectiveHours)} effective
          </span>
          <p className="mt-1.5 font-mono text-[9.5px] text-cream/25">
            {math.effectiveHours > 0 ? `${Math.round(math.pace * 100)}% of target pace` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Metric label="Flour" value={fmtWeight(math.flour, unit)} icon={Wheat} />
        <Metric label="Water" value={fmtWeight(math.water, unit)} icon={Droplets} />
        <Metric label="Salt" value={fmtWeight(math.salt, unit)} icon={Sparkles} />
      </div>

      <div className="hairline my-4" />

      <Suspense fallback={<div className="h-[250px] rounded-2xl bg-white/[0.025]" aria-hidden />}>
        <CompositionChart
          math={math}
          unit={unit}
          primaryLabel={baseFlourLabel(formula)}
          secondaryLabel={
            formula.flour2Pct > 0 ? flourLabel(formula.flour2Type, formula.flour2Name) : undefined
          }
        />
      </Suspense>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/35">
            Weigh now
          </p>
          <p className="font-mono text-[9.5px] text-cream/25">% of total dough</p>
        </div>
        <ul className="mt-1">
          {lines.map((line) => (
            <li
              key={line.key}
              className="flex items-start justify-between gap-3 border-b border-white/[0.055] py-2 last:border-0"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  aria-hidden
                  className="mt-[6px] size-1.5 shrink-0 rounded-full"
                  style={{ background: DOT[line.accent ?? "extra"] }}
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-tight text-cream/85">{line.label}</p>
                  {line.note && (
                    <p className="mt-0.5 text-[10px] leading-snug text-cream/30">{line.note}</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[13px] text-cream">
                  <AnimatedWeight grams={line.grams} unit={unit} />
                </p>
                <p className="font-mono text-[9px] text-cream/25">
                  {round((line.grams / Math.max(math.totalDough, 1)) * 100, 1)}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hairline my-4" />

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cream/35">
          <Timer size={11} /> Schedule
        </p>
        <span className="flex items-center gap-1 font-mono text-[10px] text-cream/30">
          <Thermometer size={10} /> {fmtTemp(formula.roomTemp, tempUnit)} /{" "}
          {fmtTemp(formula.fridgeTemp, tempUnit)} · {convertTempText(oven.short, tempUnit)}
        </span>
      </div>
      <div className="mt-2.5">
        <FermentTimeline formula={formula} />
      </div>

      <div className="mt-4 space-y-2">
        <ActionButton
          variant="primary"
          onClick={onSave}
          icon={BookmarkPlus}
          className="w-full py-2.5 text-[13px]"
        >
          Save this bake to the journal
        </ActionButton>
        <ActionButton onClick={onKitchen} icon={ChefHat} className="w-full" ariaLabel="Open kitchen mode">
          Kitchen mode · large steps & timers
        </ActionButton>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton onClick={handleCopy} icon={copied ? Check : ClipboardCopy} ariaLabel="Copy recipe as text">
            {copied ? "Copied" : "Copy"}
          </ActionButton>
          <ActionButton onClick={handleShare} icon={shared ? Check : Share2} ariaLabel="Copy shareable formula link">
            {shared ? "Copied" : "Share"}
          </ActionButton>
          <ActionButton
            onClick={handleImage}
            icon={rendering ? Loader2 : ImageIcon}
            ariaLabel="Download recipe image"
            disabled={rendering}
          >
            <span className={cx(rendering && "opacity-70")}>{rendering ? "Rendering" : "PNG"}</span>
          </ActionButton>
          <ActionButton onClick={handleJson} icon={FileJson} ariaLabel="Download recipe JSON">
            JSON
          </ActionButton>
          <ActionButton onClick={onPrint} icon={Printer} ariaLabel="Open printable recipe card">
            Print
          </ActionButton>
        </div>
        <p className="pt-1 text-center font-mono text-[9.5px] text-cream/20">
          <Download size={9} className="mr-1 inline" />
          Everything stays in this browser
        </p>
      </div>
    </Card>
  );
}
