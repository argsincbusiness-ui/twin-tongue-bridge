import { describe, expect, it } from "vitest";
import {
  applyPreset, balanceGains, chordMidi, defaultState, encodeWav, isAudible, notesFor, pattern, PRESETS, setBars,
} from "./model";

describe("studio model", () => {
  it("parses patterns and repeats them", () => {
    expect(pattern("x...", 8)).toEqual([true, false, false, false, true, false, false, false]);
  });
  it("builds chords in key", () => {
    expect(chordMidi(0, "major", 0, 4)).toEqual([60, 64, 67]); // C major
    expect(chordMidi(9, "minor", 0, 3)).toEqual([57, 60, 64]); // A minor
    expect(chordMidi(0, "major", 4, 4)).toEqual([67, 71, 74]); // G major
  });
  it("selects notes by mode", () => {
    const c = [60, 64, 67];
    expect(notesFor("root", c, 3)).toEqual([60]);
    expect(notesFor("arp", c, 4)).toEqual([64]);
    expect(notesFor("chord", c, 0)).toEqual(c);
  });
  it("handles solo and mute", () => {
    let s = applyPreset(defaultState(), PRESETS[0]);
    expect(isAudible(s, "piano")).toBe(true);
    s = { ...s, tracks: { ...s.tracks, kick: { ...s.tracks.kick, solo: true } } };
    expect(isAudible(s, "piano")).toBe(false);
    expect(isAudible(s, "kick")).toBe(true);
  });
  it("resizes patterns", () => {
    const s = setBars(applyPreset(defaultState(), PRESETS[0]), 4);
    expect(s.tracks.kick.steps).toHaveLength(64);
    expect(s.tracks.kick.steps[16]).toBe(true);
  });
  it("balances evenly at centre", () => {
    expect(balanceGains(0.5)).toEqual({ vocal: 1, music: 1 });
    expect(balanceGains(1).music).toBe(0);
  });
  it("encodes a valid WAV header", () => {
    const wav = encodeWav([new Float32Array([0, 0.5]), new Float32Array([0, -0.5])], 44100);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(wav.length).toBe(44 + 8);
  });
});
