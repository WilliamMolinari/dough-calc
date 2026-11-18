import { useEffect, useRef, useState } from "react";
import { Clock3, Download, HardDriveDownload, History, RotateCcw, Trash2, Upload } from "lucide-react";
import { formatBytes, createBackup, mergeBakes, parseBackup } from "../lib/backup";
import type { SnapshotMeta } from "../lib/journalDb";
import { downloadJson } from "../lib/exports";
import { inlinePhotos, isStoredPhoto } from "../lib/photoFiles";
import { readStored, STORAGE_KEYS } from "../lib/storage";
import type { BakeEntry, Formula, Unit } from "../lib/types";
import { ActionButton, Badge, Modal, cx } from "./ui";

export function BackupModal({
  open,
  onClose,
  bakes,
  formula,
  unit,
  snapshots = [],
  onRestore,
  onRestoreSnapshot,
  onSnapshotNow,
  onClearAll,
  onToast,
  onExported,
}: {
  open: boolean;
  onClose: () => void;
  bakes: BakeEntry[];
  formula: Formula;
  unit: Unit;
  /** Automatic restore points kept in this browser. */
  snapshots?: SnapshotMeta[];
  onRestore: (bakes: BakeEntry[], formula?: Formula, unit?: Unit) => void;
  onRestoreSnapshot?: (id: string) => void;
  onSnapshotNow?: () => void;
  /** Wipes the journal and every preference on this device. */
  onClearAll?: () => void | Promise<void>;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
  /** Tells the app the export happened so the journal can show its age. */
  onExported?: (at: string) => void;
}) {
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [pending, setPending] = useState<{
    bakes: BakeEntry[];
    formula?: Formula;
    unit?: Unit;
  } | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [confirmSnapshot, setConfirmSnapshot] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode("merge");
    setPending(null);
    setFileName("");
    setError(null);
    setBusy(false);
    setConfirmSnapshot(null);
    setConfirmClear(false);
    setClearing(false);
    const stored = readStored<unknown>(STORAGE_KEYS.lastBackup, null);
    setLastBackup(
      typeof stored === "string" && !Number.isNaN(new Date(stored).getTime()) ? stored : null,
    );
  }, [open]);

  const photoCount = bakes.reduce((sum, bake) => sum + bake.photos.length, 0);
  const download = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Photos the desktop app saved as files are read back into the JSON so a
      // backup stays portable to another machine.
      const portable = await Promise.all(
        bakes.map(async (bake) => ({ ...bake, photos: await inlinePhotos(bake.photos) })),
      );
      const now = new Date().toISOString();
      const backup = createBackup(portable, formula, unit);
      const json = JSON.stringify(backup, null, 2);
      downloadJson(backup, `doughlab-backup-${now.slice(0, 10)}.json`);
      try {
        localStorage.setItem(STORAGE_KEYS.lastBackup, JSON.stringify(now));
      } catch {
        /* best effort */
      }
      setLastBackup(now);
      onExported?.(now);
      const missing = portable.reduce(
        (sum, bake) => sum + bake.photos.filter(isStoredPhoto).length,
        0,
      );
      onToast(
        missing
          ? `Backup exported — ${missing} photo file${missing === 1 ? "" : "s"} could not be read, so their references were kept`
          : `Backup exported — ${portable.length} bakes, ${formatBytes(json.length)}`,
        missing ? "info" : "success",
      );
    } catch {
      onToast("Could not build the backup", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPending(null);
    setBusy(true);
    setFileName(file.name);
    try {
      if (file.size > 40 * 1024 * 1024) {
        setError("That file is larger than 40 MB. Split the backup or remove some photos first.");
        return;
      }
      const text = await file.text();
      const result = parseBackup(text);
      if (!result.ok) {
        setError(result.error);
        setPending(null);
        return;
      }
      if (result.bakes.length === 0) {
        setError("The backup was valid but contained no bakes.");
        setPending(null);
        return;
      }
      setPending({
        bakes: result.bakes,
        formula: result.data.formula,
        unit: result.data.unit,
      });
    } catch {
      setError("Could not read that file.");
      setPending(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const apply = () => {
    if (!pending) return;
    const merged = mergeBakes(bakes, pending.bakes, mode);
    onRestore(merged, pending.formula, pending.unit);
    const count = pending.bakes.length;
    onToast(
      mode === "replace"
        ? `Journal replaced with ${count} ${count === 1 ? "bake" : "bakes"}`
        : `Imported ${count} ${count === 1 ? "bake" : "bakes"} · ${merged.length} total`,
      "success",
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Backup & restore"
      subtitle="One file with every bake, rating, note and photo. Keep a copy outside this browser."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[9.5px] text-cream/30">
            {lastBackup
              ? `Last export ${new Date(lastBackup).toLocaleDateString("en-US")}`
              : "No backup yet"}
          </p>
          <ActionButton onClick={onClose}>Close</ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Bakes", value: String(bakes.length) },
            { label: "Photos", value: String(photoCount) },
            { label: "Approx. size", value: formatBytes(JSON.stringify(bakes).length) },
          ].map((stat) => (
            <div key={stat.label} className="glass-inset rounded-xl px-3 py-2.5">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream/30">
                {stat.label}
              </p>
              <p className="mt-0.5 font-mono text-[14px] text-cream/85">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-ember/20 bg-ember/10 text-ember">
              <Download size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-cream/80">Export everything</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-cream/40">
                Includes the journal, photos, current formula, unit and oven profile. Photos make
                the file larger, but nothing is uploaded anywhere.
              </p>
              <button
                type="button"
                onClick={() => void download()}
                disabled={exporting}
                className="btn-ember sheen mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold disabled:opacity-60"
              >
                <HardDriveDownload size={13} />
                {exporting ? "Gathering photos…" : "Download backup"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-lime/20 bg-lime/10 text-lime">
              <History size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-cream/80">Restore points on this device</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-cream/40">
                DoughLab keeps the last few journal states automatically, so a wrong delete or a bad
                restore is not permanent. They live in this browser and never leave it.
              </p>

              {snapshots.length === 0 ? (
                <p className="mt-2 rounded-xl border border-white/8 bg-black/20 px-2.5 py-2 font-mono text-[10px] text-cream/30">
                  No restore points yet — one appears after your first saved change.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {snapshots.map((snapshot) => (
                    <li
                      key={snapshot.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-2.5 py-2"
                    >
                      <Clock3 size={11} className="shrink-0 text-cream/30" />
                      <span className="font-mono text-[10.5px] text-cream/70">
                        {new Date(snapshot.at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-mono text-[9.5px] text-cream/30">
                        {snapshot.count} {snapshot.count === 1 ? "bake" : "bakes"} ·{" "}
                        {formatBytes(snapshot.bytes)}
                        {snapshot.photos ? "" : " · no photos"}
                        {snapshot.reason === "manual" ? " · manual" : ""}
                      </span>

                      {onRestoreSnapshot && (
                        <button
                          type="button"
                          onClick={() =>
                            confirmSnapshot === snapshot.id
                              ? onRestoreSnapshot(snapshot.id)
                              : setConfirmSnapshot(snapshot.id)
                          }
                          className={cx(
                            "ml-auto rounded-lg border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors",
                            confirmSnapshot === snapshot.id
                              ? "border-hot/40 bg-hot/15 text-hot"
                              : "border-white/12 bg-white/[0.04] text-cream/55 hover:text-cream",
                          )}
                        >
                          {confirmSnapshot === snapshot.id ? "Confirm" : "Restore"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {onSnapshotNow && (
                <button
                  type="button"
                  onClick={onSnapshotNow}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-cream/70 transition-colors hover:border-white/20 hover:text-cream"
                >
                  <History size={13} /> Save a restore point now
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-sky/20 bg-sky/10 text-sky">
              <Upload size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-cream/80">Restore a backup</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-cream/40">
                Choose a <span className="font-mono text-cream/60">doughlab-backup.json</span> file.
                Nothing changes until you apply it.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Choose a DoughLab backup file"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-cream/70 transition-colors hover:border-white/20 hover:text-cream disabled:opacity-45"
              >
                <Upload size={13} /> {busy ? "Reading…" : "Choose backup file"}
              </button>

              {fileName && (
                <p className="mt-1.5 truncate font-mono text-[9.5px] text-cream/30">{fileName}</p>
              )}

              {pending && (
                <div className="mt-3 rounded-xl border border-lime/20 bg-lime/[0.05] p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11.5px] text-lime/85">
                      {pending.bakes.length} {pending.bakes.length === 1 ? "bake" : "bakes"} ·{" "}
                      {pending.bakes.reduce((sum, bake) => sum + bake.photos.length, 0)} photos
                    </p>
                    <Badge tone="lime">Ready</Badge>
                  </div>
                  <div
                    role="group"
                    aria-label="Restore mode"
                    className="mt-2 grid grid-cols-2 gap-1.5"
                  >
                    {[
                      { id: "merge" as const, label: "Merge", note: "Keep current bakes" },
                      { id: "replace" as const, label: "Replace", note: "Use backup only" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMode(option.id)}
                        aria-pressed={mode === option.id}
                        className={cx(
                          "rounded-lg border px-2 py-1.5 text-left transition-colors",
                          mode === option.id
                            ? "border-ember/40 bg-ember/12"
                            : "border-white/8 bg-white/[0.02] hover:border-white/16",
                        )}
                      >
                        <span className="block text-[11.5px] text-cream/80">{option.label}</span>
                        <span className="block font-mono text-[8.5px] text-cream/30">
                          {option.note}
                        </span>
                      </button>
                    ))}
                  </div>
                  {mode === "replace" && (
                    <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-hot/80">
                      <RotateCcw size={10} className="mt-0.5 shrink-0" />
                      This removes the {bakes.length} {bakes.length === 1 ? "bake" : "bakes"} currently in this browser.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={apply}
                    className="btn-ember mt-2.5 w-full rounded-xl px-3 py-2 text-[12px] font-semibold"
                  >
                    {mode === "replace"
                      ? `Replace journal with ${pending.bakes.length} ${pending.bakes.length === 1 ? "bake" : "bakes"}`
                      : `Merge ${pending.bakes.length} ${pending.bakes.length === 1 ? "bake" : "bakes"} into the journal`}
                  </button>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-2 text-[10.5px] leading-relaxed text-hot/85">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        {onClearAll && (
          <div className="rounded-2xl border border-hot/25 bg-hot/[0.05] p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-hot/25 bg-hot/10 text-hot">
                <Trash2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-cream/80">Clear all data</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-cream/40">
                  Deletes every bake and photo ({bakes.length}{" "}
                  {bakes.length === 1 ? "bake" : "bakes"}, {photoCount}{" "}
                  {photoCount === 1 ? "photo" : "photos"}), all restore points, the current formula,
                  units, timers, dinner plan and the saved Gemini key from this browser. Export a
                  backup first if you want to keep any of it.
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
                      {bakes.length
                        ? `All ${bakes.length} ${bakes.length === 1 ? "bake" : "bakes"} will be gone.`
                        : "The app will start again from a fresh install."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={clearing}
                        onClick={() => {
                          setClearing(true);
                          void Promise.resolve(onClearAll?.()).finally(() => {
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
            </div>
          </div>
        )}

        <p className="text-center font-mono text-[9px] text-cream/20">
          Backups stay on this device. Store the file somewhere you will find it again.
        </p>
      </div>
    </Modal>
  );
}
