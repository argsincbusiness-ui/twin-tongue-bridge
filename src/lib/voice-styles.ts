/**
 * Shared voice + style configuration used by EVERY screen that produces
 * speech. One global preference (persisted in localStorage, synced across
 * components and tabs) drives all speech generation.
 *
 * Add a new style later by appending one entry to VOICE_STYLES — nothing
 * else needs to change.
 */

export interface VoiceOption {
  id: string;
  label: string;
}

export interface VoiceStyle {
  id: string;
  label: string;
  description: string;
  /** Delivery instruction sent to the TTS model. Never spoken aloud. */
  instruction: string;
  /** Relative playback speed applied by the shared speak() function. */
  speed: number;
  /** Voice the UI nudges towards when this style is chosen. */
  suggestedVoice: string;
  /**
   * Optional list of language base codes ("en", "zu", …) this style works
   * with. Omit to support every language. When set and the current
   * language is missing, resolveVoiceStyle falls back to the closest
   * working style and reports a notice.
   */
  languages?: string[];
  /** Optional wording used when the style shapes singing (Sing It). */
  singHint?: string;
}

/** The existing neural voices, unchanged. */
export const VOICES: VoiceOption[] = [
  { id: "alloy", label: "Alloy — balanced" },
  { id: "echo", label: "Echo — upbeat male" },
  { id: "fable", label: "Fable — storyteller" },
  { id: "onyx", label: "Onyx — deep male" },
  { id: "nova", label: "Nova — bright female" },
  { id: "shimmer", label: "Shimmer — calm" },
];

export const DEFAULT_VOICE = "alloy";

/** One config array: add an entry here to add a style everywhere. */
export const VOICE_STYLES: VoiceStyle[] = [
  {
    id: "standard",
    label: "Standard",
    description: "The app's natural default delivery.",
    instruction: "Speak naturally with clear, neutral delivery.",
    speed: 1,
    suggestedVoice: "alloy",
  },
  {
    id: "professional",
    label: "Professional",
    description: "Clear, confident, polished.",
    instruction: "Speak in a clear, confident, polished professional tone.",
    speed: 1,
    suggestedVoice: "onyx",
  },
  {
    id: "serious",
    label: "Serious",
    description: "Grave, measured, slow.",
    instruction: "Speak in a grave, measured, deliberate tone, slowly and with weight.",
    speed: 0.9,
    suggestedVoice: "onyx",
  },
  {
    id: "newsreader",
    label: "Newsreader",
    description: "Authoritative, crisp, broadcast style.",
    instruction: "Speak like a broadcast news anchor: authoritative, crisp and precise.",
    speed: 1.02,
    suggestedVoice: "echo",
  },
  {
    id: "political",
    label: "Political",
    description: "Persuasive, passionate, rallying.",
    instruction:
      "Speak like a passionate political orator: persuasive and rallying, with strong emphasis and deliberate pauses.",
    speed: 1,
    suggestedVoice: "onyx",
  },
  {
    id: "humor",
    label: "Humor",
    description: "Playful, upbeat, comedic timing.",
    instruction: "Speak playfully and upbeat, with light comedic timing.",
    speed: 1.05,
    suggestedVoice: "shimmer",
  },
  {
    id: "deadpan",
    label: "Joking / Deadpan",
    description: "Dry, straight-faced, perfectly timed pauses.",
    instruction: "Speak dry and deadpan, straight-faced, with perfectly timed pauses for comic effect.",
    speed: 0.98,
    suggestedVoice: "fable",
  },
  {
    id: "storyteller",
    label: "Storyteller",
    description: "Warm, expressive, dramatic pacing.",
    instruction: "Speak like a warm, expressive storyteller with dramatic pacing.",
    speed: 0.98,
    suggestedVoice: "fable",
    singHint: "warm, expressive storytelling delivery",
  },
  {
    id: "calm",
    label: "Calm / Soothing",
    description: "Soft, slow, relaxing.",
    instruction: "Speak softly, slowly and soothingly, like a relaxing meditation guide.",
    speed: 0.85,
    suggestedVoice: "shimmer",
    singHint: "soft, soothing delivery",
  },
  {
    id: "energetic",
    label: "Energetic / Hype",
    description: "Fast, high energy.",
    instruction: "Speak fast, with high energy and excitement, like a hype announcer.",
    speed: 1.15,
    suggestedVoice: "echo",
    singHint: "high-energy, upbeat delivery",
  },
  {
    id: "friendly",
    label: "Friendly / Casual",
    description: "Relaxed, conversational.",
    instruction: "Speak in a relaxed, friendly, conversational tone, like chatting with a friend.",
    speed: 1,
    suggestedVoice: "nova",
    singHint: "casual, relaxed delivery",
  },
];

export const DEFAULT_STYLE_ID = VOICE_STYLES[0].id;

/* ---------------- global preference store ---------------- */

export interface VoicePrefs {
  voice: string;
  styleId: string;
}

const STORAGE_KEY = "nd-voice-prefs";

function isValidPrefs(value: unknown): value is VoicePrefs {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<VoicePrefs>;
  return (
    typeof v.voice === "string" && VOICES.some((o) => o.id === v.voice) &&
    typeof v.styleId === "string" && VOICE_STYLES.some((s) => s.id === v.styleId)
  );
}

function loadPrefs(): VoicePrefs {
  const fallback: VoicePrefs = { voice: DEFAULT_VOICE, styleId: DEFAULT_STYLE_ID };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValidPrefs(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

let current: VoicePrefs = loadPrefs();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable — in-memory only */
  }
}

/** Snapshot for useSyncExternalStore — a stable object between changes. */
export function getVoicePrefs(): VoicePrefs {
  return current;
}

export function subscribeVoicePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Update the global voice and/or style. Applies to every screen. */
export function setVoicePrefs(update: Partial<VoicePrefs>): void {
  const next: VoicePrefs = {
    voice: update.voice && VOICES.some((o) => o.id === update.voice) ? update.voice : current.voice,
    styleId:
      update.styleId && VOICE_STYLES.some((s) => s.id === update.styleId)
        ? update.styleId
        : current.styleId,
  };
  if (next.voice === current.voice && next.styleId === current.styleId) return;
  current = next;
  persist();
  listeners.forEach((l) => l());
}

/* ---------------- resolution ---------------- */

export function getStyle(id?: string): VoiceStyle {
  return VOICE_STYLES.find((s) => s.id === id) ?? VOICE_STYLES[0];
}

export function isVoice(id: string): boolean {
  return VOICES.some((o) => o.id === id);
}

/** Two-letter base code from a BCP-47 tag ("zu-ZA" → "zu"). */
function baseCode(lang: string): string {
  return (lang || "").split(/[-_]/)[0]?.toLowerCase() ?? "";
}

function styleSupports(style: VoiceStyle, lang: string): boolean {
  if (!style.languages) return true;
  return style.languages.includes(baseCode(lang));
}

/** Closest working style for a language: smallest speed difference wins. */
function closestStyle(style: VoiceStyle, lang: string): VoiceStyle | null {
  const working = VOICE_STYLES.filter(
    (s) => s.id !== style.id && styleSupports(s, lang),
  );
  if (working.length === 0) return null;
  return working.reduce((best, s) =>
    Math.abs(s.speed - style.speed) < Math.abs(best.speed - style.speed) ? s : best,
  );
}

export interface ResolvedVoice {
  voice: string;
  style: VoiceStyle;
  /** Set when the chosen style can't serve this language and we fell back. */
  notice?: string;
}

/**
 * Resolve the effective voice + style for a language, honouring the global
 * preference and falling back (with a notice) when the chosen style does
 * not support the language.
 */
export function resolveVoiceStyle(lang: string, prefs: VoicePrefs = current): ResolvedVoice {
  const chosen = getStyle(prefs.styleId);
  if (styleSupports(chosen, lang)) return { voice: prefs.voice, style: chosen };
  const fallback = closestStyle(chosen, lang) ?? VOICE_STYLES[0];
  return {
    voice: prefs.voice,
    style: fallback,
    notice: `${chosen.label} style isn't available for this language — using ${fallback.label}.`,
  };
}

/**
 * Build the request body for POST /api/tts from the global preference (or
 * explicit overrides). Used by speak(), Studio synthesis and audio-file
 * exports so every path applies the same voice + style.
 */
export function ttsRequestBody(
  text: string,
  lang: string,
  voiceOverride?: string,
  styleOverride?: string,
): { text: string; lang: string; voice: string; instructions: string } {
  const style = getStyle(styleOverride ?? current.styleId);
  const voice =
    voiceOverride && isVoice(voiceOverride) ? voiceOverride : current.voice;
  return { text, lang, voice, instructions: style.instruction };
}
