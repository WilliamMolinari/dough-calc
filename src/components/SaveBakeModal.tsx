import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Save, X } from "lucide-react";
import { OVEN_OPTIONS, TAG_SUGGESTIONS, getStyle } from "../lib/presets";
import { getOvenProfile } from "../lib/ovens";
import { fmtWeight } from "../lib/format";
import { OUTCOME_TAGS } from "../lib/outcomes";
import type { DoughMath } from "../lib/calc";
import type { BakeActuals, Formula, Ratings, Unit } from "../lib/types";
import { ActionButton, Modal, Stars, cx } from "./ui";
import { MAX_PHOTOS, PhotoUpload } from "./PhotoUpload";

export interface BakeDraft {
  name: string;
  ratings: Ratings;
  /** What happened on bake day. */
  notes: string;
  /** What to change next time — carried into the next trial. */
  nextTimeNotes: string;
  flourBrand: string;
  oven: string;
  tags: string[];
  photos: string[];
  /** Structured sensory outcomes, keys from lib/outcomes.ts. */
  outcomeTags: string[];
  /** The single change a planned trial is testing. */
  hypothesis: string;
  /** Measured conditions on the day. */
  actuals: BakeActuals;
}

const EMPTY_RATINGS: Ratings = { crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 };

const RATING_FIELDS: Array<{ key: keyof Ratings; label: string; hint: string }> = [
  { key: "crust", label: "Crust", hint: "crispiness & char" },
  { key: "crumb", label: "Crumb", hint: "openness & air" },
  { key: "extensibility", label: "Extensibility", hint: "stretch & handle" },
  { key: "flavor", label: "Flavour", hint: "depth & salt" },
];

function defaultName(styleName: string): string {
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${styleName} · ${date}`;
}

function cleanTag(raw: string): string {
  return raw.trim().replace(/^#/, "").slice(0, 28);
}

function withTag(tags: string[], raw: string): string[] {
  const value = cleanTag(raw);
  if (!value || tags.length >= 8) return tags;
  if (tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) return tags;
  return [...tags, value];
}

export function SaveBakeModal({
  open,
  onClose,
  onSave,
  formula,
  math,
  unit,
  initial,
  suggestedName,
  editing = false,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: BakeDraft) => void;
  formula: Formula;
  math: DoughMath;
  unit: Unit;
  initial?: BakeDraft | null;
  /** Name for a new bake, e.g. the next trial when continuing a family. */
  suggestedName?: string;
  editing?: boolean;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const style = getStyle(formula.styleId);
  const profileOven = getOvenProfile(formula.ovenProfile).logName;
  const defaultOven = OVEN_OPTIONS.includes(profileOven) ? profileOven : OVEN_OPTIONS[0];
  const [name, setName] = useState(defaultName(style.name));
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [notes, setNotes] = useState("");
  const [nextTimeNotes, setNextTimeNotes] = useState("");
  const [flourBrand, setFlourBrand] = useState("");
  const [oven, setOven] = useState(OVEN_OPTIONS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [outcomeTags, setOutcomeTags] = useState<string[]>([]);
  const [hypothesis, setHypothesis] = useState("");
  const [actuals, setActuals] = useState<BakeActuals>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const previousOpen = useRef(false);

  useEffect(() => {
    if (open && !previousOpen.current) {
      if (initial) {
        setName(initial.name);
        setRatings({ ...initial.ratings });
        setNotes(initial.notes);
        setNextTimeNotes(initial.nextTimeNotes);
        setFlourBrand(initial.flourBrand);
        setOven(initial.oven || defaultOven);
        setTags([...initial.tags]);
        setPhotos([...initial.photos]);
        setOutcomeTags([...(initial.outcomeTags ?? [])]);
        setHypothesis(initial.hypothesis ?? "");
        setActuals({ ...(initial.actuals ?? {}) });
      } else {
        setName(suggestedName?.trim() || defaultName(style.name));
        setRatings(EMPTY_RATINGS);
        setNotes("");
        setNextTimeNotes("");
        setFlourBrand("");
        setOven(defaultOven);
        setTags([]);
        setPhotos([]);
        setOutcomeTags([]);
        setHypothesis("");
        setActuals({});
      }
      setTagDraft("");
      setPhotoBusy(false);
    }
    previousOpen.current = open;
  }, [open, style.name, initial, suggestedName, defaultOven]);

  const addTag = (raw: string) => {
    setTags((prev) => withTag(prev, raw));
    setTagDraft("");
  };

  const handleSave = () => {
    if (photoBusy) {
      onToast("Hang tight — the photos are still being resized.", "info");
      return;
    }
    onSave({
      name: name.trim() || defaultName(style.name),
      ratings,
      notes: notes.trim(),
      nextTimeNotes: nextTimeNotes.trim(),
      flourBrand: flourBrand.trim(),
      oven,
      // Include a tag that is typed but not yet confirmed with Enter.
      tags: withTag(tags, tagDraft),
      photos,
      outcomeTags,
      hypothesis: hypothesis.trim(),
      actuals,
    });
  };

  const setActual = (key: keyof BakeActuals, raw: string) => {
    setActuals((prev) => ({
      ...prev,
      [key]: raw.trim() === "" ? undefined : Number(raw),
    }));
  };

  const toggleOutcome = (key: string) => {
    setOutcomeTags((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const leavenText =
    formula.leavenMode === "sourdough"
      ? `${formula.starterPct}% starter`
      : `${formula.yeastPct}% ${formula.yeastType.toUpperCase()}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit bake log" : "Log this bake"}
      subtitle={
        editing
          ? "Update the ratings, notes, photos and oven. The saved formula stays exactly as it was."
          : "Rate it now or later — the formula is captured exactly as it is."
      }
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-cream/30">
            {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} attached · ` : ""}
            saved in this browser
          </p>
          <div className="flex items-center gap-2">
            <ActionButton onClick={onClose}>Cancel</ActionButton>
            <ActionButton
              variant="primary"
              icon={editing ? Save : BookmarkPlus}
              onClick={handleSave}
              disabled={photoBusy}
              className="px-4"
            >
              {editing ? "Save changes" : "Save bake"}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="glass-inset flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ember/70">{style.name}</p>
            <p className="mt-0.5 text-[13px] text-cream/80">
              {math.ballCount} × {fmtWeight(math.ballWeight, unit)} · {formula.hydration}% hydration ·{" "}
              {leavenText}
            </p>
          </div>
          <p className="font-mono text-[11px] text-cream/40">{fmtWeight(math.totalDough, unit)} batch</p>
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-cream/60">Bake name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={70}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[13.5px] text-cream outline-none transition-colors placeholder:text-cream/25 focus:border-ember/60"
            placeholder="Friday night 65%"
          />
        </label>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-cream/80">Overall</p>
              <p className="font-mono text-[10px] text-cream/30">the honest verdict</p>
            </div>
            <Stars
              value={ratings.overall}
              onChange={(value) => setRatings((prev) => ({ ...prev, overall: value }))}
              label="Overall rating"
              size={24}
            />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {RATING_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-cream/70">{field.label}</p>
                  <p className="font-mono text-[9px] text-cream/25">{field.hint}</p>
                </div>
                <Stars
                  value={ratings[field.key]}
                  onChange={(value) => setRatings((prev) => ({ ...prev, [field.key]: value }))}
                  label={`${field.label} rating`}
                  size={15}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-cream/60">What it was like</span>
            <span className="font-mono text-[10px] text-cream/25">optional signals</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {OUTCOME_TAGS.map((tag) => {
              const active = outcomeTags.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleOutcome(tag.key)}
                  className={cx(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    active
                      ? "border-ember/45 bg-ember/15 text-ember-2"
                      : "border-white/8 bg-white/[0.03] text-cream/35 hover:border-white/20 hover:text-cream/70",
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">Flour</span>
            <input
              value={flourBrand}
              onChange={(event) => setFlourBrand(event.target.value)}
              maxLength={60}
              placeholder="Caputo Pizzeria 00"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12.5px] text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-cream/60">Oven</span>
            <select
              value={oven}
              onChange={(event) => setOven(event.target.value)}
              className="mt-1.5 w-full appearance-none rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12.5px] text-cream outline-none focus:border-ember/60"
            >
              {OVEN_OPTIONS.map((option) => (
                <option key={option} value={option} className="bg-[#121218]">
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-cream/60">Tags</span>
            <span className="font-mono text-[10px] text-cream/25">{tags.length}/8</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 p-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg border border-ember/25 bg-ember/10 px-2 py-1 font-mono text-[10px] text-ember-2"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                  aria-label={`Remove tag ${tag}`}
                  className="text-ember-2/60 hover:text-ember-2"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag(tagDraft);
                }
                if (event.key === "Backspace" && !tagDraft && tags.length) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={() => addTag(tagDraft)}
              placeholder={tags.length ? "add another…" : "cold ferment, 00 flour…"}
              aria-label="Add a tag"
              className="min-w-[9rem] flex-1 bg-transparent px-1 py-1 text-[12px] text-cream outline-none placeholder:text-cream/25"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TAG_SUGGESTIONS.filter((tag) => !tags.includes(tag))
              .slice(0, 6)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] text-cream/35 transition-colors hover:border-white/20 hover:text-cream/70"
                >
                  + {tag}
                </button>
              ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-cream/60">Actuals</span>
            <span className="font-mono text-[9.5px] text-cream/25">optional · what the day measured</span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {([
              { key: "doughTempC", label: "Dough", suffix: "°C", max: 60 },
              { key: "roomTempC", label: "Room", suffix: "°C", max: 60 },
              { key: "bakeMinutes", label: "Bake", suffix: "min", max: 180 },
            ] as const).map((field) => (
              <label key={field.key} className="block">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/30">
                  {field.label} <span className="text-cream/20">{field.suffix}</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={field.max}
                  value={actuals[field.key] ?? ""}
                  onChange={(event) => setActual(field.key, event.target.value)}
                  placeholder="—"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[12px] text-cream outline-none placeholder:text-cream/20 focus:border-ember/60"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-cream/60">Hypothesis</span>
          <span className="ml-1.5 font-mono text-[9.5px] text-cream/25">the one change this trial tests</span>
          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            rows={2}
            maxLength={400}
            placeholder="More water should open the crumb without weakening the rim."
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-cream/60">What happened</span>
          <span className="ml-1.5 font-mono text-[9.5px] text-cream/25">bake day, in your words</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={1200}
            placeholder="Puffed fast, pale underside. Crumb was tight at the rim."
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-cream/60">What to change next time</span>
          <span className="ml-1.5 font-mono text-[9.5px] text-cream/25">carried into the next trial</span>
          <textarea
            value={nextTimeNotes}
            onChange={(event) => setNextTimeNotes(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder="20 g more water, 30 s longer on the steel."
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-cream outline-none placeholder:text-cream/25 focus:border-ember/60"
          />
        </label>

        <PhotoUpload
          photos={photos}
          onChange={setPhotos}
          onError={(message) => onToast(message, "error")}
          onBusyChange={setPhotoBusy}
        />

        <p className={cx("font-mono text-[9.5px] leading-relaxed text-cream/25", photoBusy && "text-ember/60")}>
          Photos are compressed and limited to {MAX_PHOTOS} per bake. They are stored in this
          browser's database, so they no longer count against the small form-data quota. Export a
          backup to keep a permanent copy.
        </p>
      </div>
    </Modal>
  );
}
