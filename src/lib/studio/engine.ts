/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser-only Tone.js engine for the Sing It studio. Import this module
 * dynamically (after hydration) — it pulls in Web Audio.
 */
import * as Tone from "tone";
import {
  balanceGains, chordForStep, chordMidi, encodeWav, INSTRUMENTS, isAudible, notesFor,
  type InstrumentId, type StudioState, type Track,
} from "./model";

type T = typeof Tone;
export type SampleBank = Record<string, Record<string, AudioBuffer> | null>;

const SAMPLE_SETS: Record<string, { base: string; notes: string[] }> = {
  "piano:acoustic": { base: "https://tonejs.github.io/audio/salamander/", notes: ["A1", "C2", "A2", "C3", "A3", "C4", "A4", "C5", "A5", "C6"] },
  "strings:violin": { base: "https://nbrosowsky.github.io/tonejs-instruments/samples/violin/", notes: ["A3", "C4", "E4", "G4", "A4", "C5", "E5", "G5", "A5"] },
  "guitar:default": { base: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/", notes: ["A2", "C3", "E3", "A3", "C4", "E4"] },
};

/** Load the free sample libraries. A set that fails entirely is null → synth fallback. */
export async function loadSamples(): Promise<SampleBank> {
  const bank: SampleBank = {};
  await Promise.all(
    Object.entries(SAMPLE_SETS).map(async ([key, set]) => {
      const results = await Promise.allSettled(
        set.notes.map(async (n) => [n, (await Tone.ToneAudioBuffer.fromUrl(`${set.base}${n}.mp3`)).get()] as const),
      );
      const ok: Record<string, AudioBuffer> = {};
      for (const r of results) if (r.status === "fulfilled" && r.value[1]) ok[r.value[0]] = r.value[1];
      bank[key] = Object.keys(ok).length ? ok : null;
    }),
  );
  return bank;
}

const BASE_OCT: Partial<Record<InstrumentId, number>> = {
  logdrum: 2, bass: 1, piano: 4, strings: 4, guitar: 3, pad: 3, brass: 4,
};

type Kind = "poly" | "mono" | "noise" | "metal" | "sampler";
interface Src { node: any; kind: Kind }

function makeSource(T: T, id: InstrumentId, variant: string, bank: SampleBank): Src {
  const sampler = (key: string): Src | null => {
    const urls = bank[key];
    return urls ? { node: new T.Sampler({ urls }), kind: "sampler" } : null;
  };
  switch (id) {
    case "logdrum":
      return { node: new T.MembraneSynth({ pitchDecay: 0.08, octaves: 4, oscillator: { type: "sine" } }), kind: "mono" };
    case "piano":
      if (variant === "rhodes")
        return { node: new T.PolySynth(T.FMSynth, { harmonicity: 3, modulationIndex: 6, oscillator: { type: "sine" }, modulation: { type: "sine" } } as any), kind: "poly" };
      return sampler("piano:acoustic") ?? { node: new T.PolySynth(T.Synth, { oscillator: { type: "triangle" } } as any), kind: "poly" };
    case "strings":
      if (variant === "violin") return sampler("strings:violin") ?? { node: new T.PolySynth(T.Synth, { oscillator: { type: "sawtooth" } } as any), kind: "poly" };
      return { node: new T.PolySynth(T.Synth, { oscillator: { type: "fatsawtooth", count: 3, spread: 30 } } as any), kind: "poly" };
    case "bass":
      return {
        node: new T.MonoSynth({
          oscillator: { type: variant === "sub" ? "sine" : "sawtooth" },
          filterEnvelope: { baseFrequency: variant === "sub" ? 300 : 120, octaves: variant === "sub" ? 1 : 3, attack: 0.005, decay: 0.2, sustain: 0.3 },
        } as any),
        kind: "mono",
      };
    case "guitar":
      return sampler("guitar:default") ?? { node: new T.PolySynth(T.Synth, { oscillator: { type: "triangle" } } as any), kind: "poly" };
    case "pad":
      return { node: new T.PolySynth(T.Synth, { oscillator: { type: "fatsawtooth", count: 4, spread: 40 } } as any), kind: "poly" };
    case "brass":
      return { node: new T.PolySynth(T.Synth, { oscillator: { type: "sawtooth" } } as any), kind: "poly" };
    case "kick":
      return { node: new T.MembraneSynth({ pitchDecay: 0.05, octaves: 6 }), kind: "mono" };
    case "snare":
      return { node: new T.NoiseSynth({ noise: { type: "white" } }), kind: "noise" };
    case "hihat":
      return { node: new T.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 } as any), kind: "metal" };
    case "shaker":
      return { node: new T.NoiseSynth({ noise: { type: "pink" } }), kind: "noise" };
    case "clap":
      return { node: new T.NoiseSynth({ noise: { type: "white" } }), kind: "noise" };
  }
}

interface TrackNodes {
  src: Src;
  variant: string;
  vibrato: any | null;
  filter: any;
  dist: any;
  channel: any;
  revSend: any;
  dlySend: any;
}

const DUR: Partial<Record<InstrumentId, string>> = {
  logdrum: "8n", bass: "8n", piano: "8n", strings: "4n", guitar: "8n", pad: "2n", brass: "8n",
};

export interface Graph {
  master: any;
  music: any;
  vocal: any;
  meter: any;
  metro: any;
  apply: (s: StudioState) => void;
  trigger: (s: StudioState, id: InstrumentId, globalStep: number, time: number, force?: boolean) => void;
  dispose: () => void;
}

export function buildGraph(T: T, initial: StudioState, bank: SampleBank): Graph {
  const master = new T.Gain(1).toDestination();
  const meter = new T.Meter({ smoothing: 0.85 });
  master.connect(meter);
  const music = new T.Gain(1).connect(master);
  const vocal = new T.Gain(1).connect(master);
  const reverb = new T.Freeverb({ roomSize: 0.82, dampening: 3500, wet: 1 }).connect(music);
  const delay = new T.FeedbackDelay({ delayTime: "8n.", feedback: 0.3, wet: 1 }).connect(music);
  const metro = new T.MembraneSynth({ pitchDecay: 0.005, octaves: 1, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }).connect(master);
  metro.volume.value = -10;

  const tracks = {} as Record<InstrumentId, TrackNodes>;

  const wireSource = (n: TrackNodes, id: InstrumentId, variant: string) => {
    n.src.node?.dispose?.();
    n.vibrato?.dispose?.();
    n.src = makeSource(T, id, variant, bank);
    n.variant = variant;
    n.vibrato = id === "strings" ? new T.Vibrato({ frequency: 5, depth: 0.1 }) : null;
    if (n.vibrato) n.src.node.chain(n.vibrato, n.filter);
    else n.src.node.connect(n.filter);
  };

  for (const inst of INSTRUMENTS) {
    const filter = new T.Filter({ type: "lowpass", frequency: 12000, Q: 1 });
    const dist = new T.Distortion(0);
    const channel = new T.Channel(-8, 0);
    const revSend = new T.Gain(0).connect(reverb);
    const dlySend = new T.Gain(0).connect(delay);
    filter.chain(dist, channel);
    channel.connect(music);
    channel.connect(revSend);
    channel.connect(dlySend);
    const n: TrackNodes = { src: { node: null, kind: "poly" }, variant: "", vibrato: null, filter, dist, channel, revSend, dlySend };
    wireSource(n, inst.id, initial.tracks[inst.id].variant);
    tracks[inst.id] = n;
  }

  const applyTrack = (s: StudioState, id: InstrumentId, t: Track) => {
    const n = tracks[id];
    if (n.variant !== t.variant) wireSource(n, id, t.variant);
    const p = t.params;
    let cutoff = p.cutoff;
    let attack = p.attack;
    let decay = p.decay;
    let release = p.release;
    let vol = p.volume;
    if (id === "logdrum") {
      cutoff *= 1 - 0.75 * p.warmth;
      decay = p.logDecay;
      vol += p.punch * 4;
      try { n.src.node.pitchDecay = 0.01 + p.glide * 0.4; } catch { /* noop */ }
    }
    if (id === "piano") {
      cutoff *= 0.25 + p.brightness;
      if (p.pedal) release = Math.max(release, 3);
    }
    if (id === "strings") {
      attack += p.bowSoft * 0.8;
      if (n.vibrato) {
        n.vibrato.depth.value = p.vibratoDepth;
        n.vibrato.frequency.value = p.vibratoRate;
      }
    }
    n.channel.volume.value = vol;
    n.channel.pan.value = p.pan;
    n.channel.mute = !isAudible(s, id);
    n.filter.frequency.value = Math.max(40, Math.min(20000, cutoff));
    n.filter.Q.value = p.resonance;
    n.dist.distortion = p.drive * 0.9;
    n.dist.wet.value = p.drive > 0 ? 1 : 0;
    n.revSend.gain.value = p.reverb;
    n.dlySend.gain.value = p.delay;
    const node = n.src.node;
    try {
      if (n.src.kind === "sampler") {
        node.attack = attack;
        node.release = release;
      } else {
        node.set({ envelope: { attack, decay, sustain: p.sustain, release } });
        if (n.src.kind === "poly" || n.src.kind === "mono") node.set({ detune: p.fine });
      }
    } catch {
      /* some synths ignore some fields */
    }
  };

  const apply = (s: StudioState) => {
    for (const inst of INSTRUMENTS) applyTrack(s, inst.id, s.tracks[inst.id]);
    master.gain.value = T.dbToGain(s.masterVolume);
    const g = balanceGains(s.balance);
    music.gain.value = g.music;
    vocal.gain.value = g.vocal;
  };

  const trigger = (s: StudioState, id: InstrumentId, globalStep: number, time: number, force = false) => {
    const t = s.tracks[id];
    const idx = globalStep % t.steps.length;
    if (!force && (!isAudible(s, id) || !t.steps[idx])) return;
    const n = tracks[id];
    const p = t.params;
    const vel = id === "logdrum" ? 0.6 + 0.4 * p.punch : 0.8;
    const meta = INSTRUMENTS.find((i) => i.id === id)!;
    try {
      if (meta.melodic) {
        const degree = chordForStep(s, globalStep);
        const oct = (BASE_OCT[id] ?? 4) + p.octave;
        const notes = notesFor(t.noteMode, chordMidi(s.key, s.scale, degree, oct), idx).map((m) => T.Frequency(m, "midi").toNote());
        let dur = DUR[id] ?? "8n";
        if (id === "piano" && p.pedal) dur = "2n";
        if (n.src.kind === "mono") n.src.node.triggerAttackRelease(notes[0], dur, time, vel);
        else n.src.node.triggerAttackRelease(notes, dur, time, vel);
      } else if (n.src.kind === "noise") {
        n.src.node.triggerAttackRelease("16n", time, vel);
      } else if (n.src.kind === "metal") {
        n.src.node.triggerAttackRelease(320, "32n", time, vel * 0.6);
      } else {
        n.src.node.triggerAttackRelease("C1", "8n", time, vel);
      }
    } catch {
      /* skip a note rather than stopping the transport */
    }
  };

  apply(initial);

  return {
    master, music, vocal, meter, metro, apply, trigger,
    dispose: () => {
      for (const n of Object.values(tracks)) {
        n.src.node.dispose?.(); n.vibrato?.dispose?.(); n.filter.dispose(); n.dist.dispose();
        n.channel.dispose(); n.revSend.dispose(); n.dlySend.dispose();
      }
      reverb.dispose(); delay.dispose(); metro.dispose(); music.dispose(); vocal.dispose(); meter.dispose(); master.dispose();
    },
  };
}

function scheduleSteps(transport: any, graph: Graph, getState: () => StudioState) {
  let step = 0;
  const id = transport.scheduleRepeat((time: number) => {
    const s = getState();
    const g = step++;
    for (const inst of INSTRUMENTS) graph.trigger(s, inst.id, g, time);
    if (s.metronome && g % 4 === 0) graph.metro.triggerAttackRelease(g % 16 === 0 ? "C6" : "G5", "32n", time);
  }, "16n", 0);
  return { reset: () => (step = 0), clear: () => transport.clear(id) };
}

/** Live, interactive engine (one per studio screen). */
export class StudioEngine {
  private graph: Graph;
  private state: StudioState;
  private seq: ReturnType<typeof scheduleSteps>;
  private player: any | null = null;
  readonly bank: SampleBank;

  private constructor(state: StudioState, bank: SampleBank) {
    this.state = state;
    this.bank = bank;
    this.graph = buildGraph(Tone, state, bank);
    this.seq = scheduleSteps(Tone.getTransport(), this.graph, () => this.state);
  }

  static async create(state: StudioState): Promise<StudioEngine> {
    await Tone.start();
    const bank = await loadSamples();
    return new StudioEngine(state, bank);
  }

  setState(s: StudioState) {
    this.state = s;
    this.graph.apply(s);
    const tr = Tone.getTransport();
    tr.swing = s.swing;
    tr.swingSubdivision = "16n";
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  }

  setVocal(buf: AudioBuffer | null) {
    if (this.player) {
      this.player.unsync();
      this.player.dispose();
      this.player = null;
    }
    if (buf) {
      this.player = new Tone.Player(buf).connect(this.graph.vocal);
      this.player.sync().start(0);
    }
  }

  async play() {
    await Tone.start();
    const tr = Tone.getTransport();
    tr.stop();
    tr.position = 0;
    this.seq.reset();
    tr.start("+0.05");
  }

  stop() {
    Tone.getTransport().stop();
  }

  async preview(id: InstrumentId) {
    await Tone.start();
    this.graph.trigger(this.state, id, 0, Tone.now() + 0.02, true);
  }

  /** Master level in dB. */
  level(): number {
    const v = this.graph.meter.getValue();
    return typeof v === "number" ? v : Math.max(...(v as number[]));
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return Tone.getContext().decodeAudioData(arrayBuffer);
  }

  dispose() {
    this.stop();
    this.seq.clear();
    this.setVocal(null);
    this.graph.dispose();
  }
}

/** Render a finished stereo WAV offline: full mix, instrumental only, or vocals only. */
export async function renderWav(opts: {
  state: StudioState;
  bpm: number;
  bank: SampleBank;
  vocal: AudioBuffer | null;
  includeMusic: boolean;
  includeVocal: boolean;
}): Promise<Uint8Array> {
  const { state, bpm, bank, vocal } = opts;
  const barSec = (4 * 60) / bpm;
  const seconds = vocal && opts.includeVocal ? vocal.duration + 1 : barSec * Math.max(8, state.bars * 2);
  const rendered = await Tone.Offline(async (ctx) => {
    const graph = buildGraph(Tone, state, bank);
    const g = balanceGains(state.balance);
    graph.music.gain.value = opts.includeMusic ? g.music || 1 : 0;
    graph.vocal.gain.value = opts.includeVocal ? g.vocal || 1 : 0;
    const tr = ctx.transport;
    tr.bpm.value = bpm;
    tr.swing = state.swing;
    tr.swingSubdivision = "16n";
    if (opts.includeMusic) scheduleSteps(tr, graph, () => state);
    if (vocal && opts.includeVocal) new Tone.Player(vocal).connect(graph.vocal).start(0);
    tr.start(0);
  }, seconds, 2, 44100);
  const ab = rendered.get() as AudioBuffer;
  const chans = [ab.getChannelData(0), ab.numberOfChannels > 1 ? ab.getChannelData(1) : ab.getChannelData(0)];
  // Normalise to avoid clipping when vocals and instruments add up.
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  if (peak > 0.98) for (const c of chans) for (let i = 0; i < c.length; i++) c[i] = (c[i] / peak) * 0.98;
  return encodeWav(chans, ab.sampleRate);
}
