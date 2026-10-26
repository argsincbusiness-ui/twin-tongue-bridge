/** Pure data model for the Sing It instrument studio (no audio, SSR-safe, testable). */

export type InstrumentId =
  | "logdrum" | "piano" | "strings" | "bass" | "guitar"
  | "kick" | "snare" | "hihat" | "shaker" | "clap"
  | "pad" | "brass";

export type NoteMode = "chord" | "root" | "third" | "fifth" | "arp";

export interface Params {
  volume: number; // dB
  pan: number; // -1..1
  octave: number; // -2..2
  fine: number; // cents
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number; // Hz
  resonance: number; // Q
  reverb: number; // 0..1
  delay: number; // 0..1
  drive: number; // 0..1
  // Log drum
  glide: number;
  logDecay: number;
  warmth: number;
  punch: number;
  // Violin
  vibratoDepth: number;
  vibratoRate: number;
  bowSoft: number;
  // Piano
  brightness: number;
  pedal: boolean;
}

export interface Track {
  enabled: boolean;
  mute: boolean;
  solo: boolean;
  variant: string;
  noteMode: NoteMode;
  /** One flag per 16th step; length = 16 * bars. */
  steps: boolean[];
  params: Params;
}

export interface StudioState {
  bars: 1 | 2 | 4;
  swing: number; // 0..1
  key: number; // 0 = C .. 11 = B
  scale: "major" | "minor";
  progression: string;
  masterVolume: number; // dB
  balance: number; // 0 = all music .. 1 = all vocal, 0.5 = even
  metronome: boolean;
  tracks: Record<InstrumentId, Track>;
}

export const INSTRUMENTS: {
  id: InstrumentId;
  name: string;
  melodic: boolean;
  variants?: { v: string; l: string }[];
  group: "melodic" | "drums";
}[] = [
  { id: "logdrum", name: "Log Drum", melodic: true, group: "melodic" },
  { id: "piano", name: "Piano", melodic: true, group: "melodic", variants: [{ v: "acoustic", l: "Acoustic" }, { v: "rhodes", l: "Electric / Rhodes" }] },
  { id: "strings", name: "Violin / Strings", melodic: true, group: "melodic", variants: [{ v: "violin", l: "Solo violin" }, { v: "ensemble", l: "String ensemble" }] },
  { id: "bass", name: "Bass", melodic: true, group: "melodic", variants: [{ v: "sub", l: "Sub bass" }, { v: "electric", l: "Electric bass" }] },
  { id: "guitar", name: "Acoustic Guitar", melodic: true, group: "melodic" },
  { id: "pad", name: "Synth Pad", melodic: true, group: "melodic" },
  { id: "brass", name: "Brass / Horns", melodic: true, group: "melodic" },
  { id: "kick", name: "Kick", melodic: false, group: "drums" },
  { id: "snare", name: "Snare", melodic: false, group: "drums" },
  { id: "hihat", name: "Hi-hat", melodic: false, group: "drums" },
  { id: "shaker", name: "Shaker", melodic: false, group: "drums" },
  { id: "clap", name: "Clap", melodic: false, group: "drums" },
];

const BASE: Params = {
  volume: -8, pan: 0, octave: 0, fine: 0,
  attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8,
  cutoff: 12000, resonance: 1, reverb: 0.15, delay: 0, drive: 0,
  glide: 0.15, logDecay: 0.6, warmth: 0.4, punch: 0.5,
  vibratoDepth: 0.15, vibratoRate: 5, bowSoft: 0.3,
  brightness: 0.7, pedal: false,
};

const OVERRIDES: Partial<Record<InstrumentId, Partial<Params>>> = {
  logdrum: { volume: -4, attack: 0.001, decay: 0.6, sustain: 0, release: 0.4, cutoff: 3000, reverb: 0.05 },
  piano: { volume: -9, release: 1.2, reverb: 0.25 },
  strings: { volume: -12, attack: 0.25, sustain: 0.8, release: 1.2, reverb: 0.35 },
  bass: { volume: -6, attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.2, cutoff: 1500, reverb: 0 },
  guitar: { volume: -10, release: 1, reverb: 0.2 },
  pad: { volume: -16, attack: 0.6, sustain: 0.8, release: 2, cutoff: 4000, reverb: 0.5 },
  brass: { volume: -14, attack: 0.05, sustain: 0.7, release: 0.4, cutoff: 5000, reverb: 0.2 },
  kick: { volume: -4, attack: 0.001, decay: 0.4, sustain: 0, release: 0.2, reverb: 0 },
  snare: { volume: -12, attack: 0.001, decay: 0.18, sustain: 0, release: 0.1, cutoff: 9000, reverb: 0.15 },
  hihat: { volume: -20, attack: 0.001, decay: 0.06, sustain: 0, release: 0.03, reverb: 0.05 },
  shaker: { volume: -20, attack: 0.005, decay: 0.05, sustain: 0, release: 0.04, reverb: 0.05 },
  clap: { volume: -14, attack: 0.001, decay: 0.15, sustain: 0, release: 0.1, reverb: 0.25 },
};

export function defaultParams(id: InstrumentId): Params {
  return { ...BASE, ...OVERRIDES[id] };
}

export function defaultVariant(id: InstrumentId): string {
  return INSTRUMENTS.find((i) => i.id === id)?.variants?.[0]?.v ?? "default";
}

/** "x...x..." → step flags, repeated/trimmed to `len`. */
export function pattern(s: string, len = 16): boolean[] {
  const flags = s.replace(/\s/g, "").split("").map((c) => c === "x");
  return Array.from({ length: len }, (_, i) => flags[i % flags.length] ?? false);
}

export function defaultTrack(id: InstrumentId, bars = 1): Track {
  return {
    enabled: false,
    mute: false,
    solo: false,
    variant: defaultVariant(id),
    noteMode: id === "bass" || id === "logdrum" ? "root" : "chord",
    steps: Array(16 * bars).fill(false),
    params: defaultParams(id),
  };
}

export function defaultState(): StudioState {
  const tracks = {} as Record<InstrumentId, Track>;
  for (const i of INSTRUMENTS) tracks[i.id] = defaultTrack(i.id);
  return {
    bars: 1, swing: 0, key: 0, scale: "minor", progression: "i-VI-III-VII",
    masterVolume: -4, balance: 0.5, metronome: false, tracks,
  };
}

/** Resize every track's steps when the pattern length changes (repeats the existing bar). */
export function setBars(s: StudioState, bars: 1 | 2 | 4): StudioState {
  const tracks = { ...s.tracks };
  for (const id of Object.keys(tracks) as InstrumentId[]) {
    const t = tracks[id];
    const len = 16 * bars;
    tracks[id] = { ...t, steps: Array.from({ length: len }, (_, i) => t.steps[i % t.steps.length] ?? false) };
  }
  return { ...s, bars, tracks };
}

/* ---------- Music theory ---------- */

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

/** Progressions as 0-based scale degrees, one chord per bar. */
export const PROGRESSIONS: Record<string, number[]> = {
  "I-V-vi-IV": [0, 4, 5, 3],
  "ii-V-I": [1, 4, 0, 0],
  "I-IV-V": [0, 3, 4, 4],
  "I-vi-IV-V": [0, 5, 3, 4],
  "vi-IV-I-V": [5, 3, 0, 4],
  "i-VI-III-VII": [0, 5, 2, 6],
  "i-iv-v": [0, 3, 4, 4],
};

/** MIDI notes of the triad built on `degree`, with the root in `octave` (C4 = 60). */
export function chordMidi(key: number, scale: "major" | "minor", degree: number, octave: number): number[] {
  const iv = SCALES[scale];
  const at = (d: number) => iv[d % 7] + 12 * Math.floor(d / 7);
  const root = 12 * (octave + 1) + key;
  return [at(degree), at(degree + 2), at(degree + 4)].map((x) => root + x);
}

/** Notes for one step, given the note mode. */
export function notesFor(mode: NoteMode, chord: number[], step: number): number[] {
  switch (mode) {
    case "root": return [chord[0]];
    case "third": return [chord[1]];
    case "fifth": return [chord[2]];
    case "arp": return [chord[step % chord.length]];
    default: return chord;
  }
}

export function chordForStep(s: StudioState, globalStep: number): number {
  const prog = PROGRESSIONS[s.progression] ?? [0];
  return prog[Math.floor(globalStep / 16) % prog.length];
}

export function isAudible(s: StudioState, id: InstrumentId): boolean {
  const t = s.tracks[id];
  const anySolo = Object.values(s.tracks).some((x) => x.enabled && x.solo);
  return t.enabled && !t.mute && (!anySolo || t.solo);
}

/** Balance → linear gains, so the centre keeps both at full level. */
export function balanceGains(b: number): { vocal: number; music: number } {
  return { vocal: Math.min(1, 2 * b), music: Math.min(1, 2 * (1 - b)) };
}

export function randomPattern(id: InstrumentId, len: number, rand: () => number = Math.random): boolean[] {
  const density: Partial<Record<InstrumentId, number>> = { hihat: 0.6, shaker: 0.7, kick: 0.25, pad: 0.08, strings: 0.1 };
  const p = density[id] ?? 0.3;
  const out = Array.from({ length: len }, () => rand() < p);
  if (id === "kick" || id === "logdrum" || id === "bass") out[0] = true;
  return out;
}

/* ---------- Genre presets ---------- */

export interface Preset {
  name: string;
  bpm: number;
  key: number;
  scale: "major" | "minor";
  progression: string;
  swing: number;
  tracks: Partial<Record<InstrumentId, { p: string; variant?: string; noteMode?: NoteMode; params?: Partial<Params> }>>;
}

export const PRESETS: Preset[] = [
  {
    name: "Amapiano", bpm: 112, key: 9, scale: "minor", progression: "i-VI-III-VII", swing: 0.2,
    tracks: {
      logdrum: { p: "x..x..x...x.x...", noteMode: "root" },
      piano: { p: "..x...x...x...x.", variant: "rhodes" },
      shaker: { p: "xxxxxxxxxxxxxxxx" },
      bass: { p: "x.......x.......", variant: "sub" },
      kick: { p: "x...x...x...x..." },
      clap: { p: "....x.......x..." },
    },
  },
  {
    name: "Afro House", bpm: 122, key: 2, scale: "minor", progression: "i-iv-v", swing: 0.1,
    tracks: {
      kick: { p: "x...x...x...x..." },
      hihat: { p: "..x...x...x...x." },
      shaker: { p: "x.xx.xx.x.xx.xx." },
      clap: { p: "....x.......x..." },
      bass: { p: "x..x..x...x..x..", variant: "electric", noteMode: "root" },
      pad: { p: "x...............", noteMode: "chord" },
    },
  },
  {
    name: "Gospel", bpm: 76, key: 3, scale: "major", progression: "I-vi-IV-V", swing: 0.3,
    tracks: {
      piano: { p: "x..x..x.x..x..x.", variant: "acoustic", params: { pedal: true } },
      bass: { p: "x.....x.x.......", variant: "electric", noteMode: "root" },
      kick: { p: "x.......x.x....." },
      snare: { p: "....x.......x..." },
      hihat: { p: "x.x.x.x.x.x.x.x." },
      brass: { p: "x...........x...", noteMode: "chord" },
    },
  },
  {
    name: "Pop Ballad", bpm: 72, key: 0, scale: "major", progression: "I-V-vi-IV", swing: 0,
    tracks: {
      piano: { p: "x...x...x...x...", variant: "acoustic", params: { pedal: true } },
      strings: { p: "x...............", variant: "ensemble", noteMode: "chord" },
      bass: { p: "x.......x.......", variant: "sub", noteMode: "root" },
    },
  },
  {
    name: "Maskandi / Acoustic", bpm: 128, key: 7, scale: "major", progression: "I-IV-V", swing: 0.1,
    tracks: {
      guitar: { p: "x.xxx.xxx.xxx.xx", noteMode: "arp" },
      bass: { p: "x...x...x...x...", variant: "electric", noteMode: "root" },
      kick: { p: "x...x...x...x..." },
      snare: { p: "....x.......x..." },
      strings: { p: "x.......x.......", variant: "violin", noteMode: "fifth" },
    },
  },
  {
    name: "Hip-hop", bpm: 90, key: 5, scale: "minor", progression: "i-VI-III-VII", swing: 0.35,
    tracks: {
      kick: { p: "x.....x...x....." },
      snare: { p: "....x.......x..." },
      hihat: { p: "x.x.x.x.x.x.x.xx" },
      bass: { p: "x.....x...x.....", variant: "sub", noteMode: "root" },
      piano: { p: "x.......x.......", variant: "rhodes" },
    },
  },
];

/** Apply a preset on top of a fresh studio, keeping master settings. */
export function applyPreset(s: StudioState, p: Preset): StudioState {
  const base = defaultState();
  const len = 16 * s.bars;
  const tracks = { ...base.tracks };
  for (const [id, cfg] of Object.entries(p.tracks) as [InstrumentId, NonNullable<Preset["tracks"][InstrumentId]>][]) {
    const t = defaultTrack(id, s.bars);
    tracks[id] = {
      ...t,
      enabled: true,
      steps: pattern(cfg.p, len),
      variant: cfg.variant ?? t.variant,
      noteMode: cfg.noteMode ?? t.noteMode,
      params: { ...t.params, ...cfg.params },
    };
  }
  return {
    ...s, tracks, key: p.key, scale: p.scale, progression: p.progression, swing: p.swing,
  };
}

/* ---------- User presets (saved on this device) ---------- */

const LS_KEY = "singit.studio.presets.v1";
export interface SavedPreset { name: string; bpm: number; state: StudioState }

export function loadSavedPresets(): SavedPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as SavedPreset[];
  } catch {
    return [];
  }
}
export function storeSavedPresets(list: SavedPreset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 30)));
}

/* ---------- WAV encoding ---------- */

/** Encode planar Float32 channels to a 16-bit PCM WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  const out = new Uint8Array(44 + n * ch * 2);
  const v = new DataView(out.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}
