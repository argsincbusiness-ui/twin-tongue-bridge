/**
 * Pure logic for Duplex Talk continuous conversation mode.
 *
 * Everything in this module is side-effect free so the state machine and its
 * edge cases (empty utterances, duplicate turns, rapid switching, pause
 * threshold clamping) can be unit-tested without a browser or React tree.
 */

/** Selectable end-of-utterance silence thresholds, in seconds. */
export const PAUSE_OPTIONS = [1, 2, 3, 4, 5] as const;
export type PauseSeconds = (typeof PAUSE_OPTIONS)[number];

/** Recommended default: long enough to survive mid-sentence thinking pauses. */
export const DEFAULT_PAUSE_SECONDS: PauseSeconds = 3;

/**
 * How long a gap must last before the UI hints "waiting for you to finish".
 * Purely cosmetic — finalization still happens at the configured threshold.
 */
export const PAUSE_HINT_MS = 650;

/**
 * Delay between the end of TTS playback and re-opening the microphone, so the
 * audio device fully releases and the tail of the utterance is not captured.
 */
export const ECHO_GUARD_MS = 450;

/** A repeat of the same utterance inside this window is treated as a duplicate. */
export const DUPLICATE_WINDOW_MS = 4000;

/** Utterances shorter than this (after normalizing) are treated as noise. */
export const MIN_UTTERANCE_CHARS = 2;

export type Side = "a" | "b";

export type DuplexPhase =
  | "idle"
  | "listening"
  | "waiting"
  | "translating"
  | "speaking"
  | "switching"
  | "error";

/** The other participant in the conversation. */
export function otherSide(side: Side): Side {
  return side === "a" ? "b" : "a";
}

/** Coerce arbitrary input to one of the supported pause thresholds. */
export function clampPauseSeconds(value: number): PauseSeconds {
  if (!Number.isFinite(value)) return DEFAULT_PAUSE_SECONDS;
  const rounded = Math.round(value);
  if (rounded <= PAUSE_OPTIONS[0]) return PAUSE_OPTIONS[0];
  const last = PAUSE_OPTIONS[PAUSE_OPTIONS.length - 1]!;
  if (rounded >= last) return last;
  return rounded as PauseSeconds;
}

/** Milliseconds of trailing silence that finalize an utterance. */
export function pauseMs(seconds: number): number {
  return clampPauseSeconds(seconds) * 1000;
}

/**
 * Collapse whitespace so recogniser padding never changes the comparison or
 * the text that reaches the translator.
 */
export function normalizeUtterance(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Comparison key for duplicate detection: case- and punctuation-insensitive. */
export function utteranceKey(text: string): string {
  return normalizeUtterance(text)
    .toLowerCase()
    .replace(/[.,!?;:'"¡¿。、！？]/g, "");
}

/**
 * True when the text carries enough signal to be worth a translation call.
 * Filters out empty finals, stray punctuation and single stray characters.
 */
export function isMeaningfulUtterance(text: string): boolean {
  const normalized = normalizeUtterance(text);
  if (normalized.length < MIN_UTTERANCE_CHARS) return false;
  // Must contain at least one letter or ideograph in any script.
  return /[\p{L}\p{N}]/u.test(normalized);
}

export interface LastTurn {
  key: string;
  at: number;
}

/**
 * Guard against the recogniser (or a mic echo) delivering the same sentence
 * twice in a row within a short window.
 */
export function isDuplicateUtterance(
  previous: LastTurn | null,
  text: string,
  now: number,
  windowMs: number = DUPLICATE_WINDOW_MS,
): boolean {
  if (!previous) return false;
  if (now - previous.at > windowMs) return false;
  return previous.key === utteranceKey(text);
}

/**
 * Decide what to do with a finalized utterance. Centralized so the UI, the
 * hook and the tests all agree on the rules.
 */
export type UtteranceDecision = "accept" | "ignore-empty" | "ignore-duplicate" | "ignore-busy";

export function decideUtterance(input: {
  text: string;
  phase: DuplexPhase;
  previous: LastTurn | null;
  now: number;
}): UtteranceDecision {
  if (!isMeaningfulUtterance(input.text)) return "ignore-empty";
  if (input.phase !== "listening" && input.phase !== "waiting") return "ignore-busy";
  if (isDuplicateUtterance(input.previous, input.text, input.now)) return "ignore-duplicate";
  return "accept";
}

/** Human-readable live state shown under the orb. */
export function phaseLabel(
  phase: DuplexPhase,
  ctx: { speakerLabel: string; nextSpeakerLabel: string },
): string {
  switch (phase) {
    case "idle":
      return "Tap start to begin the conversation";
    case "listening":
      return `Listening to ${ctx.speakerLabel}`;
    case "waiting":
      return "Waiting for you to finish…";
    case "translating":
      return "Translating…";
    case "speaking":
      return "Speaking translation";
    case "switching":
      return `Listening for ${ctx.nextSpeakerLabel}`;
    case "error":
      return "Conversation paused";
  }
}

/** Short caption describing what happens next, for the secondary line. */
export function phaseHint(phase: DuplexPhase, seconds: number): string {
  switch (phase) {
    case "listening":
      return `Speak naturally — pauses under ${clampPauseSeconds(seconds)}s won't cut you off`;
    case "waiting":
      return "Keep going, or stay quiet to send";
    case "translating":
      return "Finding the most natural phrasing";
    case "speaking":
      return "Microphone muted to avoid echo";
    case "switching":
      return "Handing the mic over";
    case "idle":
      return "Continuous mode: both sides, hands-free";
    case "error":
      return "Fix the issue above, then resume";
  }
}

/** Classify a Web Speech / getUserMedia error into a user-facing message. */
export function describeSpeechError(code: string): { message: string; fatal: boolean } {
  switch (code) {
    case "not-allowed":
    case "NotAllowedError":
    case "permission-denied":
    case "SecurityError":
      return {
        message:
          "Microphone access was blocked. Allow the mic in your browser's site settings, then start again.",
        fatal: true,
      };
    case "audio-capture":
    case "NotFoundError":
      return {
        message: "No microphone was found. Connect one and start again.",
        fatal: true,
      };
    case "NotReadableError":
      return {
        message: "The microphone is being used by another app. Close it and start again.",
        fatal: true,
      };
    case "service-not-allowed":
      return {
        message: "Speech recognition is unavailable on this browser. Try Chrome or Safari.",
        fatal: true,
      };
    case "network":
      return {
        message: "Speech service lost its network connection. Reconnect and start again.",
        fatal: true,
      };
    case "no-speech":
      return { message: "Didn't catch that — still listening.", fatal: false };
    case "aborted":
      return { message: "", fatal: false };
    default:
      return { message: `Microphone error: ${code}`, fatal: false };
  }
}
