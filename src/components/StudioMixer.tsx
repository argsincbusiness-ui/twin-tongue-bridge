import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Dice5, Download, Loader2, Play, RotateCcw, Save, Square, Trash2, Volume2 } from "lucide-react";
import {
  applyPreset, defaultParams, defaultState, INSTRUMENTS, KEYS, loadSavedPresets, PRESETS, PROGRESSIONS,
  randomPattern, setBars, storeSavedPresets,
  type InstrumentId, type NoteMode, type Params, type SavedPreset, type StudioState, type Track,
} from "@/lib/studio/model";
import { cn } from "@/lib/utils";

type EngineMod = typeof import("@/lib/studio/engine");
type Engine = import("@/lib/studio/engine").StudioEngine;

function Slider({ label, value, min, max, step = 0.01, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex justify-between text-muted-foreground"><span>{label}</span><span>{fmt ? fmt(value) : value.toFixed(2)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-full accent-[var(--color-primary)]" />
    </label>
  );
}

function Btn({ on, onClick, children, className, label }: { on?: boolean; onClick: () => void; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={onClick}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium",
        on ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-secondary/60 text-foreground/80 hover:bg-secondary", className)}>
      {children}
    </button>
  );
}

const db = (v: number) => `${v.toFixed(0)} dB`;
const NOTE_MODES: { v: NoteMode; l: string }[] = [
  { v: "chord", l: "Chord" }, { v: "root", l: "Root" }, { v: "third", l: "3rd" }, { v: "fifth", l: "5th" }, { v: "arp", l: "Arpeggio" },
];

export function StudioMixer({ bpm, onBpm, song }: { bpm: number; onBpm: (b: number) => void; song: { url: string; title: string } | null }) {
  const [state, setState] = useState<StudioState>(() => defaultState());
  const [open, setOpen] = useState<InstrumentId | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(-60);
  const [exporting, setExporting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState("Custom");
  const engRef = useRef<Engine | null>(null);
  const modRef = useRef<EngineMod | null>(null);
  const vocalRef = useRef<{ url: string; buf: AudioBuffer } | null>(null);

  useEffect(() => setSaved(loadSavedPresets()), []);
  useEffect(() => { engRef.current?.setState(state); }, [state]);
  useEffect(() => { engRef.current?.setBpm(bpm); }, [bpm]);
  useEffect(() => () => engRef.current?.dispose(), []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { setLevel(engRef.current?.level() ?? -60); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const ensure = async (): Promise<Engine | null> => {
    if (engRef.current) return engRef.current;
    setLoading(true);
    setMsg(null);
    try {
      const mod = await import("@/lib/studio/engine");
      modRef.current = mod;
      const eng = await mod.StudioEngine.create(state);
      eng.setState(state);
      eng.setBpm(bpm);
      engRef.current = eng;
      return eng;
    } catch {
      setMsg("Couldn't start audio on this device.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const vocalBuffer = async (eng: Engine): Promise<AudioBuffer | null> => {
    if (!song) return null;
    if (vocalRef.current?.url === song.url) return vocalRef.current.buf;
    const ab = await (await fetch(song.url)).arrayBuffer();
    const buf = await eng.decode(ab);
    vocalRef.current = { url: song.url, buf };
    return buf;
  };

  const update = (fn: (s: StudioState) => StudioState) => { setState(fn); setActivePreset("Custom"); };
  const setTrack = (id: InstrumentId, patch: Partial<Track>) =>
    update((s) => ({ ...s, tracks: { ...s.tracks, [id]: { ...s.tracks[id], ...patch } } }));
  const setParam = (id: InstrumentId, k: keyof Params, v: number | boolean) =>
    update((s) => ({ ...s, tracks: { ...s.tracks, [id]: { ...s.tracks[id], params: { ...s.tracks[id].params, [k]: v } } } }));

  const togglePlay = async () => {
    const eng = await ensure();
    if (!eng) return;
    if (playing) { eng.stop(); setPlaying(false); setLevel(-60); return; }
    try { eng.setVocal(await vocalBuffer(eng)); } catch { eng.setVocal(null); }
    await eng.play();
    setPlaying(true);
  };

  const exportFile = async (kind: "mix" | "music" | "vocal") => {
    if (kind === "vocal") {
      if (!song) return;
      const a = document.createElement("a");
      a.href = song.url; a.download = `${song.title || "song"} (vocals).mp3`; a.click();
      return;
    }
    const eng = await ensure();
    if (!eng || !modRef.current) return;
    setExporting(kind);
    setMsg(null);
    try {
      const vocal = kind === "mix" ? await vocalBuffer(eng) : null;
      const wav = await modRef.current.renderWav({ state, bpm, bank: eng.bank, vocal, includeMusic: true, includeVocal: kind === "mix" });
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song?.title || "track"} (${kind === "mix" ? "full mix" : "instrumental"}).wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  const loadPreset = (name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (p) { setState((s) => applyPreset(s, p)); onBpm(p.bpm); }
    else if (name === "Custom") setState((s) => ({ ...defaultState(), masterVolume: s.masterVolume, balance: s.balance }));
    else {
      const u = saved.find((x) => x.name === name);
      if (u) { setState(u.state); onBpm(u.bpm); }
    }
    setActivePreset(name);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const list = [{ name, bpm, state }, ...saved.filter((x) => x.name !== name)];
    storeSavedPresets(list); setSaved(list); setPresetName(""); setActivePreset(name);
  };
  const deletePreset = (name: string) => {
    const list = saved.filter((x) => x.name !== name);
    storeSavedPresets(list); setSaved(list);
  };

  const pageCount = state.bars;
  const meterPct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-3 sm:p-4" aria-label="Instruments and mixer">
      <h3 className="font-display text-base font-semibold">Instruments &amp; Mixer</h3>

      {/* Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">Genre presets</span>
        <div className="flex flex-wrap gap-2">
          {[...PRESETS.map((p) => p.name), "Custom"].map((n) => (
            <Btn key={n} on={activePreset === n} onClick={() => loadPreset(n)}>{n}</Btn>
          ))}
          {saved.map((p) => (
            <span key={p.name} className="inline-flex items-center">
              <Btn on={activePreset === p.name} onClick={() => loadPreset(p.name)} className="rounded-r-none">{p.name}</Btn>
              <Btn label={`Delete preset ${p.name}`} onClick={() => deletePreset(p.name)} className="rounded-l-none border-l-0"><Trash2 className="h-4 w-4" /></Btn>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={presetName} onChange={(e) => setPresetName(e.target.value.slice(0, 40))} placeholder="Name your preset" className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
          <Btn onClick={savePreset}><Save className="h-4 w-4" /> Save</Btn>
        </div>
      </div>

      {/* Master */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Btn on={playing} onClick={togglePlay} className="min-w-28">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {loading ? "Loading sounds…" : playing ? "Stop" : "Play"}
          </Btn>
          <Btn on={state.metronome} onClick={() => setState((s) => ({ ...s, metronome: !s.metronome }))}>Metronome</Btn>
          <div className="flex min-w-32 flex-1 items-center gap-2" aria-label="Level meter">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full transition-[width] duration-75", meterPct > 92 ? "bg-destructive" : "bg-primary")} style={{ width: `${meterPct}%` }} />
            </div>
          </div>
        </div>
        {!song && <p className="text-xs text-muted-foreground">Create a song first to hear the vocals with your instruments.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Slider label="Master volume" value={state.masterVolume} min={-30} max={6} step={1} fmt={db} onChange={(v) => setState((s) => ({ ...s, masterVolume: v }))} />
          <Slider label="Tempo" value={bpm} min={60} max={180} step={1} fmt={(v) => `${v} BPM`} onChange={(v) => onBpm(Math.round(v))} />
          <Slider label="Vocals ⟷ Music" value={state.balance} min={0} max={1} fmt={(v) => (v < 0.45 ? "More music" : v > 0.55 ? "More vocals" : "Even")} onChange={(v) => setState((s) => ({ ...s, balance: v }))} />
          <Slider label="Swing / groove" value={state.swing} min={0} max={0.8} onChange={(v) => update((s) => ({ ...s, swing: v }))} fmt={(v) => `${Math.round(v * 100)}%`} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Key
            <select value={state.key} onChange={(e) => update((s) => ({ ...s, key: Number(e.target.value) }))} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground">
              {KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Scale
            <select value={state.scale} onChange={(e) => update((s) => ({ ...s, scale: e.target.value as "major" | "minor" }))} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground">
              <option value="major">Major</option><option value="minor">Minor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Chords
            <select value={state.progression} onChange={(e) => update((s) => ({ ...s, progression: e.target.value }))} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground">
              {Object.keys(PROGRESSIONS).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Pattern length
            <select value={state.bars} onChange={(e) => { const b = Number(e.target.value) as 1 | 2 | 4; update((s) => setBars(s, b)); setPage(0); }} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground">
              <option value={1}>1 bar</option><option value={2}>2 bars</option><option value={4}>4 bars</option>
            </select>
          </label>
        </div>
        {pageCount > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: pageCount }, (_, i) => <Btn key={i} on={page === i} onClick={() => setPage(i)}>Bar {i + 1}</Btn>)}
          </div>
        )}
      </div>

      {/* Instrument rack */}
      <div className="flex flex-col gap-2">
        {INSTRUMENTS.map((inst) => {
          const t = state.tracks[inst.id];
          const p = t.params;
          const expanded = open === inst.id;
          const set = (k: keyof Params) => (v: number) => setParam(inst.id, k, v);
          return (
            <div key={inst.id} className={cn("rounded-xl border p-3", t.enabled ? "border-primary/50 bg-card" : "border-border bg-card/50")}>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" role="switch" aria-checked={t.enabled} aria-label={`${inst.name} on/off`} onClick={() => setTrack(inst.id, { enabled: !t.enabled })}
                  className={cn("relative h-7 w-12 rounded-full transition-colors", t.enabled ? "bg-primary" : "bg-secondary")}>
                  <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-background transition-all", t.enabled ? "left-6" : "left-1")} />
                </button>
                <span className="mr-auto font-medium">{inst.name}</span>
                <Btn on={t.mute} onClick={() => setTrack(inst.id, { mute: !t.mute })} label="Mute">M</Btn>
                <Btn on={t.solo} onClick={() => setTrack(inst.id, { solo: !t.solo })} label="Solo">S</Btn>
                <Btn onClick={async () => { const e = await ensure(); await e?.preview(inst.id); }} label={`Preview ${inst.name}`}><Play className="h-4 w-4" /></Btn>
                <Btn onClick={() => setOpen(expanded ? null : inst.id)} label={expanded ? "Collapse" : "Expand"}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Btn>
              </div>

              {t.enabled && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" role="group" aria-label={`${inst.name} steps`}>
                    {Array.from({ length: 16 }, (_, i) => {
                      const idx = page * 16 + i;
                      const on = t.steps[idx];
                      return (
                        <button key={i} type="button" aria-pressed={on} aria-label={`Step ${idx + 1}`}
                          onClick={() => setTrack(inst.id, { steps: t.steps.map((x, j) => (j === idx ? !x : x)) })}
                          className={cn("h-10 rounded-md border", on ? "border-transparent bg-primary" : i % 4 === 0 ? "border-border bg-secondary" : "border-border bg-secondary/50")} />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={() => setTrack(inst.id, { steps: randomPattern(inst.id, t.steps.length) })}><Dice5 className="h-4 w-4" /> Randomize</Btn>
                    <Btn onClick={() => setTrack(inst.id, { steps: t.steps.map(() => false) })}>Clear</Btn>
                    {inst.melodic && (
                      <select aria-label="Notes" value={t.noteMode} onChange={(e) => setTrack(inst.id, { noteMode: e.target.value as NoteMode })} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm">
                        {NOTE_MODES.map((m) => <option key={m.v} value={m.v}>Notes: {m.l}</option>)}
                      </select>
                    )}
                    {inst.variants && (
                      <select aria-label="Sound" value={t.variant} onChange={(e) => setTrack(inst.id, { variant: e.target.value })} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm">
                        {inst.variants.map((v) => <option key={v.v} value={v.v}>{v.l}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {expanded && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Slider label="Volume" value={p.volume} min={-40} max={6} step={1} fmt={db} onChange={set("volume")} />
                  <Slider label="Pan" value={p.pan} min={-1} max={1} fmt={(v) => (Math.abs(v) < 0.05 ? "Centre" : v < 0 ? `L ${Math.round(-v * 100)}` : `R ${Math.round(v * 100)}`)} onChange={set("pan")} />
                  <Slider label="Octave" value={p.octave} min={-2} max={2} step={1} fmt={(v) => (v > 0 ? `+${v}` : `${v}`)} onChange={set("octave")} />
                  <Slider label="Fine tune" value={p.fine} min={-100} max={100} step={1} fmt={(v) => `${v} cents`} onChange={set("fine")} />
                  <Slider label="Attack" value={p.attack} min={0.001} max={2} step={0.001} fmt={(v) => `${v.toFixed(3)}s`} onChange={set("attack")} />
                  <Slider label="Decay" value={p.decay} min={0.01} max={2} fmt={(v) => `${v.toFixed(2)}s`} onChange={set("decay")} />
                  <Slider label="Sustain" value={p.sustain} min={0} max={1} onChange={set("sustain")} />
                  <Slider label="Release" value={p.release} min={0.01} max={4} fmt={(v) => `${v.toFixed(2)}s`} onChange={set("release")} />
                  <Slider label="Filter cutoff" value={p.cutoff} min={100} max={18000} step={10} fmt={(v) => `${Math.round(v)} Hz`} onChange={set("cutoff")} />
                  <Slider label="Resonance" value={p.resonance} min={0.1} max={20} step={0.1} fmt={(v) => v.toFixed(1)} onChange={set("resonance")} />
                  <Slider label="Reverb" value={p.reverb} min={0} max={1} onChange={set("reverb")} />
                  <Slider label="Delay" value={p.delay} min={0} max={1} onChange={set("delay")} />
                  <Slider label="Distortion / saturation" value={p.drive} min={0} max={1} onChange={set("drive")} />
                  {inst.id === "logdrum" && (<>
                    <Slider label="Pitch glide" value={p.glide} min={0} max={1} onChange={set("glide")} />
                    <Slider label="Decay length" value={p.logDecay} min={0.1} max={2} fmt={(v) => `${v.toFixed(2)}s`} onChange={set("logDecay")} />
                    <Slider label="Tone / warmth" value={p.warmth} min={0} max={1} onChange={set("warmth")} />
                    <Slider label="Punch" value={p.punch} min={0} max={1} onChange={set("punch")} />
                  </>)}
                  {inst.id === "strings" && (<>
                    <Slider label="Vibrato depth" value={p.vibratoDepth} min={0} max={1} onChange={set("vibratoDepth")} />
                    <Slider label="Vibrato speed" value={p.vibratoRate} min={0.5} max={10} step={0.1} fmt={(v) => `${v.toFixed(1)} Hz`} onChange={set("vibratoRate")} />
                    <Slider label="Bow attack softness" value={p.bowSoft} min={0} max={1} onChange={set("bowSoft")} />
                  </>)}
                  {inst.id === "piano" && (<>
                    <Slider label="Brightness" value={p.brightness} min={0} max={1} onChange={set("brightness")} />
                    <div className="flex items-end"><Btn on={p.pedal} onClick={() => setParam(inst.id, "pedal", !p.pedal)}>Sustain pedal {p.pedal ? "on" : "off"}</Btn></div>
                  </>)}
                  <div className="sm:col-span-2">
                    <Btn onClick={() => setTrack(inst.id, { params: defaultParams(inst.id) })}><RotateCcw className="h-4 w-4" /> Reset to default</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Export */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <span className="text-sm font-medium">Export</span>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => exportFile("mix")} className={!song ? "opacity-50" : ""}>
            {exporting === "mix" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Full mix (WAV)
          </Btn>
          <Btn onClick={() => exportFile("music")}>
            {exporting === "music" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Instrumental only (WAV)
          </Btn>
          <Btn onClick={() => exportFile("vocal")} className={!song ? "opacity-50" : ""}><Download className="h-4 w-4" /> Song only (MP3)</Btn>
        </div>
        <p className="text-xs text-muted-foreground">
          The sung track comes with its own backing music. For a clean vocal to layer over these instruments, choose "A cappella" before creating the song.
        </p>
        {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      </div>
    </section>
  );
}
