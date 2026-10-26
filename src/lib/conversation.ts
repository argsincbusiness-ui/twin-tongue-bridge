/**
 * Pure helpers for conversation turns: sensitivity presets, translation
 * styles, and transcript export. Kept side-effect free so they are testable.
 */
import { clampPauseSeconds, type PauseSeconds, type Side } from "./duplex";

/* ---------------- Conversation sensitivity ---------------- */

export type Sensitivity = "fast" | "balanced" | "patient";

export const SENSITIVITY_ORDER: Sensitivity[] = ["fast", "balanced", "patient"];

export const SENSITIVITY_PAUSE: Record<Sensitivity, PauseSeconds> = {
  fast: 1,
  balanced: 3,
  patient: 5,
};

export const SENSITIVITY_HINT: Record<Sensitivity, string> = {
  fast: "Sends after 1s of silence — snappy, best in quiet rooms",
  balanced: "Sends after 3s — survives normal thinking pauses",
  patient: "Sends after 5s — for slower or hesitant speakers",
};

export const DEFAULT_SENSITIVITY: Sensitivity = "balanced";

/** Closest preset for an arbitrary pause value (used after VAD calibration). */
export function sensitivityForPause(seconds: number): Sensitivity {
  const s = clampPauseSeconds(seconds);
  if (s <= 1) return "fast";
  if (s >= 4) return "patient";
  return "balanced";
}

/* ---------------- Translation style ---------------- */

export const TRANSLATION_STYLES = [
  "natural",
  "casual",
  "professional",
  "formal",
  "friendly",
  "business",
] as const;
export type TranslationStyle = (typeof TRANSLATION_STYLES)[number];
export const DEFAULT_STYLE: TranslationStyle = "natural";

export function isTranslationStyle(value: string): value is TranslationStyle {
  return (TRANSLATION_STYLES as readonly string[]).includes(value);
}

/* ---------------- Transcript export ---------------- */

export interface ExportTurn {
  side: Side;
  original: string;
  translated: string;
  fromLang: string;
  toLang: string;
  at: number;
  via: "voice" | "typed";
}

export function formatTime(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Plain-text transcript suitable for download, email or messaging. */
export function buildTranscript(turns: ExportTurn[], title = "Neural Duplex conversation"): string {
  const lines: string[] = [title, "=".repeat(title.length), ""];
  for (const t of turns) {
    const who = t.side === "a" ? "Person A" : "Person B";
    lines.push(`[${formatTime(t.at)}] ${who} (${t.via})`);
    lines.push(`  ${t.fromLang}: ${t.original}`);
    lines.push(`  ${t.toLang}: ${t.translated}`);
    lines.push("");
  }
  if (turns.length === 0) lines.push("(no exchanges yet)");
  return lines.join("\n");
}

export function transcriptFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `neural-duplex-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
}

/* ---------------- Live status presentation ---------------- */

export type StatusTone = "listening" | "processing" | "translating" | "speaking" | "paused" | "error";

export const STATUS_DOT: Record<StatusTone, string> = {
  listening: "🟢",
  processing: "🟡",
  translating: "🔵",
  speaking: "🔊",
  paused: "⚪",
  error: "🔴",
};
