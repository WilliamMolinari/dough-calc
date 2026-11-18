import { buildSchedule, calculateDough } from "./calc";
import { fmtWeight, fmtClock, fmtDay } from "./format";
import { ingredientLines, leavenSummary, YEAST_LABEL } from "./recipe";
import { fmtTemp } from "./temperature";
import type { BakeEntry, Formula, TempUnit, Unit } from "./types";

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "doughlab-recipe"
  );
}

export function buildRecipeText(
  formula: Formula,
  unit: Unit,
  title?: string,
  tempUnit: TempUnit = "c",
): string {
  const math = calculateDough(formula);
  const lines = ingredientLines(formula, math, unit);
  const schedule = buildSchedule(formula, undefined, tempUnit);
  const ready = schedule[schedule.length - 1];

  const weigh = lines.map((line) => {
    const value = fmtWeight(line.grams, unit);
    return `  ${line.label.padEnd(24, " ")}${value.padStart(10, " ")}`;
  });

  return [
    `DOUGHLAB — ${(title ?? "Custom formula").toUpperCase()}`,
    formula.sizing === "pan"
      ? `${math.ballCount} × ${formula.panLength}×${formula.panWidth} cm pan (${fmtWeight(math.ballWeight, unit)} each) · ${formula.hydration}% hydration`
      : `${math.ballCount} × ${fmtWeight(math.ballWeight, unit)} · ${formula.hydration}% hydration`,
    "",
    "WEIGH",
    ...weigh,
    "  " + "—".repeat(34),
    `  ${"Total dough".padEnd(24, " ")}${fmtWeight(math.totalDough, unit).padStart(10, " ")}`,
    "",
    "LEAVEN",
    `  ${leavenSummary(formula, math, unit)}`,
    formula.yeastType === "fresh"
      ? `  Fresh yeast ≈ ${math.suggestedYeastPct}% IDY equivalent suggested for this schedule`
      : "",
    "",
    "FERMENT",
    `  Bulk ${formula.bulkHours} h at ${fmtTemp(formula.roomTemp, tempUnit)}`,
    formula.retardHours > 0
      ? `  Cold retard ${formula.retardHours} h at ${fmtTemp(formula.fridgeTemp, tempUnit)}`
      : "",
    formula.temperHours > 0 ? `  Temper ${formula.temperHours} h at room temperature` : "",
    ready ? `  Bake around ${fmtClock(ready.at)} — ${fmtDay(ready.at)}` : "",
    "",
    "Made with DoughLab",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * A calendar file with one alarm per scheduled step. Importing it gives real
 * reminders on the phone even when DoughLab is closed, with no backend.
 */
export function downloadScheduleIcs(
  formula: Formula,
  title: string,
  startAt: Date = new Date(),
  tempUnit: TempUnit = "c",
): void {
  const stamp = icsStamp(new Date());
  const events = buildSchedule(formula, startAt, tempUnit).map((step, index) => {
    const end = new Date(step.at.getTime() + 15 * 60_000);
    return [
      "BEGIN:VEVENT",
      `UID:${step.key}-${index}-${step.at.getTime()}@doughlab.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(step.at)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsText(`${title} — ${step.label}`)}`,
      `DESCRIPTION:${icsText(step.detail)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT5M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`${step.label} in 5 minutes`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DoughLab//Schedule//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsText(`${title} · DoughLab`)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  downloadBlob(
    new Blob([body], { type: "text/calendar;charset=utf-8" }),
    `${slugify(title)}-doughlab.ics`,
  );
}

/* ------------------------------------------------------------------ */
/* Journal spreadsheet export                                          */
/* ------------------------------------------------------------------ */

const LEAVEN_CSV: Record<BakeEntry["formula"]["leavenMode"], string> = {
  sourdough: "Sourdough starter",
  yeast: "Commercial yeast",
  preferment: "Pre-ferment",
};

const SWEETENER_CSV: Record<BakeEntry["formula"]["sweetener"], string> = {
  none: "",
  sugar: "Sugar",
  honey: "Honey",
  malt: "Malt extract",
};

/** RFC 4180: quote a cell only when it could otherwise break the row. */
export function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per bake, so a spreadsheet can answer "was 70% actually better?". */
export function journalCsv(bakes: BakeEntry[]): string {
  const header = [
    "Date",
    "Name",
    "Style",
    "Hydration %",
    "Salt %",
    "Oil %",
    "Sweetener",
    "Sweetener %",
    "Leaven",
    "Leaven %",
    "Balls or pans",
    "Weight each (g)",
    "Total dough (g)",
    "Bulk (h)",
    "Cold retard (h)",
    "Temper (h)",
    "Room (C)",
    "Fridge (C)",
    "Oven",
    "Overall",
    "Crust",
    "Crumb",
    "Extensibility",
    "Flavour",
    "Tags",
    "Flour",
    "Notes",
    "Next time",
  ];

  const rows = bakes.map((bake) => {
    const f = bake.formula;
    const math = calculateDough(f);
    return [
      bake.createdAt.slice(0, 10),
      bake.name,
      bake.styleName,
      f.hydration,
      f.salt,
      f.oil,
      SWEETENER_CSV[f.sweetener],
      f.sweetener === "none" ? "" : f.sweetenerPct,
      LEAVEN_CSV[f.leavenMode],
      f.leavenMode === "sourdough" ? f.starterPct : f.yeastPct,
      math.ballCount,
      Math.round(math.ballWeight),
      Math.round(math.totalDough),
      f.bulkHours,
      f.retardHours,
      f.temperHours,
      f.roomTemp,
      f.fridgeTemp,
      bake.oven,
      bake.ratings.overall || "",
      bake.ratings.crust || "",
      bake.ratings.crumb || "",
      bake.ratings.extensibility || "",
      bake.ratings.flavor || "",
      bake.tags.join(" "),
      bake.flourBrand,
      bake.notes,
      bake.nextTimeNotes,
    ]
      .map(csvCell)
      .join(",");
  });

  // The BOM keeps Excel from mangling accented names and degree signs.
  return `\uFEFF${[header.join(","), ...rows].join("\r\n")}`;
}

export function downloadJournalCsv(bakes: BakeEntry[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([journalCsv(bakes)], { type: "text/csv;charset=utf-8" }),
    `doughlab-journal-${stamp}.csv`,
  );
}

/**
 * One event with an alarm at the timer's end time. Calendar apps fire this
 * even when the DoughLab tab is asleep, which a page timer cannot promise.
 */
export function downloadTimerIcs(label: string, endsAt: number, title = "DoughLab timer"): void {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return;
  const start = new Date(end.getTime() - 60_000);
  const stamp = icsStamp(new Date());
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DoughLab//Timer//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsStamp(end)}-${slugify(label)}@doughlab.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`${title} — ${label}`)}`,
    `DESCRIPTION:${icsText("Set in DoughLab kitchen mode.")}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(label)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  downloadBlob(
    new Blob([body], { type: "text/calendar;charset=utf-8" }),
    `${slugify(label)}-alarm.ics`,
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function recipeJson(formula: Formula, unit: Unit, name: string) {
  const math = calculateDough(formula);
  return {
    app: "DoughLab",
    version: 1,
    exportedAt: new Date().toISOString(),
    name,
    unit,
    formula,
    calculated: {
      totalFlour: Math.round(math.flour),
      totalWater: Math.round(math.water),
      salt: Math.round(math.salt * 10) / 10,
      leaven: Math.round(math.actualLeavenPct * 100) / 100,
      totalDough: Math.round(math.totalDough),
      ballWeight: Math.round(math.ballWeight),
      ballCount: math.ballCount,
      effectiveFermentHours: math.effectiveHours,
      pan:
        formula.sizing === "pan"
          ? {
              lengthCm: formula.panLength,
              widthCm: formula.panWidth,
              loadingGramsPerCm2: formula.doughLoading,
            }
          : undefined,
    },
  };
}

export function bakeJson(bake: BakeEntry) {
  return {
    app: "DoughLab",
    version: 1,
    exportedAt: new Date().toISOString(),
    bake: { ...bake, photos: bake.photos.length ? [`(${bake.photos.length} photos omitted)`] : [] },
  };
}

/* ------------------------------------------------------------------ */
/* Shareable summary image — drawn by hand so there is no dependency  */
/* ------------------------------------------------------------------ */

const W = 1080;
const H = 1350;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export async function downloadRecipeImage(
  formula: Formula,
  unit: Unit,
  title: string,
  tempUnit: TempUnit = "c",
): Promise<void> {
  const math = calculateDough(formula);
  const lines = ingredientLines(formula, math, unit);
  const schedule = buildSchedule(formula, undefined, tempUnit);
  const ready = schedule[schedule.length - 1];

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* font loading is best-effort */
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");

  // Base
  ctx.fillStyle = "#08080b";
  ctx.fillRect(0, 0, W, H);

  const glowA = ctx.createRadialGradient(W * 0.92, H * 0.04, 0, W * 0.92, H * 0.04, W * 0.95);
  glowA.addColorStop(0, "rgba(255,122,61,0.38)");
  glowA.addColorStop(0.45, "rgba(255,77,109,0.10)");
  glowA.addColorStop(1, "rgba(8,8,11,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);

  const glowB = ctx.createRadialGradient(W * 0.05, H * 0.96, 0, W * 0.05, H * 0.96, W * 0.8);
  glowB.addColorStop(0, "rgba(198,244,95,0.14)");
  glowB.addColorStop(1, "rgba(8,8,11,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  // Hairline frame
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();

  // Brand
  ctx.strokeStyle = "#ff7a3d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(112, 128, 24, 0, Math.PI * 2);
  ctx.stroke();
  drawDot(ctx, 112, 128, 7, "#ff7a3d");
  ctx.fillStyle = "rgba(245,239,230,0.62)";
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText("D O U G H L A B", 154, 136);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(245,239,230,0.42)";
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText("FORMULA CARD", W - 96, 136);
  ctx.textAlign = "left";

  // Title
  ctx.fillStyle = "#f7f1e7";
  ctx.font = '700 82px "Bricolage Grotesque", "Inter", sans-serif';
  const cleanTitle = title.length > 24 ? `${title.slice(0, 23)}…` : title;
  ctx.fillText(cleanTitle, 92, 290);

  ctx.fillStyle = "rgba(245,239,230,0.56)";
  ctx.font = '400 28px "Inter", sans-serif';
  ctx.fillText(
    `${math.ballCount} × ${fmtWeight(math.ballWeight, unit)}  ·  ${formula.hydration}% hydration  ·  ${formula.salt}% salt`,
    92,
    340,
  );

  // Stat cards
  const stats = [
    { label: "TOTAL DOUGH", value: fmtWeight(math.totalDough, unit) },
    { label: "FLOUR", value: fmtWeight(math.flour, unit) },
    { label: "WATER", value: fmtWeight(math.water, unit) },
  ];
  const cardW = (W - 184 - 32 * 2) / 3;
  stats.forEach((stat, i) => {
    const x = 92 + i * (cardW + 32);
    const y = 392;
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    roundedRect(ctx, x, y, cardW, 136, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, x, y, cardW, 136, 26);
    ctx.stroke();
    ctx.fillStyle = "rgba(245,239,230,0.44)";
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText(stat.label, x + 26, y + 44);
    ctx.fillStyle = "#f7f1e7";
    ctx.font = '600 40px "Bricolage Grotesque", "Inter", sans-serif';
    ctx.fillText(stat.value, x + 26, y + 100);
  });

  // Ingredients
  let y = 606;
  ctx.fillStyle = "rgba(245,239,230,0.44)";
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText("WEIGH NOW", 92, y);
  y += 46;

  const accentFor: Record<string, string> = {
    flour: "#f3e3c8",
    flour2: "#e0b98b",
    water: "#79c9ff",
    leaven: "#ffb066",
    extra: "#c6f45f",
  };

  lines.slice(0, 7).forEach((line) => {
    drawDot(ctx, 100, y - 9, 5, accentFor[line.accent ?? "extra"] ?? "#c6f45f");
    ctx.fillStyle = "#efe7dc";
    ctx.font = '400 30px "Inter", sans-serif';
    ctx.fillText(line.label, 124, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f7f1e7";
    ctx.font = '500 30px "JetBrains Mono", monospace';
    ctx.fillText(fmtWeight(line.grams, unit), W - 92, y);
    ctx.textAlign = "left";

    if (line.note) {
      y += 26;
      ctx.fillStyle = "rgba(245,239,230,0.35)";
      ctx.font = '400 19px "Inter", sans-serif';
      ctx.fillText(line.note, 124, y);
    }
    y += 46;
  });

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.moveTo(92, y + 4);
  ctx.lineTo(W - 92, y + 4);
  ctx.stroke();
  y += 52;

  // Ferment plan
  ctx.fillStyle = "rgba(245,239,230,0.44)";
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText("FERMENT", 92, y);
  y += 44;

  const fermentBits = [
    `${formula.bulkHours} h bulk · ${fmtTemp(formula.roomTemp, tempUnit)}`,
    formula.retardHours > 0
      ? `${formula.retardHours} h cold · ${fmtTemp(formula.fridgeTemp, tempUnit)}`
      : null,
    formula.temperHours > 0 ? `${formula.temperHours} h temper` : null,
  ].filter(Boolean) as string[];

  ctx.fillStyle = "#efe7dc";
  ctx.font = '400 28px "Inter", sans-serif';
  ctx.fillText(fermentBits.join("   →   "), 92, y);
  y += 46;

  if (ready) {
    ctx.fillStyle = "rgba(255,176,102,0.92)";
    ctx.font = '500 24px "JetBrains Mono", monospace';
    ctx.fillText(`BAKE AROUND ${fmtClock(ready.at).toUpperCase()}`, 92, y);
    y += 28;
  }

  // Footer
  ctx.fillStyle = "rgba(245,239,230,0.30)";
  ctx.font = '400 20px "Inter", sans-serif';
  ctx.fillText(
    formula.leavenMode === "sourdough"
      ? `Sourdough · ${formula.starterPct}% starter`
      : `${YEAST_LABEL[formula.yeastType]} · ${formula.yeastPct}% of flour`,
    92,
    H - 108,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(245,239,230,0.30)";
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText("DOUGHLAB · PRECISION DOUGH", W - 92, H - 108);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not render the image");
  downloadBlob(blob, `${slugify(title)}-doughlab.png`);
}
