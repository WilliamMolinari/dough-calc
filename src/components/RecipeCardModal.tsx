import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import type { DoughMath } from "../lib/calc";
import { buildSchedule } from "../lib/calc";
import { fmtClock, fmtDay, fmtWeight } from "../lib/format";
import { ingredientLines, leavenSummary } from "../lib/recipe";
import type { Formula, Unit } from "../lib/types";
import { getStyle } from "../lib/presets";
import { ActionButton, Modal } from "./ui";

function RecipeCardContent({
  formula,
  math,
  unit,
  title,
}: {
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  title: string;
}) {
  const lines = ingredientLines(formula, math, unit);
  const style = getStyle(formula.styleId);
  const schedule = buildSchedule(formula);
  const bake = schedule[schedule.length - 1];

  return (
    <div className="rounded-[20px] bg-[#f8f3ea] p-5 text-[#201a14] sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-[#201a14]/12 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full border-2 border-[#c2410c]">
              <span className="size-1.5 rounded-full bg-[#c2410c]" />
            </span>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7a6a58]">
              DoughLab formula card
            </p>
          </div>
          <h3 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          <p className="mt-1 text-[11.5px] text-[#6b5c4b]">
            {style.name} · {math.ballCount} × {fmtWeight(math.ballWeight, unit)} ·{" "}
            {formula.hydration}% hydration
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7a6a58]">Total</p>
          <p className="font-display text-[22px] font-semibold">{fmtWeight(math.totalDough, unit)}</p>
          <p className="mt-1 font-mono text-[9px] text-[#7a6a58]">
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#a1522a]">Weigh</p>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-dotted border-[#201a14]/18 last:border-0">
                  <th scope="row" className="py-[7px] pr-2 text-left font-medium">
                    {line.label}
                  </th>
                  <td className="py-[7px] text-right font-mono tabular-nums">{fmtWeight(line.grams, unit)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="pt-2 text-left font-semibold">
                  Total
                </th>
                <td className="pt-2 text-right font-mono font-semibold tabular-nums">
                  {fmtWeight(math.totalDough, unit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#a1522a]">Ferment</p>
          <ul className="mt-2 space-y-1.5 text-[11.5px] leading-snug">
            <li className="flex items-baseline justify-between gap-2 border-b border-dotted border-[#201a14]/18 pb-1.5">
              <span>Bulk · {formula.roomTemp}°C</span>
              <span className="font-mono">{formula.bulkHours} h</span>
            </li>
            {formula.retardHours > 0 && (
              <li className="flex items-baseline justify-between gap-2 border-b border-dotted border-[#201a14]/18 pb-1.5">
                <span>Cold retard · {formula.fridgeTemp}°C</span>
                <span className="font-mono">{formula.retardHours} h</span>
              </li>
            )}
            {formula.temperHours > 0 && (
              <li className="flex items-baseline justify-between gap-2 border-b border-dotted border-[#201a14]/18 pb-1.5">
                <span>Temper at room</span>
                <span className="font-mono">{formula.temperHours} h</span>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-2">
              <span>Leaven</span>
              <span className="text-right font-mono text-[10.5px]">{leavenSummary(formula, math, unit)}</span>
            </li>
            {bake && (
              <li className="mt-1 rounded-lg bg-[#201a14]/[0.05] px-2 py-1.5 font-mono text-[10px]">
                Bake ≈ {fmtClock(bake.at)} · {fmtDay(bake.at)}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-[#201a14]/12 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#a1522a]">Baker's notes</p>
        <div className="mt-2 space-y-3">
          <span className="block border-b border-dotted border-[#201a14]/25" />
          <span className="block border-b border-dotted border-[#201a14]/25" />
          <span className="block border-b border-dotted border-[#201a14]/25" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8a7a67]">
        <span>{fmtWeight(math.flour, unit)} flour · {formula.salt}% salt</span>
        <span>Made with DoughLab</span>
      </div>
    </div>
  );
}

export function RecipeCardModal({
  open,
  onClose,
  formula,
  math,
  unit,
  title,
}: {
  open: boolean;
  onClose: () => void;
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  title: string;
}) {
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Printable recipe card"
        subtitle="A clean card for the fridge door — or save it as a PDF."
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="hidden font-mono text-[10px] text-cream/30 sm:block">
              Tip: choose “Save as PDF” in the print dialog
            </p>
            <div className="flex items-center gap-2">
              <ActionButton onClick={onClose}>Close</ActionButton>
              <ActionButton
                variant="primary"
                icon={Printer}
                onClick={() => window.print()}
                className="px-4"
              >
                Print card
              </ActionButton>
            </div>
          </div>
        }
      >
        <div className="rounded-[24px] bg-[#f8f3ea] p-1 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
          <RecipeCardContent formula={formula} math={math} unit={unit} title={title} />
        </div>
      </Modal>

      {open &&
        createPortal(
          <div id="print-sheet" aria-hidden="true">
            <RecipeCardContent formula={formula} math={math} unit={unit} title={title} />
          </div>,
          document.body,
        )}
    </>
  );
}
