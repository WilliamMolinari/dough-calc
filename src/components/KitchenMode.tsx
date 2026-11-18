import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarPlus,
  Check,
  ChefHat,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { buildSchedule } from "../lib/calc";
import { downloadScheduleIcs } from "../lib/exports";
import { fmtClock, fmtDay } from "../lib/format";
import { STORAGE_KEYS, readStored, writeStored } from "../lib/storage";
import { MAX_TIMER_MINUTES, clampTimerMinutes, formatCountdown, minutesUntil } from "../lib/timer";
import type { Formula } from "../lib/types";
import { useDialogLayer } from "../hooks/useDialogLayer";
import { cx } from "./ui";

function relative(target: Date, now: Date): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(minutes);
  const label =
    abs < 60
      ? `${abs} min`
      : abs < 1440
        ? `${Math.floor(abs / 60)} h ${abs % 60 ? `${abs % 60} min` : ""}`.trim()
        : `${Math.round(abs / 1440)} d`;
  return minutes >= 0 ? `in ${label}` : `${label} ago`;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}

interface StepTimer {
  id: string;
  label: string;
  totalMs: number;
  /** Null while paused. */
  endsAt: number | null;
  remainingMs: number;
}

function newTimerId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timerRemaining(timer: StepTimer, now: number): number {
  return timer.endsAt ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
}

export function KitchenMode({
  onClose,
  formula,
  title,
  startAt,
}: {
  onClose: () => void;
  formula: Formula;
  title: string;
  startAt?: number;
}) {
  const steps = useMemo(
    () => buildSchedule(formula, startAt ? new Date(startAt) : undefined),
    [formula, startAt],
  );
  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Date();
    return new Set(steps.filter((step) => step.at < initial).map((step) => step.key));
  });
  const [now, setNow] = useState(() => new Date());
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [timers, setTimers] = useState<StepTimer[]>([]);
  const [timerRestored, setTimerRestored] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("10");
  const [alarm, setAlarm] = useState<{ title: string; detail: string } | null>(null);
  const [notifyState, setNotifyState] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const warnedStep = useRef<string | null>(null);

  // Timers keep running while the baker checks the journal or reloads. Older
  // saved versions held a single timer, so accept both shapes.
  useEffect(() => {
    const saved = readStored<StepTimer | StepTimer[] | null>(STORAGE_KEYS.kitchenTimer, []);
    const list = Array.isArray(saved) ? saved : saved ? [saved] : [];
    const now = Date.now();
    const live: StepTimer[] = [];
    const missed: StepTimer[] = [];

    for (const item of list) {
      if (!item || typeof item.label !== "string") continue;
      const timer: StepTimer = { ...item, id: item.id || newTimerId() };
      if (timer.endsAt && timer.endsAt <= now) missed.push(timer);
      else if (timer.endsAt || timer.remainingMs > 0) live.push(timer);
    }

    if (live.length) setTimers(live);
    if (missed.length) {
      setAlarm({
        title: "Timer finished",
        detail:
          missed.length === 1
            ? `${missed[0].label} · finished while you were away`
            : `${missed.length} timers finished while you were away`,
      });
    }
    setTimerRestored(true);
  }, []);

  useEffect(() => {
    if (!timerRestored) return;
    writeStored(STORAGE_KEYS.kitchenTimer, timers);
  }, [timers, timerRestored]);

  useDialogLayer({
    active: true,
    onClose,
    panelRef,
    initialFocusRef: closeRef,
    initialFocusDelay: 80,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: string) => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLock) return;

    wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        lock = sentinel;
      })
      .catch(() => {
        /* wake lock is optional */
      });

    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const next = steps.find((step) => !checked.has(step.key)) ?? null;
  const done = checked.size;
  const progress = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const byUrgency = [...timers].sort((a, b) => {
    const aAt = a.endsAt ?? Number.POSITIVE_INFINITY;
    const bAt = b.endsAt ?? Number.POSITIVE_INFINITY;
    return aAt - bAt || a.remainingMs - b.remainingMs;
  });
  const timer = byUrgency[0] ?? null;
  const otherTimers = byUrgency.slice(1);
  const remainingMs = timer ? timerRemaining(timer, tickNow) : 0;

  const armAudio = () => {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume().catch(() => undefined);
    } catch {
      /* Audio is optional. */
    }
  };

  const playAlarm = () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.02;
    [0, 0.24, 0.48].forEach((offset, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 2 ? 1046 : 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.2);
    });
  };

  const sendNotification = (title: string, detail: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body: detail, tag: "doughlab-kitchen" });
    } catch {
      /* Notifications are optional. */
    }
  };

  const fireAlarm = (title: string, detail: string) => {
    setAlarm({ title, detail });
    playAlarm();
    sendNotification(title, detail);
  };

  const startTimer = (minutes: number, label: string) => {
    const totalMs = clampTimerMinutes(minutes) * 60_000;
    armAudio();
    setAlarm(null);
    setTickNow(Date.now());
    setTimers((prev) => [
      ...prev,
      { id: newTimerId(), label, totalMs, endsAt: Date.now() + totalMs, remainingMs: totalMs },
    ]);
  };

  const pauseTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((item) =>
        item.id === id && item.endsAt
          ? { ...item, remainingMs: Math.max(0, item.endsAt - Date.now()), endsAt: null }
          : item,
      ),
    );
  };

  const resumeTimer = (id: string) => {
    setTickNow(Date.now());
    setTimers((prev) =>
      prev.map((item) =>
        item.id === id && !item.endsAt && item.remainingMs > 0
          ? { ...item, endsAt: Date.now() + item.remainingMs }
          : item,
      ),
    );
  };

  const clearTimer = (id: string) => {
    setTimers((prev) => prev.filter((item) => item.id !== id));
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    armAudio();
    try {
      setNotifyState(await Notification.requestPermission());
    } catch {
      /* Some browsers refuse the prompt; the on-screen alarm still works. */
    }
  };

  // Tick quickly only while at least one timer is running.
  const anyRunning = timers.some((item) => item.endsAt !== null);
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setTickNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // Remove and announce every timer that has reached zero.
  useEffect(() => {
    const due = timers.filter((item) => item.endsAt !== null && tickNow >= item.endsAt);
    if (!due.length) return;
    const dueIds = new Set(due.map((item) => item.id));
    setTimers((prev) => prev.filter((item) => !dueIds.has(item.id)));
    fireAlarm(
      "Timer finished",
      due.length === 1 ? due[0].label : `${due.length} timers finished`,
    );
  }, [timers, tickNow]);

  // Wake the clock exactly when the next step is due, even between 30 s ticks.
  useEffect(() => {
    if (!next) return;
    const delay = next.at.getTime() - Date.now();
    if (delay <= 0) return;
    const id = window.setTimeout(() => setNow(new Date()), delay + 250);
    return () => window.clearTimeout(id);
  }, [next]);

  // Alarm once when a step's scheduled time arrives. The window stops old,
  // already-passed steps from firing when the baker resets the checklist.
  useEffect(() => {
    if (!next || warnedStep.current === next.key) return;
    const overdueMs = now.getTime() - next.at.getTime();
    if (overdueMs < 0 || overdueMs > 5 * 60_000) return;
    warnedStep.current = next.key;
    fireAlarm(`${next.label} is ready`, `${fmtClock(next.at)} · ${next.detail}`);
  }, [next, now]);

  // The first tap unlocks audio so a later alarm can actually be heard.
  useEffect(() => {
    const unlock = () => armAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toggle = (key: string) => {
    setChecked((prev) => {
      const copy = new Set(prev);
      if (copy.has(key)) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Kitchen mode for ${title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-[#07070a]"
    >
      <div className="border-b border-white/10 bg-gradient-to-r from-ember/[0.12] via-transparent to-hot/[0.08] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ember-2 via-ember to-hot text-[#1c0b05]">
            <ChefHat size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ember/80">
              Kitchen mode
            </p>
            <h2 className="truncate text-[17px] font-semibold text-cream">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => downloadScheduleIcs(formula, title, startAt ? new Date(startAt) : undefined)}
            aria-label="Add the schedule to your calendar"
            title="Download a calendar file with an alarm before every step"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-cream/45 transition-colors hover:text-cream"
          >
            <CalendarPlus size={16} />
          </button>
          {notifyState !== "unsupported" && (
            <button
              type="button"
              onClick={() => void enableNotifications()}
              aria-pressed={notifyState === "granted"}
              aria-label={
                notifyState === "granted" ? "Browser alarms are on" : "Enable browser alarms"
              }
              title={
                notifyState === "granted"
                  ? "Browser alarms are on"
                  : "Allow browser notifications when a timer or step is ready"
              }
              className={cx(
                "grid size-10 shrink-0 place-items-center rounded-full border transition-colors",
                notifyState === "granted"
                  ? "border-lime/30 bg-lime/10 text-lime"
                  : "border-white/12 bg-white/[0.05] text-cream/45 hover:text-cream",
              )}
            >
              {notifyState === "granted" ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close kitchen mode"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-cream/70 transition-colors hover:text-cream"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto mt-2.5 flex max-w-3xl items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember-2 to-hot transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[9.5px] text-cream/40">
            {done}/{steps.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-3xl border border-ember/25 bg-gradient-to-br from-ember/[0.14] to-transparent p-4 sm:p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ember/80">
              {next ? "Next up" : "All steps checked"}
            </p>
            {next ? (
              <>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[26px] font-semibold leading-tight text-cream sm:text-[32px]">
                    {next.label}
                  </h3>
                  <span className="font-mono text-[13px] text-ember-2">
                    {fmtClock(next.at)} · {relative(next.at, now)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-cream/55">{next.detail}</p>
                <button
                  type="button"
                  onClick={() => toggle(next.key)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-ember-2 via-ember to-hot px-4 py-2.5 text-[13px] font-semibold text-[#1c0b05]"
                >
                  <Check size={15} /> Mark done
                </button>
              </>
            ) : (
              <p className="mt-1 text-[20px] font-semibold text-cream">
                Dough is ready. Go make pizza.
              </p>
            )}
          </div>

          {alarm && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-hot/35 bg-hot/[0.12] p-3.5"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-hot/15 text-hot">
                <BellRing size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-cream">{alarm.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-cream/55">
                  {alarm.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlarm(null)}
                aria-label="Dismiss alarm"
                className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 text-cream/50 transition-colors hover:text-cream"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-cream/35">
                  <Timer size={11} /> Kitchen timer
                </p>
                <p
                  role="timer"
                  aria-label={timer ? `${timer.label}, ${formatCountdown(remainingMs)} remaining` : "No timer running"}
                  className={cx(
                    "mt-1 font-mono text-[34px] leading-none tabular-nums sm:text-[40px]",
                    timer ? "text-cream" : "text-cream/20",
                  )}
                >
                  {timer ? formatCountdown(remainingMs) : "--:--"}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-cream/40">
                  {timer
                    ? timer.label
                    : "Set a timer for the next step or whatever is in the oven."}
                </p>
                {timer && (
                  <div className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-2 to-hot transition-[width] duration-500"
                      style={{
                        width: `${
                          timer.totalMs
                            ? Math.max(0, Math.min(100, (remainingMs / timer.totalMs) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {timer && (
                  <>
                    <button
                      type="button"
                      onClick={() => (timer.endsAt ? pauseTimer(timer.id) : resumeTimer(timer.id))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-[12px] text-cream/75 transition-colors hover:text-cream"
                    >
                      {timer.endsAt ? <Pause size={13} /> : <Play size={13} />}
                      {timer.endsAt ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearTimer(timer.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-cream/50 transition-colors hover:text-cream/80"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {[1, 5, 10, 30].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => startTimer(minutes, `${minutes} min timer`)}
                    aria-label={`Add a ${minutes} minute timer`}
                    className="rounded-xl border border-white/12 bg-white/[0.05] px-2.5 py-2 font-mono text-[11px] text-cream/70 transition-colors hover:border-ember/40 hover:text-ember-2"
                  >
                    {timer ? `+${minutes}m` : `${minutes}m`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-3">
                <button
                  type="button"
                  onClick={() => next && startTimer(minutesUntil(next.at), `Next: ${next.label}`)}
                  disabled={!next}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ember/25 bg-ember/10 px-3 py-2 text-[11.5px] text-ember-2 transition-colors hover:bg-ember/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Timer size={12} /> Timer to next step
                </button>
                <label className="ml-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/30">
                    Custom
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_TIMER_MINUTES}
                    value={customMinutes}
                    onChange={(event) => setCustomMinutes(event.target.value)}
                    aria-label="Custom timer minutes"
                    className="w-14 bg-transparent text-right font-mono text-[12px] text-cream outline-none"
                  />
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/30">
                    min
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => startTimer(Number(customMinutes), "Custom timer")}
                  className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-[11.5px] text-cream/70 transition-colors hover:text-cream"
                >
                  Start
                </button>
              </div>

            {otherTimers.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-cream/25">
                  Also running
                </p>
                {otherTimers.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-cream/65">
                      {item.label}
                    </span>
                    <span className="font-mono text-[13px] tabular-nums text-cream/85">
                      {formatCountdown(timerRemaining(item, tickNow))}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          item.endsAt ? pauseTimer(item.id) : resumeTimer(item.id)
                        }
                        aria-label={item.endsAt ? `Pause ${item.label}` : `Resume ${item.label}`}
                        className="grid size-7 place-items-center rounded-lg border border-white/10 text-cream/50 transition-colors hover:text-cream"
                      >
                        {item.endsAt ? <Pause size={11} /> : <Play size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearTimer(item.id)}
                        aria-label={`Cancel ${item.label}`}
                        className="grid size-7 place-items-center rounded-lg border border-white/10 text-cream/40 transition-colors hover:text-cream"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ol className="space-y-2">
            {steps.map((step) => {
              const isChecked = checked.has(step.key);
              const isNext = next?.key === step.key;
              return (
                <li key={step.key}>
                  <button
                    type="button"
                    onClick={() => toggle(step.key)}
                    aria-pressed={isChecked}
                    className={cx(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors sm:p-4",
                      isChecked
                        ? "border-lime/20 bg-lime/[0.05]"
                        : isNext
                          ? "border-ember/30 bg-ember/[0.06]"
                          : "border-white/8 bg-white/[0.025] hover:border-white/16",
                    )}
                  >
                    <span
                      className={cx(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border",
                        isChecked
                          ? "border-lime/40 bg-lime/15 text-lime"
                          : "border-white/15 bg-black/25 text-cream/30",
                      )}
                    >
                      {isChecked ? <Check size={14} /> : <Clock3 size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span
                          className={cx(
                            "text-[15px] font-medium",
                            isChecked ? "text-cream/45 line-through" : "text-cream/90",
                          )}
                        >
                          {step.label}
                        </span>
                        <span className="font-mono text-[11px] text-cream/45">
                          {fmtClock(step.at)}
                          {step.at.toDateString() !== steps[0]?.at.toDateString() && (
                            <span className="text-cream/25"> · {fmtDay(step.at)}</span>
                          )}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-cream/40">
                        {step.detail}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="mx-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cream/40 transition-colors hover:text-cream/70"
          >
            <RotateCcw size={11} /> Reset checks
          </button>
        </div>
      </div>
    </div>
  );
}
