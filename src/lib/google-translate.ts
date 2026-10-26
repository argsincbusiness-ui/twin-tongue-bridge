import { findLanguageByName } from "./languages";

/**
 * Convert a language name used by the UI (e.g. "Spanish (Mexico)") into the
 * language code Google Cloud Translation expects (e.g. "es").
 * Returns null when the value means "detect automatically".
 */
export function toGoogleCode(nameOrCode: string): string | null {
  const raw = nameOrCode.trim();
  if (!raw || raw.toLowerCase() === "auto") return null;

  const lang = findLanguageByName(raw);
  const code = lang?.code ?? raw;
  const base = (lang?.base ?? raw.split("-")[0] ?? raw).toLowerCase();

  if (base === "zh") {
    return code.toLowerCase() === "zh-tw" || code.toLowerCase() === "zh-hk"
      ? "zh-TW"
      : "zh-CN";
  }
  if (base === "pt") return code.toLowerCase() === "pt-pt" ? "pt-PT" : "pt";
  if (base === "no") return "no";
  if (base === "he" || base === "iw") return "iw";
  if (base === "fil" || base === "tl") return "tl";
  return base;
}

/** Turn a detected Google language code into an English language name. */
export function detectedCodeToName(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const normalized = code === "iw" ? "he" : code;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    const name = dn.of(normalized);
    if (name && name.toLowerCase() !== normalized.toLowerCase()) return name;
  } catch {
    /* fall through to the raw code */
  }
  return code;
}

/** Decode the HTML entities Google returns in translated text. */
export function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    "#39": "'",
    nbsp: " ",
  };
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity in named) return named[entity]!;
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return match;
  });
}
