import { describe, expect, it } from "vitest";
import {
  LANG_MAX,
  LANG_MIN,
  TranslateInputSchema,
  TranslateOutputSchema,
} from "./translate.functions";
import { parseAutoResponse } from "./translate-parse";

const validInput = {
  text: "Hello, how are you?",
  sourceLang: "English",
  targetLang: "Spanish",
};

describe("TranslateInputSchema — language fields", () => {
  it("accepts well-formed language names and BCP-47 tags", () => {
    expect(() => TranslateInputSchema.parse(validInput)).not.toThrow();
    expect(() =>
      TranslateInputSchema.parse({ ...validInput, sourceLang: "en-US", targetLang: "zh-Hant-HK" }),
    ).not.toThrow();
  });

  it("rejects sourceLang shorter than LANG_MIN", () => {
    const tooShort = "x".repeat(LANG_MIN - 1);
    const result = TranslateInputSchema.safeParse({ ...validInput, sourceLang: tooShort });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "sourceLang")).toBe(true);
    }
  });

  it("rejects targetLang longer than LANG_MAX", () => {
    const tooLong = "y".repeat(LANG_MAX + 1);
    const result = TranslateInputSchema.safeParse({ ...validInput, targetLang: tooLong });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "targetLang")).toBe(true);
    }
  });

  it("rejects non-string language fields", () => {
    expect(
      TranslateInputSchema.safeParse({ ...validInput, sourceLang: 42 as unknown as string })
        .success,
    ).toBe(false);
    expect(
      TranslateInputSchema.safeParse({ ...validInput, targetLang: null as unknown as string })
        .success,
    ).toBe(false);
  });

  it("rejects empty text and over-long text", () => {
    expect(TranslateInputSchema.safeParse({ ...validInput, text: "" }).success).toBe(false);
    expect(
      TranslateInputSchema.safeParse({ ...validInput, text: "a".repeat(10001) }).success,
    ).toBe(false);
  });

  it("accepts an optional history array up to 20 entries", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      from: "en",
      to: "es",
      original: `o${i}`,
      translated: `t${i}`,
    }));
    expect(TranslateInputSchema.safeParse({ ...validInput, history }).success).toBe(true);

    history.push({ from: "en", to: "es", original: "overflow", translated: "overflow" });
    expect(TranslateInputSchema.safeParse({ ...validInput, history }).success).toBe(false);
  });
});

describe("TranslateOutputSchema — quality-check output", () => {
  it("accepts a non-empty translated string", () => {
    expect(TranslateOutputSchema.parse({ translated: "Hola" })).toEqual({ translated: "Hola" });
  });

  it("rejects an empty translated string", () => {
    expect(TranslateOutputSchema.safeParse({ translated: "" }).success).toBe(false);
  });

  it("rejects missing or wrong-typed translated field", () => {
    expect(TranslateOutputSchema.safeParse({}).success).toBe(false);
    expect(
      TranslateOutputSchema.safeParse({ translated: 123 as unknown as string }).success,
    ).toBe(false);
  });

  it("strips unknown keys it does not declare", () => {
    const parsed = TranslateOutputSchema.parse({ translated: "Hola", extra: "nope" } as unknown);
    expect(parsed).toEqual({ translated: "Hola" });
    expect((parsed as Record<string, unknown>).extra).toBeUndefined();
  });
});

describe("auto-detect source", () => {
  it("accepts 'auto' as the source language", () => {
    expect(TranslateInputSchema.safeParse({ ...validInput, sourceLang: "auto" }).success).toBe(
      true,
    );
  });

  it("accepts an optional detectedLang on the output", () => {
    expect(
      TranslateOutputSchema.parse({ translated: "Hello", detectedLang: "Spanish" }),
    ).toEqual({ translated: "Hello", detectedLang: "Spanish" });
    expect(TranslateOutputSchema.safeParse({ translated: "Hi", detectedLang: "" }).success).toBe(
      false,
    );
  });

  it("parses the strict-JSON auto reply, with or without fences", () => {
    expect(parseAutoResponse('{"detectedLang":"Zulu","translated":"Hello"}')).toEqual({
      detectedLang: "Zulu",
      translated: "Hello",
    });
    expect(
      parseAutoResponse('```json\n{"detectedLang":"Zulu","translated":"Hello"}\n```'),
    ).toEqual({ detectedLang: "Zulu", translated: "Hello" });
    expect(parseAutoResponse("just plain text")).toBeNull();
    expect(parseAutoResponse('{"translated":""}')).toBeNull();
  });

  it("rejects malformed JSON and empty detectedLang", () => {
    expect(parseAutoResponse('{"detectedLang":"","translated":"Hello"}')).toEqual({
      translated: "Hello",
    });
    expect(parseAutoResponse('{"detectedLang":"  ","translated":"Hello"}')).toEqual({
      translated: "Hello",
    });
    expect(parseAutoResponse('{"detectedLang":"Spanish"}')).toBeNull();
    expect(parseAutoResponse("not json at all")).toBeNull();
    expect(parseAutoResponse('{"translated":"   "}')).toBeNull();
  });

  it("truncates overly long detectedLang names", () => {
    const long = "a".repeat(100);
    const parsed = parseAutoResponse(`{"detectedLang":"${long}","translated":"Hi"}`);
    expect(parsed?.detectedLang).toBe(long.slice(0, 35));
  });
});

