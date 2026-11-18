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
import { fmtNumber, round } from "../lib/format";
import {
  convertTempText,
  fmtTemp,
  fmtTempDelta,
  fromTempDelta,
  fromTempValue,
  tempForInput,
  tempSuffix,
  toTempDelta,
  toTempValue,
} from "../lib/temperature";
import { useTempUnit } from "./TempUnit";
import { Badge, Card, SectionHeading, SliderField, cx } from "./ui";

export function FdtPlanner({ roomTemp }: { roomTemp: number }) {
  const tempUnit = useTempUnit();
  const [settings, setSettings] = useState<FdtSettings>(() => loadFdtSettings());
  const [measured, setMeasured] = useState("");
  const [waterUsed, setWaterUsed] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const water = estimateWaterTemp(settings, roomTemp);
  const predicted = estimateDoughTemp(water, roomTemp, settings);
  // The engine works in Celsius; the baker types and reads the chosen unit.
  const toC = (value: number) =>
    tempUnit === "f" ? round(fromTempValue(value, "f") * 2, 0) / 2 : value;
  const deltaValue = (celsius: number) => round(toTempDelta(celsius, tempUnit), 1);
  const display = (celsius: number) =>
    fmtNumber(toTempValue(celsius, tempUnit), tempUnit === "f" ? 0 : 1);
  const measuredInput = Number.parseFloat(measured.replace(",", "."));
  const waterInput = Number.parseFloat(waterUsed.replace(",", "."));
  const measuredValue = Number.isFinite(measuredInput) ? fromTempValue(measuredInput, tempUnit) : Number.NaN;
  const waterValue = Number.isFinite(waterInput) ? fromTempValue(waterInput, tempUnit) : Number.NaN;
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
      `Saved. Your kitchen correction is now ${next.offsetC > 0 ? "+" : ""}${fmtTempDelta(next.offsetC, tempUnit)} across ${next.samples} sample${next.samples === 1 ? "" : "s"}.`,
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
            {display(water)}
            <span className="ml-1 font-mono text-[14px] text-cream/40">{tempSuffix(tempUnit)}</span>
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-cream/40">
            Target dough {fmtTemp(settings.targetFdt, tempUnit)} · room {fmtTemp(roomTemp, tempUnit)} ·
            flour {fmtTemp(settings.flourTemp, tempUnit)} · friction{" "}
            {fmtTempDelta(settings.friction, tempUnit)}
          </p>
          <p className="mt-2 font-mono text-[9.5px] text-cream/30">
            Predicted mix ≈ {fmtTemp(predicted, tempUnit)}
            {settings.offsetC !== 0 && (
              <span className="text-ember-2/80">
                {" "}
                · correction {settings.offsetC > 0 ? "+" : ""}
                {fmtTempDelta(settings.offsetC, tempUnit)}
              </span>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <SliderField
            label="Target dough temp"
            value={tempForInput(settings.targetFdt, tempUnit)}
            onChange={(value) => update({ targetFdt: toC(value) })}
            min={tempForInput(18, tempUnit)}
            max={tempForInput(30, tempUnit)}
            step={tempUnit === "f" ? 1 : 0.5}
            suffix={tempSuffix(tempUnit)}
            hint={convertTempText(
              "24°C suits a 2–4 h bulk; go cooler for a long ferment.",
              tempUnit,
            )}
          />
          <SliderField
            label="Flour temperature"
            value={tempForInput(settings.flourTemp, tempUnit)}
            onChange={(value) => update({ flourTemp: toC(value) })}
            min={tempForInput(5, tempUnit)}
            max={tempForInput(35, tempUnit)}
            step={tempUnit === "f" ? 1 : 0.5}
            suffix={tempSuffix(tempUnit)}
          />
          <SliderField
            label="Friction allowance"
            value={deltaValue(settings.friction)}
            onChange={(value) =>
              update({
                friction:
                  tempUnit === "f" ? round(fromTempDelta(value, "f") * 2, 0) / 2 : value,
              })
            }
            min={0}
            max={deltaValue(8)}
            step={0.5}
            suffix={tempSuffix(tempUnit)}
            hint={`Hand mix ≈ ${fmtTempDelta(2, tempUnit)} · stand mixer ≈ ${fmtTempDelta(
              3,
              tempUnit,
            )}–${fmtTempDelta(5, tempUnit)}`}
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
              Water used ({tempSuffix(tempUnit)})
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={waterUsed}
              onChange={(event) => {
                setWaterUsed(event.target.value);
                setMessage(null);
              }}
              placeholder={String(display(water))}
              aria-label="Water temperature used"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[12px] text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/35">
              Measured dough ({tempSuffix(tempUnit)})
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={measured}
              onChange={(event) => {
                setMeasured(event.target.value);
                setMessage(null);
              }}
              placeholder={display(24.5)}
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
