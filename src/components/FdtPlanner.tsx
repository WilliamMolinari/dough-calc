import { useState } from "react";
import { Droplets, RotateCcw, Save, Thermometer } from "lucide-react";
import {
  calibrate,
  estimateDoughTemp,
  estimateWaterTemp,
  loadFdtSettings,
  resetCalibration,
  saveFdtSettings,
  type FdtSettings,
} from "../lib/fdt";
import { fmtNumber } from "../lib/format";
import { Badge, Card, SectionHeading, SliderField, cx } from "./ui";

export function FdtPlanner({ roomTemp }: { roomTemp: number }) {
  const [settings, setSettings] = useState<FdtSettings>(() => loadFdtSettings());
  const [measured, setMeasured] = useState("");
  const [waterUsed, setWaterUsed] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const water = estimateWaterTemp(settings, roomTemp);
  const predicted = estimateDoughTemp(water, roomTemp, settings);
  const measuredValue = Number.parseFloat(measured.replace(",", "."));
  const waterValue = Number.parseFloat(waterUsed.replace(",", "."));
  const canCalibrate =
    Number.isFinite(measuredValue) &&
    measuredValue >= 0 &&
    measuredValue <= 45 &&
    Number.isFinite(waterValue) &&
    waterValue >= -5 &&
    waterValue <= 60;

  const update = (patch: Partial<FdtSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveFdtSettings(next);
    setMessage(null);
  };

  const handleCalibrate = () => {
    if (!canCalibrate) {
      setMessage("Enter the water temperature you used and the dough temperature you measured.");
      return;
    }
    const next = calibrate(settings, measuredValue, waterValue, roomTemp);
    setSettings(next);
    saveFdtSettings(next);
    setMeasured("");
    setWaterUsed("");
    setMessage(
      `Saved. Your kitchen correction is now ${next.offsetC > 0 ? "+" : ""}${next.offsetC}°C across ${next.samples} sample${next.samples === 1 ? "" : "s"}.`,
    );
  };

  const handleReset = () => {
    const next = resetCalibration(settings);
    setSettings(next);
    saveFdtSettings(next);
    setMessage("Calibration cleared — back to the standard three-component estimate.");
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeading
                  eyebrow="05 — Dough temperature"
        title="Final dough temperature"
        description="Work backwards from the dough temperature you want. Calibrate once with a probe and the water suggestion learns your kitchen."
        icon={Thermometer}
        action={
          <Badge tone={settings.samples ? "lime" : "neutral"}>
            {settings.samples ? `${settings.samples} sample${settings.samples === 1 ? "" : "s"}` : "uncalibrated"}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-ember/20 bg-gradient-to-br from-ember/[0.1] to-transparent p-3.5">
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ember/80">
            <Droplets size={11} /> Mix water at
          </p>
          <p className="mt-1 font-display text-[34px] font-semibold leading-none text-cream">
            {fmtNumber(water, 1)}
            <span className="ml-1 font-mono text-[14px] text-cream/40">°C</span>
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-cream/40">
            Target dough {settings.targetFdt}°C · room {roomTemp}°C · flour {settings.flourTemp}°C ·
            friction {settings.friction}°C
          </p>
          <p className="mt-2 font-mono text-[9.5px] text-cream/30">
            Predicted mix ≈ {fmtNumber(predicted, 1)}°C
            {settings.offsetC !== 0 && (
              <span className="text-ember-2/80">
                {" "}
                · correction {settings.offsetC > 0 ? "+" : ""}
                {settings.offsetC}°C
              </span>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <SliderField
            label="Target dough temp"
            value={settings.targetFdt}
            onChange={(value) => update({ targetFdt: value })}
            min={18}
            max={30}
            step={0.5}
            suffix="°C"
            hint="24°C suits a 2–4 h bulk; go cooler for a long ferment."
          />
          <SliderField
            label="Flour temperature"
            value={settings.flourTemp}
            onChange={(value) => update({ flourTemp: value })}
            min={5}
            max={35}
            step={0.5}
            suffix="°C"
          />
          <SliderField
            label="Friction allowance"
            value={settings.friction}
            onChange={(value) => update({ friction: value })}
            min={0}
            max={8}
            step={0.5}
            suffix="°C"
            hint="Hand mix ≈ 2°C, stand mixer ≈ 3–5°C."
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-cream/70">Calibrate with a probe</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-cream/35">
              Mix a batch, probe the dough, and log it. The offset is applied to future water
              suggestions.
            </p>
          </div>
          {settings.updatedAt && (
            <span className="font-mono text-[9px] text-cream/25">
              updated {new Date(settings.updatedAt).toLocaleDateString("en-US")}
            </span>
          )}
        </div>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/35">
              Water used (°C)
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={waterUsed}
              onChange={(event) => {
                setWaterUsed(event.target.value);
                setMessage(null);
              }}
              placeholder={String(water)}
              aria-label="Water temperature used"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[12px] text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/35">
              Measured dough (°C)
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={measured}
              onChange={(event) => {
                setMeasured(event.target.value);
                setMessage(null);
              }}
              placeholder="24.5"
              aria-label="Measured dough temperature"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[12px] text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
            />
          </label>
          <button
            type="button"
            onClick={handleCalibrate}
            disabled={!canCalibrate}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-ember/30 bg-ember/12 px-3 py-2 text-[11.5px] font-medium text-ember-2 transition-colors hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} /> Save
          </button>
        </div>

        {message && (
          <p
            role="status"
            className={cx(
              "mt-2 text-[10.5px] leading-relaxed",
              message.startsWith("Saved") ? "text-lime/80" : "text-hot/80",
            )}
          >
            {message}
          </p>
        )}

        {(settings.samples ?? 0) > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cream/30 transition-colors hover:text-cream/60"
          >
            <RotateCcw size={10} /> Reset calibration
          </button>
        )}
      </div>
    </Card>
  );
}
