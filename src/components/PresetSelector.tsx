import { motion } from "framer-motion";
import { STYLES, type StylePreset } from "../lib/presets";
import { cx } from "./ui";

export function PresetSelector({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (preset: StylePreset) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/35">
          Start from a style
        </p>
        <p className="hidden font-mono text-[10px] text-cream/25 sm:block">
          every number stays editable
        </p>
      </div>
      <div className="no-scrollbar -mx-1 flex w-auto min-w-0 gap-2 overflow-x-auto px-1 pb-1">
        {STYLES.map((style) => {
          const active = style.id === activeId;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(style)}
              aria-pressed={active}
              className={cx(
                "group relative shrink-0 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-300",
                active
                  ? "border-white/20 bg-white/[0.075]"
                  : "border-white/[0.07] bg-white/[0.022] hover:border-white/15 hover:bg-white/[0.045]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="preset-active-ring"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-ember/45"
                />
              )}
              <span className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full transition-shadow"
                  style={{
                    background: style.accent,
                    boxShadow: active ? `0 0 10px ${style.accent}` : "none",
                  }}
                />
                <span className="whitespace-nowrap text-[12.5px] font-medium text-cream/85">
                  {style.name}
                </span>
              </span>
              <span className="mt-0.5 block whitespace-nowrap pl-3.5 font-mono text-[10px] text-cream/35">
                {style.short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
