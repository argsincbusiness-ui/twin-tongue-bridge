import { describe, expect, it } from "vitest";
import {
  AUTO_CODE,
  AUTO_LANGUAGE,
  LANGUAGES,
  findLanguageByName,
  getLanguage,
  isAutoLang,
} from "./languages";

describe("languages", () => {
  it("identifies the auto-detect sentinel", () => {
    expect(isAutoLang(AUTO_CODE)).toBe(true);
    expect(isAutoLang("en-US")).toBe(false);
  });

  it("returns the auto pseudo-language for the sentinel code", () => {
    expect(getLanguage(AUTO_CODE)).toBe(AUTO_LANGUAGE);
  });

  it("falls back to English for unknown codes", () => {
    expect(getLanguage("xx-XX").code).toBe("en-US");
  });

  it("finds languages by English name, native name, base or full code", () => {
    expect(findLanguageByName("Spanish")?.code).toBe("es-ES");
    expect(findLanguageByName("Español")?.code).toBe("es-ES");
    expect(findLanguageByName("es")?.code).toBe("es-ES");
    expect(findLanguageByName("es-ES")?.code).toBe("es-ES");
    expect(findLanguageByName("  es-ES  ")?.code).toBe("es-ES");
  });

  it("returns undefined for empty or unknown language names", () => {
    expect(findLanguageByName("")).toBeUndefined();
    expect(findLanguageByName("   ")).toBeUndefined();
    expect(findLanguageByName("Klingon")).toBeUndefined();
  });

  it("every language has a unique code", () => {
    const codes = new Set(LANGUAGES.map((l) => l.code));
    expect(codes.size).toBe(LANGUAGES.length);
  });
});
