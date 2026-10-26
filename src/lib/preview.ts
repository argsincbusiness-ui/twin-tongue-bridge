/**
 * Pure helpers for the "preview then speak" flow.
 *
 * The translated text shown on the listener's panel as a preview MUST be
 * byte-identical to the text passed to the TTS engine. This module is the
 * single source of truth so the invariant can be unit-tested without
 * needing to render the whole React tree.
 */

import { TranslateOutputSchema, type TranslateOutput } from "./translate.functions";

export interface PreviewPlan {
  /** Exact text rendered on screen as the preview. */
  previewText: string;
  /** Exact text passed to the TTS engine. Always equal to {@link previewText}. */
  spokenText: string;
  /** How long to display the preview before starting playback (ms). */
  previewMs: number;
}

/** Min/max bounds for the preview pause, in milliseconds. */
export const PREVIEW_MIN_MS = 600;
export const PREVIEW_MAX_MS = 1800;
/** Per-character contribution to the preview pause. */
export const PREVIEW_MS_PER_CHAR = 25;

/**
 * Build a {@link PreviewPlan} from a validated translation result.
 *
 * Throws via Zod if `result` does not satisfy {@link TranslateOutputSchema}
 * — callers can rely on the returned strings being non-empty.
 */
export function buildPreviewPlan(result: TranslateOutput): PreviewPlan {
  const { translated } = TranslateOutputSchema.parse(result);
  const previewMs = Math.min(
    PREVIEW_MAX_MS,
    Math.max(PREVIEW_MIN_MS, translated.length * PREVIEW_MS_PER_CHAR),
  );
  // Intentionally share the SAME reference so any future drift fails the
  // invariant tests rather than silently desyncing UI and audio.
  return { previewText: translated, spokenText: translated, previewMs };
}
