import { Flame, Thermometer, Timer } from "lucide-react";
import { OVEN_PROFILES, getOvenProfile } from "../lib/ovens";
import { convertTempText, fmtTemp } from "../lib/temperature";
import { useTempUnit } from "./TempUnit";
import { cx } from "./ui";

export function OvenProfilePicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const oven = getOvenProfile(value);
  const tempUnit = useTempUnit();

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {OVEN_PROFILES.map((profile) => {
          const active = profile.id === oven.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onChange(profile.id)}
              aria-pressed={active}
              className={cx(
                "shrink-0 rounded-xl border px-2.5 py-1.5 text-left transition-colors",
                active
                  ? "border-ember/40 bg-ember/12 text-cream"
                  : "border-white/8 bg-white/[0.025] text-cream/45 hover:border-white/18 hover:text-cream/80",
              )}
            >
              <span className="block whitespace-nowrap text-[11.5px] font-medium">{profile.name}</span>
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.08em] text-cream/30">
                {convertTempText(profile.short, tempUnit)}
              </span>
            </button>
          );
        })}
      </div>

      <div className={cx("mt-2 grid grid-cols-3 gap-2", compact && "mt-1.5")}>
        {[
          { label: "Deck", value: fmtTemp(oven.tempC, tempUnit), icon: Thermometer },
          { label: "Preheat", value: `${oven.preheatMin} min`, icon: Timer },
          {
            label: "Bake",
            value: oven.bakeMin < 2 ? `${Math.round(oven.bakeMin * 60)} s` : `${oven.bakeMin} min`,
            icon: Flame,
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-inset rounded-xl px-2 py-1.5">
            <p className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-cream/30">
              <stat.icon size={9} /> {stat.label}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-cream/80">{stat.value}</p>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-cream/35">
          {convertTempText(oven.note, tempUnit)}
        </p>
      )}
    </div>
  );
}
