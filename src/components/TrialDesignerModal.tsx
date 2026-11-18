import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import {
  TRIAL_VARIABLES,
  adjustFormula,
  formulaValue,
  trialChangeLabel,
  trialVariableSpec,
  type TrialVariable,
} from "../lib/experiments";
import { calculateDough } from "../lib/calc";
import { fmtWeight } from "../lib/format";
import type { BakeEntry } from "../lib/types";
import { ActionButton, Modal, cx } from "./ui";

export function TrialDesignerModal({
  open,
  bake,
  unit,
  onClose,
  onCreate,
}: {
  open: boolean;
  bake: BakeEntry;
  unit: "g" | "oz";
  onClose: () => void;
  onCreate: (design: { variable: TrialVariable; delta: number; hypothesis: string }) => void;
}) {
  const [variable, setVariable] = useState<TrialVariable>("hydration");
  const [delta, setDelta] = useState(2);
  const [hypothesis, setHypothesis] = useState("");

  useEffect(() => {
    if (!open) return;
    setVariable("hydration");
    setDelta(2);
    setHypothesis("");
  }, [open, bake.id]);

  const spec = trialVariableSpec(variable);
  const before = formulaValue(bake.formula, variable);
  const nextFormula = adjustFormula(bake.formula, variable, delta);
  const after = formulaValue(nextFormula, variable);
  const math = calculateDough(nextFormula);
  const changed = Number.isFinite(delta) && delta !== 0 && after !== before;

  const pickVariable = (key: TrialVariable) => {
    setVariable(key);
    setDelta(trialVariableSpec(key).step);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Design the next trial"
      subtitle="Change one thing, write down why, and let the family comparison tell you whether it worked."
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-cream/30">
            {changed ? trialChangeLabel(variable, delta) : "Pick a non-zero change"}
          </p>
          <div className="flex items-center gap-2">
            <ActionButton onClick={onClose}>Cancel</ActionButton>
            <ActionButton
              variant="primary"
              icon={FlaskConical}
              disabled={!changed}
              onClick={() => onCreate({ variable, delta, hypothesis })}
            >
              Plan trial
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="glass-inset rounded-2xl px-3.5 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ember/70">From</p>
          <p className="mt-0.5 truncate text-[13px] text-cream/80">{bake.name}</p>
          <p className="mt-1 font-mono text-[10px] text-cream/35">
            {bake.formula.hydration}% hydration · {bake.formula.salt}% salt ·{" "}
            {bake.formula.bulkHours} h bulk
          </p>
        </div>

        <div>
          <p className="text-[12px] font-medium text-cream/60">Variable</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {TRIAL_VARIABLES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={variable === item.key}
                onClick={() => pickVariable(item.key)}
                className={cx(
                  "rounded-xl border px-2.5 py-2 text-left transition-colors",
                  variable === item.key
                    ? "border-ember/45 bg-ember/10 text-ember-2"
                    : "border-white/8 bg-white/[0.025] text-cream/50 hover:border-white/20",
                )}
              >
                <span className="block text-[11.5px]">{item.label}</span>
                <span className="font-mono text-[9px] text-cream/25">{item.unit}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">
              Change <span className="font-mono text-[9.5px] text-cream/25">negative is fine</span>
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step={spec.step}
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 font-mono text-[14px] text-cream outline-none focus:border-ember/60"
              />
              <span className="font-mono text-[12px] text-cream/35">{spec.unit}</span>
            </div>
          </label>
          <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/30">
              {spec.label}
            </p>
            <p className="mt-1 font-mono text-[15px] text-cream">
              {before}
              {spec.unit}
              <span className="mx-1.5 text-cream/25">→</span>
              <span className="text-ember-2">
                {after}
                {spec.unit}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 font-mono text-[10px] leading-relaxed text-cream/35">
          New batch: {math.ballCount} × {fmtWeight(math.ballWeight, unit)} ·{" "}
          {nextFormula.hydration}% hydration · {fmtWeight(math.totalDough, unit)} total
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-cream/60">Hypothesis</span>
          <span className="ml-1.5 font-mono text-[9.5px] text-cream/25">optional</span>
          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            rows={3}
            maxLength={400}
            placeholder="A wetter dough should open the crumb without the rim going slack."
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
          />
        </label>

        <p className="text-[10.5px] leading-relaxed text-cream/25">
          The planned trial is unrated until you bake it. Rating it later keeps the family history
          honest and gives the comparison something to measure.
        </p>
      </div>
    </Modal>
  );
}
