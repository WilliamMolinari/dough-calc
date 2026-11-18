import { sanitizeFormula } from "./formula";
import type { Formula, Unit } from "./types";

const SHARE_VERSION = 1;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(code: string): string {
  const padded = code.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShare(formula: Formula, unit: Unit): string {
  return toBase64Url(JSON.stringify({ v: SHARE_VERSION, u: unit, f: sanitizeFormula(formula) }));
}

export function decodeShare(code: string): { formula: Formula; unit: Unit } | null {
  if (!code || code.length > 4000) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(code)) as {
      v?: number;
      u?: string;
      f?: unknown;
    };
    if (parsed.v !== SHARE_VERSION) return null;
    return {
      formula: sanitizeFormula(parsed.f),
      unit: parsed.u === "oz" ? "oz" : "g",
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(formula: Formula, unit: Unit): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("f", encodeShare(formula, unit));
  return url.toString();
}

/** Reads a shared formula from ?f=, then removes it from the address bar. */
export function readShareFromLocation(): { formula: Formula; unit: Unit } | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("f");
  if (!code) return null;
  const decoded = decodeShare(code);
  if (decoded) {
    url.searchParams.delete("f");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
  return decoded;
}
