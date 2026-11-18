import { useState } from "react";
import {
  Check,
  Database,
  HardDriveDownload,
  Palette,
  Scale,
  Thermometer,
  Trash2,
} from "lucide-react";
import { ActionButton, Badge, Card, SectionHeading, cx } from "./ui";
import type { ThemeMode } from "../lib/theme";
import type { TempUnit, Unit } from "../lib/types";

function Choice({
  active,
  title,
  note,
  onSelect,
}: {
  active: boolean;
  title: string;
  note: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cx(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-ember/40 bg-ember/10" : "border-white/8 bg-white/[0.02] hover:border-white/16",
      )}
    >
      <span
        className={cx(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
          active ? "border-ember bg-ember text-ink" : "border-white/25 text-transparent",
        )}
      >
        <Check size={10} strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-cream/85">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-cream/40">{note}</span>
      </span>
    </button>
  );
}

/**
 * Preferences and the one destructive action, all in one place. The recipe
 * itself stays in the calculator — nothing here changes the dough.
 */
export function SettingsPanel({
  theme,
  onThemeChange,
  unit,
  onUnitChange,
  tempUnit,
  onTempChange,
  bakeCount,
  photoCount,
  onOpenBackup,
  onClearAll,
}: {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  tempUnit: TempUnit;
  onTempChange: (unit: TempUnit) => void;
  bakeCount: number;
  photoCount: number;
  onOpenBackup: () => void;
  onClearAll: () => void | Promise<void>;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const bakeWord = bakeCount === 1 ? "bake" : "bakes";
  const photoWord = photoCount === 1 ? "photo" : "photos";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="p-4 sm:p-5 lg:col-span-2">
        <SectionHeading
          eyebrow="01 — Appearance"
          title="Theme"
          description="Dark for a dim kitchen, light for daylight. The dough maths is the same either way."
          icon={Palette}
          action={<Badge tone="neutral">{theme}</Badge>}
        />
        <div role="group" aria-label="Theme" className="grid gap-2 sm:grid-cols-2">
          <Choice
            active={theme === "dark"}
            title="Dark"
            note="Ember accents on near-black glass — the app's late-night look."
            onSelect={() => onThemeChange("dark")}
          />
          <Choice
            active={theme === "light"}
            title="Light"
            note="Warm paper surfaces with dark ink, for a bright kitchen."
            onSelect={() => onThemeChange("light")}
          />
        </div>
        <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-cream/25">
          Applies to the whole app and is remembered on this device.
        </p>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="02 — Units"
          title="Weights"
          description="Recipe amounts, journal cards, backups and exports all follow this."
          icon={Scale}
          action={<Badge tone="neutral">{unit === "g" ? "grams" : "ounces"}</Badge>}
        />
        <div role="group" aria-label="Weight unit" className="grid gap-2 sm:grid-cols-2">
          <Choice
            active={unit === "g"}
            title="Grams"
            note="Fine enough for a fraction of a gram of yeast."
            onSelect={() => onUnitChange("g")}
          />
          <Choice
            active={unit === "oz"}
            title="Ounces"
            note="Decimal ounces, for scales that only speak imperial."
            onSelect={() => onUnitChange("oz")}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="03 — Temperature"
          title="Oven dials"
          description="Timelines, oven profiles and the journal's temperature fields use this reading."
          icon={Thermometer}
          action={<Badge tone="neutral">{tempUnit === "c" ? "celsius" : "fahrenheit"}</Badge>}
        />
        <div role="group" aria-label="Temperature unit" className="grid gap-2 sm:grid-cols-2">
          <Choice
            active={tempUnit === "c"}
            title="Celsius"
            note="°C, the scale the engine works in."
            onSelect={() => onTempChange("c")}
          />
          <Choice
            active={tempUnit === "f"}
            title="Fahrenheit"
            note="°F, converted everywhere it is shown."
            onSelect={() => onTempChange("f")}
          />
        </div>
        <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-cream/25">
          The recipe never changes — only how it is read.
        </p>
      </Card>

      <Card className="p-4 sm:p-5 lg:col-span-2">
        <SectionHeading
          eyebrow="04 — Data"
          title="This browser"
          description="The journal lives here, not on a server. Take a copy before you clear anything."
          icon={Database}
          action={
            <Badge tone="neutral">
              {bakeCount} {bakeWord}
            </Badge>
          }
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="glass-inset rounded-xl px-3 py-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">Bakes</p>
            <p className="mt-0.5 font-mono text-[14px] text-cream/85">{bakeCount}</p>
          </div>
          <div className="glass-inset rounded-xl px-3 py-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">Photos</p>
            <p className="mt-0.5 font-mono text-[14px] text-cream/85">{photoCount}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton onClick={onOpenBackup} icon={HardDriveDownload}>
            Backup &amp; restore
          </ActionButton>
          <span className="font-mono text-[9.5px] leading-relaxed text-cream/30">
            Export a JSON file, restore points, import a copy.
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-hot/25 bg-hot/[0.05] p-3.5">
          <p className="text-[13px] font-medium text-cream/80">Clear all data</p>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-cream/40">
            Deletes every bake and photo ({bakeCount} {bakeWord}, {photoCount} {photoWord}), all
            restore points, the current formula, units, timers, the dinner plan and the saved Gemini
            key from this browser. Export a backup first if you want to keep any of it.
          </p>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2 text-[12px] text-hot transition-colors hover:bg-hot/20"
            >
              <Trash2 size={13} /> Clear all data
            </button>
          ) : (
            <div className="mt-2.5 rounded-xl border border-hot/30 bg-hot/[0.08] p-2.5">
              <p className="text-[11px] leading-relaxed text-hot/90">
                This cannot be undone.{" "}
                {bakeCount
                  ? `All ${bakeCount} ${bakeWord} will be gone.`
                  : "The app will start again from a fresh install."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => {
                    setClearing(true);
                    void Promise.resolve(onClearAll()).finally(() => {
                      setClearing(false);
                      setConfirmClear(false);
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hot/40 bg-hot/20 px-2.5 py-1.5 text-[11.5px] font-semibold text-hot transition-colors hover:bg-hot/30 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {clearing ? "Clearing…" : "Yes, delete everything"}
                </button>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-cream/65 transition-colors hover:text-cream disabled:opacity-50"
                >
                  Keep my data
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-center font-mono text-[9px] text-cream/20">
          Preferences stay on this device. The dough variables live in the calculator.
        </p>
      </Card>
    </div>
  );
}
