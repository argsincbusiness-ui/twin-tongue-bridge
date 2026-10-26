import { describe, expect, it } from "vitest";
import {
  buildPreviewPlan,
  PREVIEW_MAX_MS,
  PREVIEW_MIN_MS,
  PREVIEW_MS_PER_CHAR,
} from "./preview";

describe("buildPreviewPlan — spoken text matches preview text exactly", () => {
  const cases: string[] = [
    "Hola.",
    "¿Cómo estás hoy, amigo?",
    "Hello — this is a longer sentence used to exercise the upper preview bound.",
    "你好，今天怎么样？",
    "Line 1\nLine 2\twith tabs.",
    "  leading and trailing spaces  ",
    "Mixed 123 numbers, $9.99 prices, emoji 🎉 and slang yo what's good fam",
  ];

  for (const translated of cases) {
    it(`preview === spoken for: ${JSON.stringify(translated)}`, () => {
      const plan = buildPreviewPlan({ translated });
      // Strict equality + same reference: nothing mutates the string
      // between the on-screen preview and the TTS payload.
      expect(plan.previewText).toBe(translated);
      expect(plan.spokenText).toBe(translated);
      expect(plan.spokenText).toStrictEqual(plan.previewText);
      expect(Object.is(plan.previewText, plan.spokenText)).toBe(true);
    });
  }

  it("clamps the preview pause to the documented minimum", () => {
    const plan = buildPreviewPlan({ translated: "Hi" });
    expect(plan.previewMs).toBe(PREVIEW_MIN_MS);
  });

  it("clamps the preview pause to the documented maximum", () => {
    const plan = buildPreviewPlan({ translated: "x".repeat(500) });
    expect(plan.previewMs).toBe(PREVIEW_MAX_MS);
  });

  it("scales linearly between bounds", () => {
    const len = 40;
    const plan = buildPreviewPlan({ translated: "y".repeat(len) });
    const expected = Math.min(
      PREVIEW_MAX_MS,
      Math.max(PREVIEW_MIN_MS, len * PREVIEW_MS_PER_CHAR),
    );
    expect(plan.previewMs).toBe(expected);
  });

  it("rejects an empty translation via the output schema", () => {
    expect(() => buildPreviewPlan({ translated: "" })).toThrow();
  });
});
