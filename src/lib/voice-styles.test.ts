import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  VOICES,
  VOICE_STYLES,
  DEFAULT_STYLE_ID,
  getVoicePrefs,
  getStyle,
  resolveVoiceStyle,
  setVoicePrefs,
  subscribeVoicePrefs,
  ttsRequestBody,
} from "./voice-styles";

beforeEach(() => {
  window.localStorage.clear();
  setVoicePrefs({ voice: "alloy", styleId: DEFAULT_STYLE_ID });
});

describe("voice style config", () => {
  it("has unique ids and complete entries", () => {
    const ids = VOICE_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const style of VOICE_STYLES) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.description.length).toBeGreaterThan(0);
      expect(style.instruction.length).toBeGreaterThan(0);
      expect(style.speed).toBeGreaterThan(0);
      expect(VOICES.some((v) => v.id === style.suggestedVoice)).toBe(true);
    }
  });

  it("uses Standard as the default style", () => {
    expect(VOICE_STYLES[0].id).toBe("standard");
    expect(DEFAULT_STYLE_ID).toBe("standard");
    expect(getStyle("nonexistent").id).toBe("standard");
  });
});

describe("global preference store", () => {
  it("persists to localStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeVoicePrefs(listener);
    setVoicePrefs({ voice: "onyx", styleId: "storyteller" });
    expect(listener).toHaveBeenCalled();
    expect(getVoicePrefs()).toEqual({ voice: "onyx", styleId: "storyteller" });
    expect(JSON.parse(window.localStorage.getItem("nd-voice-prefs") ?? "")).toEqual({
      voice: "onyx",
      styleId: "storyteller",
    });
    unsubscribe();
  });

  it("rejects unknown voice or style ids", () => {
    setVoicePrefs({ voice: "nope" as string, styleId: "nope" });
    expect(getVoicePrefs().voice).toBe("alloy");
    expect(getVoicePrefs().styleId).toBe(DEFAULT_STYLE_ID);
  });
});

describe("language compatibility fallback", () => {
  it("resolves the chosen style for an unrestricted language", () => {
    setVoicePrefs({ voice: "nova", styleId: "energetic" });
    const r = resolveVoiceStyle("en-US");
    expect(r.voice).toBe("nova");
    expect(r.style.id).toBe("energetic");
    expect(r.notice).toBeUndefined();
  });

  it("falls back to the closest style and reports a notice when restricted", () => {
    setVoicePrefs({ voice: "nova", styleId: "energetic" });
    // energetic is 1.15; calm is 0.85 — both 0.15 away, so whichever is
    // closest wins deterministically; just assert the fallback contract.
    VOICE_STYLES.find((s) => s.id === "energetic")!.languages = ["en"];
    VOICE_STYLES.find((s) => s.id === "calm")!.languages = ["en"];
    try {
      const r = resolveVoiceStyle("zu-ZA");
      expect(r.style.id).not.toBe("energetic");
      expect(r.notice).toMatch(/Energetic/);
      expect(r.notice).toMatch(/using /);
    } finally {
      delete VOICE_STYLES.find((s) => s.id === "energetic")!.languages;
      delete VOICE_STYLES.find((s) => s.id === "calm")!.languages;
    }
  });
});

describe("ttsRequestBody", () => {
  it("applies the global voice and style instruction", () => {
    setVoicePrefs({ voice: "echo", styleId: "newsreader" });
    const body = ttsRequestBody("Hello there", "en-US");
    expect(body).toEqual({
      text: "Hello there",
      lang: "en-US",
      voice: "echo",
      instructions: "Speak like a broadcast news anchor: authoritative, crisp and precise.",
    });
  });

  it("honours explicit overrides without touching the global setting", () => {
    setVoicePrefs({ voice: "echo", styleId: "newsreader" });
    const body = ttsRequestBody("Hi", "en-US", "onyx", "calm");
    expect(body.voice).toBe("onyx");
    expect(body.instructions).toContain("softly, slowly and soothingly");
    expect(getVoicePrefs().voice).toBe("echo");
  });

  it("ignores an unknown voice override", () => {
    const body = ttsRequestBody("Hi", "en-US", "bogus");
    expect(body.voice).toBe(getVoicePrefs().voice);
  });
});
