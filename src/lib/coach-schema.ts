import { z } from "zod";

/** Bounds shared with the translate function's language fields. */
export const COACH_LANG_MAX = 35;

/** Input accepted by the Learning Mode coach server function. */
export const CoachInputSchema = z.object({
  original: z.string().min(1).max(10000),
  translation: z.string().min(1).max(10000),
  sourceLang: z.string().min(2).max(COACH_LANG_MAX),
  targetLang: z.string().min(2).max(COACH_LANG_MAX),
});
export type CoachInput = z.infer<typeof CoachInputSchema>;

/** A single vocabulary item surfaced after a completed turn. */
export const VocabItemSchema = z.object({
  term: z.string().min(1).max(80),
  meaning: z.string().min(1).max(200),
});
export type VocabItem = z.infer<typeof VocabItemSchema>;

/** Learning Mode payload rendered under a completed turn. */
export const CoachOutputSchema = z.object({
  /** A more natural / idiomatic way to say the same thing. */
  natural: z.string().max(400).default(""),
  /** Simple phonetic guide for the translated sentence. */
  pronunciation: z.string().max(400).default(""),
  /** Up to four useful words or phrases from the exchange. */
  vocab: z.array(VocabItemSchema).max(4).default([]),
  /** One short usage or culture tip. */
  tip: z.string().max(300).default(""),
});
export type CoachOutput = z.infer<typeof CoachOutputSchema>;

/**
 * Parse the coach model reply, tolerating markdown fences and partial
 * objects. Returns null when nothing usable came back, so the caller can
 * silently skip the learning card instead of breaking the conversation.
 */
export function parseCoachResponse(raw: string): CoachOutput | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = CoachOutputSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) return null;
    const out = parsed.data;
    if (!out.natural && !out.pronunciation && !out.tip && out.vocab.length === 0) return null;
    return out;
  } catch {
    return null;
  }
}
