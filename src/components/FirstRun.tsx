import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { STYLES, getStyle } from "../lib/presets";
import type { Formula } from "../lib/types";
import { Card, cx } from "./ui";

/**
 * Three answers for a first-time baker: what are we making, how many, and when
 * do we start. Everything else in the calculator is optional and stays put —
 * this only seeds the formula and gets out of the way.
 */
export function FirstRun({
  onApply,
  onStart,
  onSkip,
}: {
  onApply: (patch: Partial<Formula>) => void;
  onStart: () => void;
  onSkip: () => void;
}) {
  const [styleId, setStyleId] = useState("neapolitan");
  const [count, setCount] = useState(4);
  const [startTime, setStartTime] = useState("09:00");
  const selected = getStyle(styleId);

  const start = () => {
    const preset = getStyle(styleId);
    onApply({
      ...preset.formula,
      ballCount: Math.min(20, Math.max(1, Math.round(count) || 1)),
      startTime,
    });
    onStart();
  };

  return (
    <Card className="relative overflow-hidden p-4 sm:p-5" as="section">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(70% 90% at 10% 0%, rgba(255,122,61,0.16), transparent 65%)",
        }}
      />
      <div className="relative">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ember/85">
          <Sparkles size={11} /> New here?
        </p>
        <h2 className="mt-1 text-[20px] font-semibold text-cream sm:text-[23px]">
          Three answers and you can start weighing.
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-cream/45">
          Pick a style, say how many pizzas, and choose when you want to mix. The calculator
          fills itself in — every number stays editable.
        </p>

        <div className="mt-3.5">
          <p className="text-[12px] font-medium text-cream/60">1. What are you making?</p>
          <div role="group" aria-label="Choose a style" className="mt-1.5 flex flex-wrap gap-1.5">
            {STYLES.map((preset) => {
              const active = preset.id === styleId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStyleId(preset.id)}
                  className={cx(
                    "rounded-xl border px-2.5 py-1.5 text-left transition-colors",
                    active
                      ? "border-ember/45 bg-ember/12 text-cream"
                      : "border-white/8 bg-white/[0.025] text-cream/55 hover:border-white/18 hover:text-cream/85",
                  )}
                >
                  <span className="block text-[11.5px]">{preset.name}</span>
                  <span className="block font-mono text-[8.5px] text-cream/30">{preset.short}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10.5px] text-cream/30">{selected.blurb}</p>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">2. How many pizzas?</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[13px] text-cream outline-none focus:border-ember/60"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">3. When do you mix?</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value || "09:00")}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[13px] text-cream outline-none focus:border-ember/60"
            />
          </label>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={start}
            className="btn-ember sheen inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold"
          >
            Start with this dough <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11.5px] text-cream/55 transition-colors hover:text-cream"
          >
            I know my way around
          </button>
        </div>
      </div>
    </Card>
  );
}
