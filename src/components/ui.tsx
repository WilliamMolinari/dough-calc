import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Star, X, type LucideIcon } from "lucide-react";
import { clamp, round } from "../lib/format";
import { useDialogLayer } from "../hooks/useDialogLayer";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <As className={cx("glass rounded-[26px]", className)}>{children}</As>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-ember">
            <Icon size={17} strokeWidth={1.8} />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember/80">{eyebrow}</p>
          )}
          <h2 className="mt-0.5 text-[19px] font-semibold text-cream">{title}</h2>
          {description && <p className="mt-1 max-w-md text-[13px] leading-relaxed text-cream/45">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ember" | "lime" | "sky" | "hot";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-white/10 bg-white/[0.05] text-cream/65",
    ember: "border-ember/25 bg-ember/10 text-ember-2",
    lime: "border-lime/25 bg-lime/10 text-lime",
    sky: "border-sky/25 bg-sky/10 text-sky",
    hot: "border-hot/25 bg-hot/10 text-hot",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Numeric inputs                                                      */
/* ------------------------------------------------------------------ */

const inputBase =
  "rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-cream outline-none transition-colors placeholder:text-cream/25 focus:border-ember/60 focus:bg-black/35 disabled:opacity-50";

export function NumericInput({
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 1,
  suffix,
  ariaLabel,
  className,
  align = "right",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel: string;
  className?: string;
  align?: "left" | "right";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => String(round(value, 2)));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(round(value, 2)));
    }
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    if (parsed >= min && parsed <= max) onChange(parsed);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={draft}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
        onBlur={() => {
          const parsed = Number.parseFloat(draft.replace(",", "."));
          const safeValue = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
          setDraft(String(round(safeValue, 2)));
          if (safeValue !== value) onChange(safeValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") inputRef.current?.blur();
        }}
        className={cx(inputBase, align === "right" ? "text-right" : "text-left", "w-[5.25rem]", className)}
      />
      {suffix && <span className="font-mono text-[11px] text-cream/35">{suffix}</span>}
    </span>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  icon?: LucideIcon;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-cream/60">
        {Icon && <Icon size={13} className="text-cream/30" />}
        {label}
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <NumericInput
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          suffix={suffix}
          ariaLabel={label}
          className="w-full px-3 py-2 text-sm"
        />
      </span>
      {hint && <span className="mt-1 block font-mono text-[10px] text-cream/30">{hint}</span>}
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  format,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: ReactNode;
  format?: (value: number) => string;
  ariaLabel?: string;
}) {
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium text-cream/65">{label}</span>
        <span className="flex items-center gap-1.5">
          <NumericInput
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            suffix={suffix}
            ariaLabel={ariaLabel ?? label}
          />
          {format && <span className="min-w-[3.5rem] text-right font-mono text-[10px] text-cream/30">{format(value)}</span>}
        </span>
      </div>
      <input
        type="range"
        className="dl-range mt-1.5"
        aria-label={ariaLabel ?? label}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(event) => onChange(round(Number(event.target.value), 2))}
        style={
          {
            "--track": `linear-gradient(90deg, #ffb066 0%, #ff7a3d ${pct}%, rgba(255,255,255,0.10) ${pct}%)`,
          } as CSSProperties
        }
      />
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-cream/35">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const groupId = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        "inline-flex w-full gap-0.5 rounded-2xl border border-white/10 bg-black/25 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl font-medium transition-colors",
              size === "sm" ? "px-2 py-1.5 text-[11.5px]" : "px-2.5 py-2 text-[12.5px]",
              active ? "text-[#1b0b04]" : "text-cream/55 hover:text-cream/85",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-ember-2 via-ember to-hot shadow-[0_6px_18px_-8px_rgba(255,122,61,0.8)]"
              />
            )}
            <span className="relative flex items-center gap-1.5 whitespace-nowrap">
              {Icon && <Icon size={13} strokeWidth={2} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[12.5px] font-medium text-cream/70">{label}</p>
        {description && <p className="mt-0.5 font-mono text-[10px] text-cream/35">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-ember/50 bg-ember/30" : "border-white/12 bg-white/[0.06]",
        )}
      >
        <motion.span
          animate={{ x: checked ? 21 : 3 }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className={cx(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full",
            checked ? "bg-ember-2 shadow-[0_0_12px_rgba(255,176,102,0.7)]" : "bg-cream/45",
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */

export function Stars({
  value,
  onChange,
  size = 17,
  label = "Rating",
  className,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  label?: string;
  className?: string;
}) {
  if (onChange) {
    return (
      <div role="radiogroup" aria-label={label} className={cx("flex items-center gap-0.5", className)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} of 5`}
              onClick={() => onChange(n === value ? 0 : n)}
              className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={size}
                strokeWidth={1.6}
                className={filled ? "fill-ember text-ember drop-shadow-[0_0_6px_rgba(255,122,61,0.35)]" : "text-cream/25"}
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cx("flex items-center gap-0.5", className)} role="img" aria-label={`${label}: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.6}
          aria-hidden
          className={n <= value ? "fill-ember text-ember" : "text-cream/20"}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogLayer({ active: open, onClose, panelRef: dialogRef });

  if (!open) return null;

  const widths = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--dl-scrim)] backdrop-blur-md"
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? subtitleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cx(
              "glass no-print relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-white/12 sm:rounded-[28px]",
              widths[size],
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <h2 id={titleId} className="text-xl font-semibold text-cream">
                  {title}
                </h2>
                {subtitle && (
                  <p id={subtitleId} className="mt-1 text-[12.5px] text-cream/45">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-cream/60 transition-colors hover:border-white/20 hover:text-cream"
              >
                <X size={16} />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
            {footer && (
              <div className="border-t border-white/8 bg-black/25 px-5 py-3.5 sm:px-7">{footer}</div>
            )}
          </motion.div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function ActionButton({
  children,
  onClick,
  icon: Icon,
  variant = "ghost",
  className,
  type = "button",
  disabled,
  ariaLabel,
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "ghost" | "soft" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const variants: Record<string, string> = {
    primary: "btn-ember sheen font-semibold",
    ghost: "border border-white/10 bg-white/[0.035] text-cream/70 hover:border-white/20 hover:text-cream",
    soft: "bg-white/[0.06] text-cream/80 hover:bg-white/[0.1]",
    danger: "border border-hot/30 bg-hot/10 text-hot hover:bg-hot/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
    </button>
  );
}
