import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookmarkPlus,
  CalendarClock,
  Calculator,
  CheckCircle2,
  Clock3,
  Flame,
  Info,
  NotebookPen,
  Pizza,
  Scale,
  Settings2,
  Sparkles,
  Star,
  Thermometer,
  Wheat,
} from "lucide-react";
import { bakeReadyAt, calculateDough, yeastForType } from "./lib/calc";
import { fmtClock, fmtDay, fmtWeight, round } from "./lib/format";
import { getOvenProfile } from "./lib/ovens";
import { convertTempText, fmtTemp } from "./lib/temperature";
import { DEFAULT_FORMULA, getStyle, type StylePreset } from "./lib/presets";
import { clearAllData } from "./lib/reset";
import { readShareFromLocation } from "./lib/share";
import {
  STORAGE_BUDGET_BYTES,
  STORAGE_KEYS,
  estimateStorage,
  loadBakes,
  loadFormula,
  loadLastBackup,
  loadTempUnit,
  loadTheme,
  loadUnit,
  measureStoredBytes,
  readStored,
  writeStored,
} from "./lib/storage";
import {
  journalDbSupported,
  listSnapshots,
  loadSnapshot,
  type SnapshotMeta,
} from "./lib/journalDb";
import { hydrateJournal, maybeSnapshot, persistJournal, takeSnapshot } from "./lib/journalStore";
import { materializePhotos } from "./lib/photoFiles";
import { deleteBakeEntry, duplicateBakeEntry, nextTrialName, rootIdOf } from "./lib/journal";
import { adjustFormula, trialChangeLabel, type TrialVariable } from "./lib/experiments";
import { normalizeOutcomeTags } from "./lib/outcomes";
import { applyTheme, type ThemeMode } from "./lib/theme";
import {
  readPersistence,
  requestPersistence,
  type PersistenceState,
} from "./lib/storageHealth";
import type {
  BakeEntry,
  Formula,
  TempUnit,
  Toast,
  ToastAction,
  Unit,
  VisionRead,
} from "./lib/types";
import { CalculatorForm } from "./components/CalculatorForm";
import { TempUnitProvider, useTempUnit } from "./components/TempUnit";
import { PresetSelector } from "./components/PresetSelector";
import { RecipeOutput } from "./components/RecipeOutput";
import { Journal } from "./components/Journal";
import { SaveBakeModal, type BakeDraft } from "./components/SaveBakeModal";
import { BakeDetail } from "./components/BakeDetail";
import { TrialDesignerModal } from "./components/TrialDesignerModal";
import { RecipeCardModal } from "./components/RecipeCardModal";
import { BakeChatbot } from "./components/BakeChatbot";
import { FdtPlanner } from "./components/FdtPlanner";
import { DinnerPlanner } from "./components/DinnerPlanner";
import { StarterPlanner } from "./components/StarterPlanner";
import { FirstRun } from "./components/FirstRun";
import { BackupModal } from "./components/BackupModal";
import { KitchenMode } from "./components/KitchenMode";
import { SettingsPanel } from "./components/SettingsPanel";
import { Badge, Card, cx } from "./components/ui";

type Tab = "calculator" | "journal" | "plan" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: typeof Calculator }> = [
  { id: "calculator", label: "Calculator", icon: Calculator },
  { id: "journal", label: "Journal", icon: NotebookPen },
  { id: "plan", label: "Plan", icon: CalendarClock },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function newBakeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bake-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Stable, collision-free keys for toasts and their dismiss timers. */
let toastSeq = 0;

function Logo() {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-gradient-to-br from-ember/25 via-ember/10 to-hot/10">
      <Pizza size={17} className="text-ember" strokeWidth={1.7} />
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
    </span>
  );
}

function HeroStat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Scale;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-cream/30">
        <Icon size={10} />
        {label}
      </div>
      <p className="mt-1 truncate font-display text-[17px] font-semibold leading-none text-cream">
        {value}
      </p>
      {sub && <p className="mt-1 truncate font-mono text-[9px] text-cream/30">{sub}</p>}
    </div>
  );
}

function Hero({
  tab,
  formula,
  unit,
  totalDough,
  bakes,
}: {
  tab: Tab;
  formula: Formula;
  unit: Unit;
  totalDough: number;
  bakes: BakeEntry[];
}) {
  const tempUnit = useTempUnit();
  const style = getStyle(formula.styleId);
  const oven = getOvenProfile(formula.ovenProfile);
  const ready = bakeReadyAt(formula);
  const avg = bakes.filter((bake) => bake.ratings.overall > 0);
  const avgRating = avg.length
    ? round(avg.reduce((sum, bake) => sum + bake.ratings.overall, 0) / avg.length, 1)
    : 0;
  const photos = bakes.reduce((sum, bake) => sum + (bake.photos?.length ?? 0), 0);

  return (
    <section className="relative overflow-hidden border-b border-white/[0.055]">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-80" />
      <div
        aria-hidden
        className="drift pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-ember/[0.07] blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-7 sm:px-6 sm:pb-9 sm:pt-11">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ember">
                <Sparkles size={10} />
                {tab === "calculator"
                  ? "Dough engine"
                  : tab === "journal"
                    ? "Bake journal"
                    : tab === "plan"
                      ? "Dinner plan"
                      : "Settings"}
              </Badge>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-cream/25">
                {tab === "calculator"
                  ? "baker's percentages · live"
                  : tab === "journal"
                    ? "ratings · photos · notes"
                    : tab === "plan"
                      ? "serve time · oven throughput"
                      : "units · temperature · data"}
              </span>
            </div>

            {tab === "calculator" ? (
              <h1 className="mt-3.5 text-[34px] font-semibold leading-[0.98] tracking-[-0.03em] text-cream sm:text-[52px]">
                Precision dough,
                <br />
                <span className="text-gradient font-serif text-[39px] font-normal italic leading-[1.05] tracking-[-0.01em] sm:text-[58px]">
                  without the guesswork.
                </span>
              </h1>
            ) : tab === "journal" ? (
              <h1 className="mt-3.5 text-[34px] font-semibold leading-[0.98] tracking-[-0.03em] text-cream sm:text-[52px]">
                Every bake,
                <br />
                <span className="text-gradient font-serif text-[39px] font-normal italic leading-[1.05] tracking-[-0.01em] sm:text-[58px]">
                  remembered.
                </span>
              </h1>
            ) : tab === "plan" ? (
              <h1 className="mt-3.5 text-[34px] font-semibold leading-[0.98] tracking-[-0.03em] text-cream sm:text-[52px]">
                Dinner,
                <br />
                <span className="text-gradient font-serif text-[39px] font-normal italic leading-[1.05] tracking-[-0.01em] sm:text-[58px]">
                  on time.
                </span>
              </h1>
            ) : (
              <h1 className="mt-3.5 text-[34px] font-semibold leading-[0.98] tracking-[-0.03em] text-cream sm:text-[52px]">
                Your kitchen,
                <br />
                <span className="text-gradient font-serif text-[39px] font-normal italic leading-[1.05] tracking-[-0.01em] sm:text-[58px]">
                  your numbers.
                </span>
              </h1>
            )}

            <p className="mt-3 max-w-lg text-[12.5px] leading-relaxed text-cream/45 sm:text-[13.5px]">
              {tab === "calculator"
                ? `Hydration, leaven, temperature and time — recalculated the moment you move a slider. Currently tuned for ${style.name}.`
                : tab === "journal"
                  ? "Rate the crust, log the crumb, keep the photos. Your next batch starts from what actually worked."
                  : tab === "plan"
                    ? "Start from the table and work backwards. One oven, every pizza timed, nothing launched cold."
                    : "Grams or ounces, Celsius or Fahrenheit, and every bake stored on this device. The dough itself stays in the calculator."}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 lg:w-[360px]">
            {tab === "calculator" ? (
              <>
                <HeroStat
                  label="Batch"
                  value={fmtWeight(totalDough, unit)}
                  sub={
                    formula.sizing === "pan"
                      ? `${formula.ballCount} × ${formula.panLength}×${formula.panWidth} cm pan`
                      : `${formula.ballCount} balls`
                  }
                  icon={Scale}
                />
                <HeroStat
                  label="Hydration"
                  value={`${formula.hydration}%`}
                  sub={`${formula.salt}% salt`}
                  icon={Wheat}
                />
                <HeroStat
                  label="Bake at"
                  value={fmtClock(ready)}
                  sub={fmtDay(ready)}
                  icon={Clock3}
                />
              </>
            ) : tab === "journal" ? (
              <>
                <HeroStat label="Bakes" value={String(bakes.length)} sub="logged" icon={Pizza} />
                <HeroStat
                  label="Avg overall"
                  value={avgRating ? `${avgRating}` : "—"}
                  sub={avgRating ? "out of 5" : "rate a bake"}
                  icon={Star}
                />
                <HeroStat label="Photos" value={String(photos)} sub="on device" icon={Sparkles} />
              </>
            ) : tab === "plan" ? (
              <>
                <HeroStat
                  label="Oven"
                  value={oven.name}
                  sub={convertTempText(oven.short, tempUnit)}
                  icon={Flame}
                />
                <HeroStat
                  label="Deck"
                  value={fmtTemp(oven.tempC, tempUnit)}
                  sub={`${oven.preheatMin} min preheat`}
                  icon={Thermometer}
                />
                <HeroStat
                  label="Bake"
                  value={oven.bakeMin < 2 ? `${Math.round(oven.bakeMin * 60)} s` : `${oven.bakeMin} min`}
                  sub="per pie"
                  icon={Clock3}
                />
              </>
            ) : (
              <>
                <HeroStat
                  label="Weights"
                  value={unit === "g" ? "g" : "oz"}
                  sub={unit === "g" ? "grams" : "ounces"}
                  icon={Scale}
                />
                <HeroStat
                  label="Oven dials"
                  value={tempUnit === "c" ? "°C" : "°F"}
                  sub={tempUnit === "c" ? "celsius" : "fahrenheit"}
                  icon={Thermometer}
                />
                <HeroStat label="Bakes" value={String(bakes.length)} sub="saved here" icon={Pizza} />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const tones = { success: "text-lime", error: "text-hot", info: "text-sky" };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-40 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-24 md:items-end md:pr-6">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              role="status"
              className="glass pointer-events-auto flex max-w-sm items-start gap-2 rounded-2xl px-3.5 py-2.5"
            >
              <Icon size={14} className={cx("mt-0.5 shrink-0", tones[toast.tone])} />
              <p className="text-[12px] leading-relaxed text-cream/80">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.run();
                    onDismiss(toast.id);
                  }}
                  className="shrink-0 rounded-lg border border-ember/30 bg-ember/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ember-2 transition-colors hover:bg-ember/20"
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function MobileTab({
  tab,
  active,
  onChange,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onChange: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onChange}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
        active ? "text-ember" : "text-cream/35",
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      {tab.label}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("calculator");
  const [formula, setFormula] = useState<Formula>(() => loadFormula());
  const [unit, setUnit] = useState<Unit>(() => loadUnit());
  const [tempUnit, setTempUnit] = useState<TempUnit>(() => loadTempUnit());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [persistence, setPersistence] = useState<PersistenceState>("best-effort");
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => loadLastBackup());
  const [bakes, setBakes] = useState<BakeEntry[]>(() => loadBakes());
  const [storageInfo, setStorageInfo] = useState(() => ({
    bytes: measureStoredBytes(),
    budget: STORAGE_BUDGET_BYTES,
  }));
  const [journalReady, setJournalReady] = useState(false);
  const [journalDb, setJournalDb] = useState(() => journalDbSupported());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [activeBakeId, setActiveBakeId] = useState<string | null>(null);
  const [editingBakeId, setEditingBakeId] = useState<string | null>(null);
  const [designBakeId, setDesignBakeId] = useState<string | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [onboarded, setOnboarded] = useState(() => readStored<unknown>(STORAGE_KEYS.onboarded, false) === true);
  const nudgedBackup = useRef(false);
  const journalWrites = useRef<Promise<void>>(Promise.resolve());
  const journalWriteError = useRef(false);
  const quotaWarned = useRef(false);
  const lastPersistedCount = useRef(0);
  // Hydration writes the journal back unchanged; that is not a restore point.
  const skipNextSnapshot = useRef(true);
  // Set while "Clear all data" runs, so a queued write cannot put the old
  // journal back after the wipe.
  const wiping = useRef(false);
  // Set by "Bake this again": the next saved bake becomes a trial of that bake.
  const [pendingTrialFrom, setPendingTrialFrom] = useState<string | null>(null);
  const [kitchen, setKitchen] = useState<{
    formula: Formula;
    title: string;
    startAt?: number;
  } | null>(null);

  const closeKitchen = useCallback(() => setKitchen(null), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: Toast["tone"] = "info", action?: ToastAction) => {
      toastSeq += 1;
      const id = toastSeq;
      setToasts((prev) => {
        const next = [...prev, { id, message, tone, action }];
        // Keep an undo reachable when routine toasts arrive: drop the oldest
        // toast that has nothing to offer before dropping one with an action.
        while (next.length > 3) {
          const index = next.findIndex((toast) => !toast.action);
          next.splice(index === -1 ? 0 : index, 1);
        }
        return next;
      });
      window.setTimeout(() => dismissToast(id), action ? 8000 : 4000);
    },
    [dismissToast],
  );

  const protectStorage = async () => {
    const next = await requestPersistence();
    setPersistence(next);
    pushToast(
      next === "granted"
        ? "Storage protected — the browser will keep your journal"
        : next === "unsupported"
          ? "This browser cannot protect storage — export a backup instead"
          : "The browser kept storage on best effort — export a backup as well",
      next === "granted" ? "success" : "info",
    );
  };

  const effectiveFormula = useMemo(() => {
    if (!formula.autoLeaven) return formula;
    const base = calculateDough({ ...formula, autoLeaven: false });
    return formula.leavenMode === "sourdough"
      ? { ...formula, starterPct: base.suggestedStarterPct }
      : { ...formula, yeastPct: yeastForType(base.suggestedYeastPct, formula.yeastType) };
  }, [formula]);

  const math = useMemo(() => calculateDough(effectiveFormula), [effectiveFormula]);

  const editingBake = bakes.find((bake) => bake.id === editingBakeId) ?? null;
  const designBake = bakes.find((bake) => bake.id === designBakeId) ?? null;
  const pendingTrialBake = pendingTrialFrom
    ? bakes.find((bake) => bake.id === pendingTrialFrom) ?? null
    : null;
  const suggestedName =
    saveOpen && pendingTrialBake ? nextTrialName(pendingTrialBake, bakes) : undefined;
  const editorFormula = editingBake?.formula ?? effectiveFormula;
  const editorMath = editingBake ? calculateDough(editingBake.formula) : math;
  const editingDraft = useMemo<BakeDraft | undefined>(
    () =>
      editingBake
        ? {
            name: editingBake.name,
            ratings: { ...editingBake.ratings },
            notes: editingBake.notes,
            nextTimeNotes: editingBake.nextTimeNotes ?? "",
            flourBrand: editingBake.flourBrand,
            oven: editingBake.oven,
            tags: [...editingBake.tags],
            photos: [...editingBake.photos],
            outcomeTags: [...(editingBake.outcomeTags ?? [])],
            hypothesis: editingBake.hypothesis ?? "",
            actuals: { ...(editingBake.actuals ?? {}) },
          }
        : undefined,
    [editingBake],
  );

  useEffect(() => {
    const shared = readShareFromLocation();
    if (!shared) return;
    setFormula(shared.formula);
    setUnit(shared.unit);
    setTab("calculator");
    pushToast("Shared formula loaded — adjust it or log a bake", "success");
  }, [pushToast]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.formula, formula);
  }, [formula]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.unit, unit);
  }, [unit]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.tempUnit, tempUnit);
  }, [tempUnit]);

  useEffect(() => {
    applyTheme(theme);
    writeStored(STORAGE_KEYS.theme, theme);
  }, [theme]);

  // Ask once on load: a journal that the browser will not evict is the whole
  // promise of a local-first app, and the answer can change after installing.
  useEffect(() => {
    let cancelled = false;
    const ensure = async () => {
      const current = await readPersistence();
      const next = current === "best-effort" ? await requestPersistence() : current;
      if (!cancelled) setPersistence(next);
    };
    void ensure();
    return () => {
      cancelled = true;
    };
  }, []);

  // Two tabs both writing localStorage would silently lose entries. Surface it
  // instead of auto-reloading, which could discard what this tab is editing.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.bakes) setRemoteUpdate(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (nudgedBackup.current || bakes.length < 3) return;
    const last = readStored<unknown>(STORAGE_KEYS.lastBackup, null);
    const lastTime = typeof last === "string" ? new Date(last).getTime() : NaN;
    const ageDays = Number.isFinite(lastTime)
      ? (Date.now() - lastTime) / 86_400_000
      : Number.POSITIVE_INFINITY;
    if (ageDays < 14) return;
    nudgedBackup.current = true;
    pushToast("Your journal has no recent backup", "info", {
      label: "Back up",
      run: () => setBackupOpen(true),
    });
  }, [bakes.length, pushToast]);

  // Load the full journal (photos included) from IndexedDB, migrating the
  // localStorage copy on the first run after an upgrade. Until this finishes,
  // the persistence effect stays paused so it cannot overwrite the database
  // with the photo-less mirror.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const result = await hydrateJournal();
      if (cancelled) return;
      setJournalDb(result.dbAvailable);
      setBakes(result.bakes);
      lastPersistedCount.current = result.bakes.length;
      setJournalReady(true);
      setStorageInfo(await estimateStorage());
      if (result.reason === "quota") {
        pushToast("Browser storage is full, so the journal is being read from the backup mirror.", "error");
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    if (!journalReady) return;
    let disposed = false;
    const batch = bakes;
    const previousCount = lastPersistedCount.current;

    const persist = async () => {
      if (wiping.current) return;
      const result = await persistJournal(batch);

      if (!result.mirrorOk && !disposed) {
        pushToast(result.mirrorError ?? "Could not save to browser storage.", "error");
      }
      if (
        journalDb &&
        !result.dbSaved &&
        result.reason !== "quota" &&
        !journalWriteError.current &&
        !disposed
      ) {
        journalWriteError.current = true;
        pushToast(
          "Photos couldn't move into the browser database. The journal was saved in localStorage instead.",
          "error",
        );
      }
      if (result.quota && !quotaWarned.current && !disposed) {
        quotaWarned.current = true;
        pushToast("Browser storage is full — the newest change could not be saved.", "error", {
          label: "Back up",
          run: () => setBackupOpen(true),
        });
      }
      if (result.dbSaved) {
        lastPersistedCount.current = batch.length;
        if (skipNextSnapshot.current) {
          skipNextSnapshot.current = false;
        } else {
          const snapshot = await maybeSnapshot(batch, previousCount);
          if (snapshot && !disposed) {
            setSnapshots((prev) => [snapshot, ...prev].slice(0, 5));
          }
        }
      }
      if (!disposed) setStorageInfo(await estimateStorage());
    };

    journalWrites.current = journalWrites.current.then(persist, persist);
    return () => {
      disposed = true;
    };
  }, [bakes, journalReady, journalDb, pushToast]);

  // Restore points are only read when the backup panel is opened.
  useEffect(() => {
    if (!backupOpen) return;
    let cancelled = false;
    void listSnapshots().then((list) => {
      if (!cancelled) setSnapshots(list);
    });
    return () => {
      cancelled = true;
    };
  }, [backupOpen]);

  const changeTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectPreset = (preset: StylePreset) => {
    setFormula({ ...preset.formula });
    pushToast(`${preset.name} preset loaded`, "success");
  };

  const updateFormula = (patch: Partial<Formula>) => {
    setFormula((prev) => ({ ...prev, ...patch }));
  };

  const closeSave = () => {
    setSaveOpen(false);
    setEditingBakeId(null);
    // Any close ends the "Bake this again" intent: saving consumes it,
    // cancelling or dismissing the modal abandons it.
    setPendingTrialFrom(null);
  };

  const openNewBake = () => {
    setEditingBakeId(null);
    // Keep pendingTrialFrom: "Bake this again" opened the calculator and the
    // next save must still become a trial of that bake.
    setSaveOpen(true);
  };

  const handleSaveBake = async (draft: BakeDraft) => {
    // In the desktop app the resized photos become ordinary files in the chosen
    // folder first; a write that fails keeps that photo inline in the journal.
    const photos = await materializePhotos(draft.photos);
    if (editingBake) {
      const updatedAt = new Date().toISOString();
      setBakes((prev) =>
        prev.map((bake) =>
          bake.id === editingBake.id
            ? {
                ...bake,
                name: draft.name,
                ratings: draft.ratings,
                notes: draft.notes,
                nextTimeNotes: draft.nextTimeNotes,
                flourBrand: draft.flourBrand,
                oven: draft.oven,
                tags: draft.tags,
                photos,
                outcomeTags: draft.outcomeTags,
                hypothesis: draft.hypothesis,
                actuals: draft.actuals,
                vision: draft.vision,
                updatedAt,
              }
            : bake,
        ),
      );
      closeSave();
      pushToast("Bake log updated", "success");
      return;
    }

    const style = getStyle(effectiveFormula.styleId);
    const parent = pendingTrialBake;
    const entry: BakeEntry = {
      id: newBakeId(),
      createdAt: new Date().toISOString(),
      name: draft.name,
      styleId: effectiveFormula.styleId,
      styleName: style.name,
      formula: effectiveFormula,
      unit,
      ratings: draft.ratings,
      notes: draft.notes,
      nextTimeNotes: draft.nextTimeNotes,
      flourBrand: draft.flourBrand,
      oven: draft.oven,
      tags: draft.tags,
      photos,
      outcomeTags: draft.outcomeTags,
      hypothesis: draft.hypothesis,
      actuals: draft.actuals,
      vision: draft.vision,
      totalDough: math.totalDough,
      parentId: parent?.id,
      rootId: parent ? rootIdOf(parent) : undefined,
    };
    setBakes((prev) => [entry, ...prev]);
    closeSave();
    pushToast(
      parent ? "Next trial saved to your journal" : "Bake saved to your journal",
      "success",
    );
  };

  /** Desktop only: move photos that still sit in the journal onto disk. */
  const movePhotosToFolder = useCallback(async () => {
    let moved = 0;
    const next = await Promise.all(
      bakes.map(async (bake) => {
        const photos = await materializePhotos(bake.photos);
        if (photos.every((photo, index) => photo === bake.photos[index])) return bake;
        moved += photos.filter((photo, index) => photo !== bake.photos[index]).length;
        return { ...bake, photos, updatedAt: new Date().toISOString() };
      }),
    );
    if (moved) setBakes(next);
    return moved;
  }, [bakes]);

  const editBake = (bake: BakeEntry) => {
    // Keep the detail open underneath so focus and context return there after saving.
    setEditingBakeId(bake.id);
    setSaveOpen(true);
  };

  const duplicateBake = (bake: BakeEntry) => {
    const copy = duplicateBakeEntry(bake, newBakeId(), undefined, nextTrialName(bake, bakes));
    setBakes((prev) => [copy, ...prev]);
    setActiveBakeId(copy.id);
    pushToast(
      `“${copy.name}” started — your next-time notes came along; what happened starts blank`,
      "success",
    );
  };

  const designTrial = (
    bake: BakeEntry,
    design: { variable: TrialVariable; delta: number; hypothesis: string },
  ) => {
    const copy = duplicateBakeEntry(bake, newBakeId(), undefined, nextTrialName(bake, bakes));
    const entry: BakeEntry = {
      ...copy,
      formula: adjustFormula(bake.formula, design.variable, design.delta),
      hypothesis:
        design.hypothesis.trim() ||
        `${trialChangeLabel(design.variable, design.delta)} — planned from “${bake.name}”.`,
      notes: "",
      nextTimeNotes: "",
      bakedAt: undefined,
    };
    setBakes((prev) => [entry, ...prev]);
    setActiveBakeId(entry.id);
    pushToast(`Trial planned — ${trialChangeLabel(design.variable, design.delta)}`, "success");
  };

  const bakeThisAgain = (bake: BakeEntry) => {
    setPendingTrialFrom(bake.id);
    setFormula({ ...bake.formula });
    setUnit(bake.unit);
    setActiveBakeId(null);
    changeTab("calculator");
    window.setTimeout(() => document.getElementById("main")?.focus(), 0);
    pushToast(`“${bake.name}” loaded as the next trial — save it once it's baked`, "success");
  };

  const carryForwardBake = (bake: BakeEntry) => {
    setPendingTrialFrom(null);
    setFormula({ ...bake.formula });
    setUnit(bake.unit);
    setActiveBakeId(null);
    changeTab("calculator");
    // The journal stays mounted, so explicitly move focus out of the closed dialog.
    window.setTimeout(() => document.getElementById("main")?.focus(), 0);
    pushToast(`Carried “${bake.name}” forward into the calculator`, "success");
  };

  const rateBake = (bake: BakeEntry, overall: number) => {
    setBakes((prev) =>
      prev.map((item) =>
        item.id === bake.id
          ? {
              ...item,
              ratings: { ...item.ratings, overall },
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    pushToast(
      overall ? `“${bake.name}” scored ${overall}/5` : "Rating cleared",
      overall ? "success" : "info",
    );
  };

  /** Applies an opt-in photo read's suggested ratings and outcome tags. */
  const applyPhotoRead = (bake: BakeEntry, read: VisionRead) => {
    setBakes((prev) =>
      prev.map((item) =>
        item.id === bake.id
          ? {
              ...item,
              vision: read,
              ratings: { ...item.ratings, ...read.ratings },
              outcomeTags: normalizeOutcomeTags([...(item.outcomeTags ?? []), ...read.tags]),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    pushToast("Photo read saved — suggested ratings and tags applied", "success");
  };

  const markBaked = (bake: BakeEntry, baked: boolean) => {
    const bakedAt = baked ? (bake.bakedAt ?? new Date().toISOString()) : undefined;
    setBakes((prev) =>
      prev.map((item) =>
        item.id === bake.id ? { ...item, bakedAt, updatedAt: new Date().toISOString() } : item,
      ),
    );
    pushToast(
      baked
        ? `“${bake.name}” counted as baked in “Dough made”`
        : `“${bake.name}” back to planned — its dough is no longer counted`,
      baked ? "success" : "info",
    );
  };

  const deleteBake = (id: string) => {
    const index = bakes.findIndex((bake) => bake.id === id);
    if (index < 0) return;
    // A restore point of the journal *before* the delete, so the bake can come
    // back even after the Undo toast has gone.
    void takeSnapshot(bakes);
    const removed = bakes[index];
    // Snapshot the children so Undo can reattach them, not just restore the parent.
    const children = bakes.filter((bake) => bake.parentId === id);
    setBakes((prev) => deleteBakeEntry(prev, id));
    setActiveBakeId(null);
    if (editingBakeId === id) closeSave();
    if (pendingTrialFrom === id) setPendingTrialFrom(null);
    pushToast(`Deleted “${removed.name}”`, "info", {
      label: "Undo",
      run: () => {
        setBakes((prev) => {
          if (prev.some((bake) => bake.id === removed.id)) return prev;
          const next = prev.map((bake) => {
            const child = children.find((item) => item.id === bake.id);
            return child ? { ...bake, parentId: child.parentId, rootId: child.rootId } : bake;
          });
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        pushToast(`Restored “${removed.name}”`, "success");
      },
    });
  };

  const restoreBackup = (restored: BakeEntry[], restoredFormula?: Formula, restoredUnit?: Unit) => {
    // Keep a restore point of the journal this replaces, so a wrong file is
    // always one tap away from being undone.
    if (bakes.length) void takeSnapshot(bakes);
    // A pending Undo belongs to the journal that was just replaced.
    setToasts([]);
    setBakes(restored);
    if (restoredFormula) setFormula(restoredFormula);
    if (restoredUnit) setUnit(restoredUnit);
    setPendingTrialFrom(null);
  };

  /** Puts every ratio and setting back to the app defaults, journal untouched. */
  const resetFormula = () => {
    const previous = { ...formula };
    setFormula({ ...DEFAULT_FORMULA });
    pushToast("Recipe reset to the app defaults", "info", {
      label: "Undo",
      run: () => setFormula(previous),
    });
  };

  /** Deletes the journal, photos, restore points and every preference. */
  const wipeAllData = async () => {
    wiping.current = true;
    const result = await clearAllData();

    setToasts([]);
    setBakes([]);
    setFormula({ ...DEFAULT_FORMULA });
    setUnit("g");
    setTempUnit("c");
    setSnapshots([]);
    setActiveBakeId(null);
    setEditingBakeId(null);
    setDesignBakeId(null);
    setPendingTrialFrom(null);
    setSaveOpen(false);
    setKitchen(null);
    setOnboarded(false);
    setLastBackupAt(null);
    lastPersistedCount.current = 0;
    skipNextSnapshot.current = true;
    journalWriteError.current = false;
    quotaWarned.current = false;
    nudgedBackup.current = false;
    setStorageInfo(await estimateStorage());
    wiping.current = false;
    setBackupOpen(false);

    pushToast(
      result.database
        ? "All data cleared — this browser starts fresh"
        : "Preferences were cleared, but the browser database refused to empty",
      result.database ? "success" : "error",
    );
  };

  const createSnapshot = async () => {
    if (!bakes.length) {
      pushToast("Log a bake first — there is nothing to snapshot yet", "info");
      return;
    }
    const snapshot = await takeSnapshot(bakes, "manual");
    setSnapshots(await listSnapshots());
    pushToast(
      snapshot ? "Restore point saved on this device" : "Could not save a restore point",
      snapshot ? "success" : "error",
    );
  };

  const restoreSnapshot = async (id: string) => {
    const restored = await loadSnapshot(id);
    if (!restored || restored.length === 0) {
      pushToast("That restore point could not be read", "error");
      return;
    }
    restoreBackup(restored);
    setSnapshots(await listSnapshots());
    pushToast(
      `Journal restored from a ${restored.length}-bake restore point`,
      "success",
      { label: "Undo", run: () => setBackupOpen(true) },
    );
  };

  const finishOnboarding = () => {
    setOnboarded(true);
    writeStored(STORAGE_KEYS.onboarded, true);
  };

  const activeBake = bakes.find((bake) => bake.id === activeBakeId) ?? null;
  const style = getStyle(effectiveFormula.styleId);

  return (
    <TempUnitProvider value={tempUnit}>
      <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-xl focus:bg-cream focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <div className="app-bg" aria-hidden />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.07] bg-ink/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => changeTab("calculator")}
            className="flex items-center gap-2.5 rounded-xl text-left"
            aria-label="DoughLab home"
          >
            <Logo />
            <span>
              <span className="block font-display text-[16.5px] font-semibold leading-none tracking-tight text-cream">
                DoughLab
              </span>
              <span className="mt-1 hidden font-mono text-[8px] uppercase tracking-[0.26em] text-cream/30 sm:block">
                precision dough
              </span>
            </span>
          </button>

          <nav
            aria-label="Sections"
            className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 md:flex"
          >
            {TABS.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors",
                    active ? "text-cream" : "text-cream/45 hover:text-cream/80",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.08]"
                    />
                  )}
                  <Icon size={13} className="relative" />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Units"
              className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
            >
              {(["g", "oz"] as Unit[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUnit(value)}
                  aria-pressed={unit === value}
                  className={cx(
                    "rounded-full px-2 py-1 font-mono text-[10px] uppercase transition-colors",
                    unit === value
                      ? "bg-cream text-ink"
                      : "text-cream/40 hover:text-cream/80",
                  )}
                >
                  {value}
                </button>
              ))}
              <span aria-hidden className="mx-0.5 h-3.5 w-px bg-white/12" />
              {([
                { value: "c" as const, label: "°C" },
                { value: "f" as const, label: "°F" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTempUnit(option.value)}
                  aria-pressed={tempUnit === option.value}
                  aria-label={option.value === "c" ? "Show temperatures in Celsius" : "Show temperatures in Fahrenheit"}
                  className={cx(
                    "rounded-full px-2 py-1 font-mono text-[10px] transition-colors",
                    tempUnit === option.value
                      ? "bg-cream text-ink"
                      : "text-cream/40 hover:text-cream/80",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openNewBake}
              className="btn-ember sheen inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold sm:px-3.5"
              aria-label="Log a bake"
            >
              <BookmarkPlus size={14} strokeWidth={2.2} />
              <span className="hidden sm:inline">Log a bake</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16">
        {remoteUpdate && (
          <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky/25 bg-sky/10 px-3 py-2"
            >
              <p className="text-[11.5px] leading-relaxed text-cream/70">
                Another tab changed this journal. Reload before logging anything else.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-sky/30 bg-sky/10 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-sky"
              >
                Reload
              </button>
            </div>
          </div>
        )}

        <Hero
          tab={tab}
          formula={effectiveFormula}
          unit={unit}
          totalDough={math.totalDough}
          bakes={bakes}
        />

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-7 md:pb-16"
        >
          {tab === "calculator" ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_396px] xl:grid-cols-[minmax(0,1fr)_424px] xl:gap-5">
              <div className="min-w-0 space-y-4">
                {!onboarded && bakes.length === 0 && (
                  <FirstRun
                    onApply={(patch) => updateFormula(patch)}
                    onStart={() => {
                      finishOnboarding();
                      changeTab("calculator");
                    }}
                    onSkip={finishOnboarding}
                  />
                )}

                <Card className="min-w-0 p-4 sm:p-5">
                  <PresetSelector activeId={effectiveFormula.styleId} onSelect={selectPreset} />
                </Card>

                <CalculatorForm
                  formula={effectiveFormula}
                  math={math}
                  unit={unit}
                  onChange={updateFormula}
                  onReset={resetFormula}
                />

                <FdtPlanner roomTemp={effectiveFormula.roomTemp} />

                <Card className="p-4">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-cream/25">
                    How the engine thinks
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-cream/40">
                    Every ingredient is a baker's percentage of total flour. Fermentation is weighted by
                    temperature: a cold retard counts for a fraction of an hour at room temperature, and
                    the suggested yeast or starter dose follows that effective window. It is a starting
                    point, not a prophecy — your flour, starter strength and kitchen will always get the
                    final word.
                  </p>
                </Card>
              </div>

              <div className="no-scrollbar min-w-0 pb-1 lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
                <RecipeOutput
                  formula={effectiveFormula}
                  math={math}
                  unit={unit}
                  onSave={openNewBake}
                  onPrint={() => setPrintOpen(true)}
                  onKitchen={() =>
                    setKitchen({ formula: effectiveFormula, title: style.name })
                  }
                  onToast={pushToast}
                />
              </div>
            </div>
          ) : tab === "journal" ? (
            <Journal
              bakes={bakes}
              unit={unit}
              storedBytes={storageInfo.bytes}
              storageBudget={storageInfo.budget}
              lastBackupAt={lastBackupAt}
              onOpenBake={(bake) => setActiveBakeId(bake.id)}
              onNewBake={openNewBake}
              onBackup={() => setBackupOpen(true)}
              onRate={rateBake}
              onMarkBaked={markBaked}
              onMovePhotos={movePhotosToFolder}
            />
          ) : tab === "settings" ? (
            <SettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              unit={unit}
              onUnitChange={setUnit}
              tempUnit={tempUnit}
              onTempChange={setTempUnit}
              bakeCount={bakes.length}
              photoCount={bakes.reduce((sum, bake) => sum + bake.photos.length, 0)}
              onOpenBackup={() => setBackupOpen(true)}
              onClearAll={wipeAllData}
              persistence={persistence}
              onRequestPersistence={protectStorage}
            />
          ) : (
            <div className="space-y-4">
              <DinnerPlanner
                formula={effectiveFormula}
                unit={unit}
                onFormulaChange={updateFormula}
                onKitchen={(scaled, startAt) =>
                  setKitchen({ formula: scaled, title: "Dinner service", startAt })
                }
              />
              <StarterPlanner formula={effectiveFormula} math={math} unit={unit} onToast={pushToast} />
            </div>
          )}
        </main>

        <footer className="mx-auto max-w-7xl px-4 pb-24 pt-2 sm:px-6 md:pb-8">
          <div className="hairline mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-cream/20">
            <span className="flex items-center gap-1.5">
              <Pizza size={11} className="text-ember/60" /> DoughLab · precision dough, zero guesswork
            </span>
            <span>Formulas autosave · photos stay on this device</span>
          </div>
        </footer>
      </div>

      {/* Mobile navigation */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="mx-auto max-w-lg border-t border-white/10 bg-ink/90 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl">
          <div className="flex items-center justify-around" role="navigation" aria-label="Mobile sections">
            <MobileTab
              tab={TABS[0]}
              active={tab === "calculator"}
              onChange={() => changeTab("calculator")}
            />
            <MobileTab
              tab={TABS[1]}
              active={tab === "journal"}
              onChange={() => changeTab("journal")}
            />
            <button
              type="button"
              onClick={openNewBake}
              aria-label="Save this bake"
              className="btn-ember -mt-4 grid size-12 shrink-0 place-items-center rounded-2xl shadow-[0_10px_30px_-8px_rgba(255,92,61,0.8)]"
            >
              <BookmarkPlus size={19} strokeWidth={2.2} />
            </button>
            <MobileTab
              tab={TABS[2]}
              active={tab === "plan"}
              onChange={() => changeTab("plan")}
            />
            <MobileTab
              tab={TABS[3]}
              active={tab === "settings"}
              onChange={() => changeTab("settings")}
            />
          </div>
        </div>
      </div>

      <BakeDetail
        key={activeBake?.id ?? "closed"}
        bake={activeBake}
        bakes={bakes}
        unit={unit}
        onClose={() => setActiveBakeId(null)}
        onCarryForward={carryForwardBake}
        onDelete={deleteBake}
        onEdit={editBake}
        onDuplicate={duplicateBake}
        onBakeAgain={bakeThisAgain}
        onDesignTrial={(bake) => setDesignBakeId(bake.id)}
        onRate={rateBake}
        onMarkBaked={markBaked}
        onApplyPhotoRead={applyPhotoRead}
        onKitchen={(bake) => setKitchen({ formula: bake.formula, title: bake.name })}
        onToast={pushToast}
      />

      <SaveBakeModal
        open={saveOpen}
        onClose={closeSave}
        onSave={handleSaveBake}
        formula={editorFormula}
        math={editorMath}
        unit={editingBake?.unit ?? unit}
        initial={editingDraft}
        suggestedName={suggestedName}
        editing={!!editingBake}
        onToast={pushToast}
      />

      <RecipeCardModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        formula={effectiveFormula}
        math={math}
        unit={unit}
        title={`${style.name} dough`}
      />

      <BackupModal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        bakes={bakes}
        formula={formula}
        unit={unit}
        snapshots={snapshots}
        onRestore={restoreBackup}
        onRestoreSnapshot={restoreSnapshot}
        onSnapshotNow={createSnapshot}
        onClearAll={wipeAllData}
        onToast={pushToast}
        onExported={setLastBackupAt}
      />

      {designBake && (
        <TrialDesignerModal
          open
          bake={designBake}
          unit={designBake.unit}
          onClose={() => setDesignBakeId(null)}
          onCreate={(design) => {
            designTrial(designBake, design);
            setDesignBakeId(null);
          }}
        />
      )}

      {kitchen && (
        <KitchenMode
          onClose={closeKitchen}
          formula={kitchen.formula}
          title={kitchen.title}
          startAt={kitchen.startAt}
        />
      )}

      <BakeChatbot />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </TempUnitProvider>
  );
}
