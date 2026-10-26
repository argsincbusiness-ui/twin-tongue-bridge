/** Max length kept for a detected language name. */
export const DETECTED_LANG_MAX = 35;

/**
 * Parse the strict-JSON auto-detect reply, tolerating markdown fences.
 * Returns null when the model replied with plain text instead.
 */
export function parseAutoResponse(
  raw: string,
): { translated: string; detectedLang?: string } | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as { translated?: unknown; detectedLang?: unknown };
    const translated = typeof obj.translated === "string" ? obj.translated.trim() : "";
    if (!translated) return null;
    const detected =
      typeof obj.detectedLang === "string" && obj.detectedLang.trim()
        ? obj.detectedLang.trim().slice(0, DETECTED_LANG_MAX)
        : undefined;
    return detected ? { translated, detectedLang: detected } : { translated };
  } catch {
    return null;
  }
}
