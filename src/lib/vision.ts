import { desktopBridge } from "./desktop";
import {
  BakeSommelierError,
  geminiClient,
  geminiError,
  getActiveKey,
  getActiveModel,
} from "./gemini";
import { normalizeOutcomeTags } from "./outcomes";
import { isStoredPhoto } from "./photoFiles";
import type { VisionConfidence, VisionRead } from "./types";

/** Cost guard: a bake is read from at most three photos. */
export const MAX_VISION_PHOTOS = 3;
/** Long edge sent to the model. Small enough to stay cheap, big enough to see crumb. */
const VISION_MAX_EDGE = 768;
const VISION_JPEG_QUALITY = 0.72;

const VISION_SYSTEM = [
  "You are DoughLab AI, a master pizzaiolo inspecting photographs of a pizza the baker actually baked.",
  "Judge only what is visible: crust colour and char, rim puff, underside spotting and evenness, crumb openness when a cross-section is shown, gum line, pooling oil or cheese, shape.",
  "You cannot taste, smell or touch the pizza. Never claim flavour, salt level, fermentation time or dough feel from a photo.",
  "Many shots show only the top: do not invent a crumb read. If a photo is dim, distant, obstructed or not pizza, say so, use low confidence and return no tags or ratings.",
  "Be specific and honest. Do not flatter, and do not assume the bake failed.",
  "Ratings are 1–5 where 5 is excellent; 0 means the photo cannot support that rating. Rate crust (colour, char, evenness), crumb (only with a crumb shot) and overall (only when the photos support it).",
  "Tags may only come from: open-crumb, tight-crumb, crisp-base, pale-base, charred, gum-line, even-bake, dense.",
  'Reply with JSON only, no prose outside it: {"summary":"2-3 sentences","observations":["..."],"confidence":"low|medium|high","ratings":{"crust":0,"crumb":0,"overall":0},"tags":["..."]}',
].join("\n");

export interface PhotoAnalysisContext {
  bakeName?: string;
  styleName?: string;
  /** Compact formula summary, e.g. "62% hydration · 2.5% salt · 24 h cold retard". */
  formulaSummary?: string;
}

interface PreparedPhoto {
  data: string;
  mimeType: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be decoded."));
    image.src = src;
  });
}

/** Shrinks a data URL to a small JPEG for the request body. */
export async function downscalePhoto(dataUrl: string): Promise<PreparedPhoto | null> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, VISION_MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const encoded = canvas.toDataURL("image/jpeg", VISION_JPEG_QUALITY);
  const data = encoded.split(",")[1] ?? "";
  return data ? { data, mimeType: "image/jpeg" } : null;
}

/** Desktop photos live on disk as file references; read them back first. */
async function resolvePhoto(photo: string): Promise<string | null> {
  if (photo.startsWith("data:")) return photo;
  if (!isStoredPhoto(photo)) return null;
  const bridge = desktopBridge();
  if (!bridge) return null;
  try {
    const file = await bridge.readPhoto(photo);
    return file?.dataUrl ?? null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function ratingValue(raw: unknown): number | undefined {
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return value > 0 ? Math.min(5, Math.max(1, Math.round(value))) : undefined;
}

/** Validates a model answer. Exported so the contract is testable without a network. */
export function parseVisionResult(
  raw: string,
  meta: { model: string; photoCount: number; at?: string },
): VisionRead {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new BakeSommelierError(
      "empty",
      "Gemini's photo read came back unreadable. Try again.",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BakeSommelierError("empty", "Gemini's photo read came back empty. Try again.");
  }

  const record = parsed as Record<string, unknown>;
  const summary = cleanText(record.summary, 900);
  if (!summary) {
    throw new BakeSommelierError("empty", "Gemini returned no description of the photos. Try again.");
  }

  const ratingsSource =
    record.ratings && typeof record.ratings === "object" && !Array.isArray(record.ratings)
      ? (record.ratings as Record<string, unknown>)
      : {};
  const ratings: VisionRead["ratings"] = {};
  for (const key of ["crust", "crumb", "overall"] as const) {
    const value = ratingValue(ratingsSource[key]);
    if (value !== undefined) ratings[key] = value;
  }

  const confidence: VisionConfidence =
    record.confidence === "low" || record.confidence === "high" ? record.confidence : "medium";

  return {
    summary,
    observations: Array.isArray(record.observations)
      ? record.observations
          .map((item) => cleanText(item, 160))
          .filter(Boolean)
          .slice(0, 6)
      : [],
    tags: normalizeOutcomeTags(record.tags),
    ratings,
    confidence,
    photoCount: meta.photoCount,
    model: meta.model,
    at: meta.at ?? new Date().toISOString(),
  };
}

/**
 * Resolves one photo (inline or a desktop file reference) and shrinks it so it
 * can be attached to a chat turn.
 */
export async function prepareChatPhoto(
  photo: string,
): Promise<{ data: string; mimeType: string }> {
  const source = await resolvePhoto(photo);
  if (!source) {
    throw new BakeSommelierError(
      "empty",
      "That photo could not be opened. In the desktop app, check that its folder is still connected.",
    );
  }
  let scaled: PreparedPhoto | null = null;
  try {
    scaled = await downscalePhoto(source);
  } catch {
    scaled = null;
  }
  if (!scaled) {
    throw new BakeSommelierError("empty", "That photo could not be read. Try a JPEG or PNG.");
  }
  return scaled;
}

/**
 * Reads up to three photos with Gemini vision. Nothing leaves the device until
 * a baker taps the button that calls this.
 */
export async function analyzeBakePhotos(
  photos: string[],
  context: PhotoAnalysisContext = {},
  signal?: AbortSignal,
): Promise<VisionRead> {
  const apiKey = getActiveKey();
  if (!apiKey) {
    throw new BakeSommelierError(
      "missing-key",
      "Add a Gemini API key in the AI panel to read your photos.",
    );
  }
  if (photos.length === 0) {
    throw new BakeSommelierError("empty", "Attach a photo of the bake first.");
  }

  const model = getActiveModel();
  const prepared: PreparedPhoto[] = [];
  for (const photo of photos.slice(0, MAX_VISION_PHOTOS)) {
    const source = await resolvePhoto(photo);
    if (!source) continue;
    try {
      const scaled = await downscalePhoto(source);
      if (scaled) prepared.push(scaled);
    } catch {
      /* skip a photo that will not decode */
    }
  }

  if (prepared.length === 0) {
    throw new BakeSommelierError(
      "empty",
      "None of those photos could be read. Try a JPEG or PNG, or pick another photo.",
    );
  }

  const contextLines = [
    context.bakeName ? `Bake: ${cleanText(context.bakeName, 80)}.` : "",
    context.styleName ? `Style: ${cleanText(context.styleName, 60)}.` : "",
    context.formulaSummary ? `Formula: ${cleanText(context.formulaSummary, 200)}.` : "",
    `${prepared.length} photo${prepared.length === 1 ? "" : "s"} attached, in order.`,
  ].filter(Boolean);

  try {
    const client = await geminiClient(apiKey);
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            ...prepared.map((photo) => ({
              inlineData: { mimeType: photo.mimeType, data: photo.data },
            })),
            { text: `${contextLines.join("\n")}\n\nRead this bake from the photos.` },
          ],
        },
      ],
      config: {
        systemInstruction: { parts: [{ text: VISION_SYSTEM }] },
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
        abortSignal: signal,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new BakeSommelierError(
        "empty",
        response.promptFeedback?.blockReason
          ? "Gemini blocked that photo. Try a different shot."
          : "Gemini returned no photo read. Try again.",
      );
    }
    return parseVisionResult(text, { model, photoCount: prepared.length });
  } catch (error) {
    if (error instanceof BakeSommelierError) throw error;
    if ((error as { name?: string })?.name === "AbortError") {
      throw new BakeSommelierError("stopped", "Photo read stopped.");
    }
    throw geminiError(error, model);
  }
}
