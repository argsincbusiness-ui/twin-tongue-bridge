import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAUSE_SECONDS,
  PAUSE_OPTIONS,
  clampPauseSeconds,
  decideUtterance,
  describeSpeechError,
  isDuplicateUtterance,
  isMeaningfulUtterance,
  normalizeUtterance,
  otherSide,
  pauseMs,
  phaseHint,
  phaseLabel,
  utteranceKey,
  type DuplexPhase,
} from "./duplex";

describe("pause threshold", () => {
  it("offers exactly 1-5 seconds with 3 as the default", () => {
    expect([...PAUSE_OPTIONS]).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_PAUSE_SECONDS).toBe(3);
  });

  it("clamps out-of-range and invalid values", () => {
    expect(clampPauseSeconds(0)).toBe(1);
    expect(clampPauseSeconds(-4)).toBe(1);
    expect(clampPauseSeconds(9)).toBe(5);
    expect(clampPauseSeconds(2.4)).toBe(2);
    expect(clampPauseSeconds(Number.NaN)).toBe(3);
  });

  it("converts to milliseconds", () => {
    expect(pauseMs(3)).toBe(3000);
    expect(pauseMs(1)).toBe(1000);
    expect(pauseMs(99)).toBe(5000);
  });
});

describe("utterance hygiene", () => {
  it("normalizes whitespace", () => {
    expect(normalizeUtterance("  hello   there \n")).toBe("hello there");
  });

  it("rejects empty and noise-only utterances", () => {
    for (const junk of ["", "   ", ".", "?", "…", "-"]) {
      expect(isMeaningfulUtterance(junk)).toBe(false);
    }
  });

  it("accepts real speech in any script", () => {
    for (const text of ["hi", "bonjour", "你好", "مرحبا", "Sawubona"]) {
      expect(isMeaningfulUtterance(text)).toBe(true);
    }
  });

  it("ignores case and punctuation when comparing turns", () => {
    expect(utteranceKey("Good morning!")).toBe(utteranceKey("good morning"));
  });
});

describe("duplicate turn guard", () => {
  const prev = { key: utteranceKey("good morning"), at: 1_000 };

  it("blocks the same phrase inside the window", () => {
    expect(isDuplicateUtterance(prev, "Good morning!", 2_000)).toBe(true);
  });

  it("allows the same phrase after the window", () => {
    expect(isDuplicateUtterance(prev, "Good morning!", 20_000)).toBe(false);
  });

  it("allows different phrases and a first turn", () => {
    expect(isDuplicateUtterance(prev, "good evening", 1_500)).toBe(false);
    expect(isDuplicateUtterance(null, "anything", 1_500)).toBe(false);
  });
});

describe("decideUtterance", () => {
  const base = { previous: null, now: 5_000 };

  it("accepts real speech while listening or waiting", () => {
    expect(decideUtterance({ ...base, text: "hello", phase: "listening" })).toBe("accept");
    expect(decideUtterance({ ...base, text: "hello", phase: "waiting" })).toBe("accept");
  });

  it("drops empty utterances", () => {
    expect(decideUtterance({ ...base, text: "  ", phase: "listening" })).toBe("ignore-empty");
  });

  it("drops results that arrive while translating or speaking (TTS echo)", () => {
    for (const phase of ["translating", "speaking", "switching", "idle"] as DuplexPhase[]) {
      expect(decideUtterance({ ...base, text: "hello", phase })).toBe("ignore-busy");
    }
  });

  it("drops an immediate repeat of the previous turn", () => {
    expect(
      decideUtterance({
        text: "Good morning",
        phase: "listening",
        previous: { key: utteranceKey("good morning"), at: 4_000 },
        now: 5_000,
      }),
    ).toBe("ignore-duplicate");
  });
});

describe("state machine labels", () => {
  const ctx = { speakerLabel: "Speaker A", nextSpeakerLabel: "Speaker B" };

  it("names every live state", () => {
    expect(phaseLabel("listening", ctx)).toBe("Listening to Speaker A");
    expect(phaseLabel("waiting", ctx)).toBe("Waiting for you to finish…");
    expect(phaseLabel("translating", ctx)).toBe("Translating…");
    expect(phaseLabel("speaking", ctx)).toBe("Speaking translation");
    expect(phaseLabel("switching", ctx)).toBe("Listening for Speaker B");
  });

  it("gives a hint for every phase", () => {
    const phases: DuplexPhase[] = [
      "idle",
      "listening",
      "waiting",
      "translating",
      "speaking",
      "switching",
      "error",
    ];
    for (const p of phases) {
      expect(phaseHint(p, 3).length).toBeGreaterThan(0);
      expect(phaseLabel(p, ctx).length).toBeGreaterThan(0);
    }
  });

  it("mentions the active threshold while listening", () => {
    expect(phaseHint("listening", 5)).toContain("5s");
  });

  it("alternates sides", () => {
    expect(otherSide("a")).toBe("b");
    expect(otherSide("b")).toBe("a");
  });
});

describe("speech error mapping", () => {
  it("treats permission and hardware problems as fatal", () => {
    for (const code of ["not-allowed", "NotAllowedError", "audio-capture", "NotFoundError", "NotReadableError", "service-not-allowed"]) {
      const info = describeSpeechError(code);
      expect(info.fatal).toBe(true);
      expect(info.message.length).toBeGreaterThan(0);
    }
  });

  it("treats no-speech and aborts as recoverable", () => {
    expect(describeSpeechError("no-speech").fatal).toBe(false);
    expect(describeSpeechError("aborted").message).toBe("");
  });

  it("falls back to a readable message for unknown codes", () => {
    expect(describeSpeechError("weird-code").message).toContain("weird-code");
  });
});
