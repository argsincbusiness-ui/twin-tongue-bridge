import { describe, expect, it } from "vitest";
import { CoachInputSchema, CoachOutputSchema, parseCoachResponse } from "./coach-schema";
import { buildCoachPrompt } from "./coach.server";

describe("coach input validation", () => {
  it("accepts a realistic turn", () => {
    expect(
      CoachInputSchema.safeParse({
        original: "How much does this cost?",
        translation: "¿Cuánto cuesta esto?",
        sourceLang: "English (US)",
        targetLang: "Spanish (Mexico)",
      }).success,
    ).toBe(true);
  });

  it("rejects empty text and over-long language names", () => {
    expect(
      CoachInputSchema.safeParse({
        original: "",
        translation: "x",
        sourceLang: "English",
        targetLang: "Spanish",
      }).success,
    ).toBe(false);
    expect(
      CoachInputSchema.safeParse({
        original: "a",
        translation: "b",
        sourceLang: "E".repeat(40),
        targetLang: "Spanish",
      }).success,
    ).toBe(false);
  });
});

describe("coach response parsing", () => {
  it("parses strict JSON", () => {
    const out = parseCoachResponse(
      '{"natural":"¿Cuánto vale?","pronunciation":"KWAN-toh VA-leh","vocab":[{"term":"cuánto","meaning":"how much"}],"tip":"Casual in shops."}',
    );
    expect(out?.natural).toBe("¿Cuánto vale?");
    expect(out?.vocab[0]?.term).toBe("cuánto");
  });

  it("tolerates markdown fences", () => {
    const out = parseCoachResponse('```json\n{"natural":"Hola","vocab":[],"tip":""}\n```');
    expect(out?.natural).toBe("Hola");
    expect(out?.pronunciation).toBe("");
  });

  it("returns null for prose, broken JSON and empty payloads", () => {
    expect(parseCoachResponse("Sure! Here are some tips.")).toBeNull();
    expect(parseCoachResponse("{oops")).toBeNull();
    expect(parseCoachResponse('{"natural":"","pronunciation":"","vocab":[],"tip":""}')).toBeNull();
  });

  it("caps vocabulary at four items", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ term: `t${i}`, meaning: "m" }));
    expect(CoachOutputSchema.safeParse({ vocab: five }).success).toBe(false);
  });
});

describe("coach prompt", () => {
  it("names both languages and includes the sentences", () => {
    const { system, user } = buildCoachPrompt({
      original: "Where is the station?",
      translation: "Wo ist der Bahnhof?",
      sourceLang: "English (US)",
      targetLang: "German (Germany)",
    });
    expect(system).toContain("German (Germany)");
    expect(system).toContain("strict JSON");
    expect(user).toContain("Where is the station?");
    expect(user).toContain("Wo ist der Bahnhof?");
  });
});
