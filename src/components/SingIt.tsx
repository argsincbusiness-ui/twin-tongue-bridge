import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Music2, Download, Share2, RotateCw, Trash2, Loader2, Play } from "lucide-react";
import { createSong, SONG_TEXT_MAX, type SongInput } from "@/lib/song.functions";
import { useRecognition } from "@/hooks/useSpeech";
import { LANGUAGES } from "@/lib/languages";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { StudioMixer } from "@/components/StudioMixer";
import { VoiceSelector } from "@/components/VoiceSelector";
import { getStyle, getVoicePrefs } from "@/lib/voice-styles";

const GENRES = ["Pop", "Afrobeats", "Amapiano", "Gospel", "R&B", "Hip-Hop/Rap", "Reggae", "Country", "Rock", "Jazz", "Lullaby / Children's song", "Latin", "Acoustic Folk", "EDM/Dance"];
const MOODS = ["happy", "sad", "romantic", "inspirational", "calm", "energetic"];
const MUSIC: { v: SongInput["music"]; l: string }[] = [
  { v: "full", l: "Full band + drums" },
  { v: "light", l: "Light beat" },
  { v: "soft", l: "No drums, soft instruments" },
  { v: "acapella", l: "A cappella" },
];

interface Song {
  id: string;
  title: string;
  lyrics: string;
  storage_path: string;
  created_at: string;
}

function tempoLabel(b: number) {
  return b < 85 ? "Slow ballad" : b < 115 ? "Medium" : b < 145 ? "Upbeat" : "Fast";
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
        on ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-secondary/60 text-foreground/80 hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function SingIt() {
  const create = useServerFn(createSong);
  const [text, setText] = useState("");
  const [micLang, setMicLang] = useState("en-US");
  const [translateTo, setTranslateTo] = useState("");
  const [voice, setVoice] = useState<SongInput["voice"]>("female");
  const [genre, setGenre] = useState("Pop");
  const [customStyle, setCustomStyle] = useState("");
  const [bpm, setBpm] = useState(110);
  const [aiTempo, setAiTempo] = useState(true);
  const [music, setMusic] = useState<SongInput["music"]>("full");
  const [mood, setMood] = useState("");
  const [length, setLength] = useState<SongInput["length"]>("short");
  const [rewrite, setRewrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ song: Song; url: string } | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const busyRef = useRef(false);

  const rec = useRecognition({
    lang: micLang,
    silenceMs: 2500,
    onFinal: (t) => setText((prev) => (prev ? `${prev}\n${t}` : t).slice(0, SONG_TEXT_MAX)),
  });

  const loadSongs = useCallback(async () => {
    const { data } = await supabase.from("songs").select("id,title,lyrics,storage_path,created_at").order("created_at", { ascending: false }).limit(50);
    setSongs((data ?? []) as Song[]);
  }, []);
  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const open = async (song: Song) => {
    const { data, error: e } = await supabase.storage.from("songs").createSignedUrl(song.storage_path, 3600);
    if (e || !data) return setError("Couldn't open that song.");
    setCurrent({ song, url: data.signedUrl });
  };

  const generate = async () => {
    if (busyRef.current) return;
    if (!text.trim()) return setError("Please type, paste or speak some text first.");
    busyRef.current = true;
    setBusy(true);
    setError(null);
    rec.stop();
    try {
      // Style shapes the vocal delivery where it makes sense for singing.
      const delivery = getStyle(getVoicePrefs().styleId).singHint;
      const row = (await create({
        data: {
          text,
          translateTo: translateTo || undefined,
          voice,
          genre,
          customStyle: customStyle || undefined,
          delivery: delivery || undefined,
          bpm: aiTempo ? null : bpm,
          music,
          mood: mood || undefined,
          length,
          rewrite,
        },
      })) as Song;
      await open(row);
      void loadSongs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const share = async () => {
    if (!current) return;
    try {
      const blob = await (await fetch(current.url)).blob();
      const file = new File([blob], `${current.song.title || "song"}.mp3`, { type: "audio/mpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: current.song.title, text: current.song.lyrics.slice(0, 200) });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${current.song.title}\n\n${current.song.lyrics}`)}`, "_blank");
      }
    } catch {
      /* user cancelled */
    }
  };

  const remove = async (s: Song) => {
    await supabase.storage.from("songs").remove([s.storage_path]);
    await supabase.from("songs").delete().eq("id", s.id);
    if (current?.song.id === s.id) setCurrent(null);
    void loadSongs();
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <Music2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Sing It</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">Songs are AI-generated</span>
      </header>

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, SONG_TEXT_MAX))}
          rows={6}
          placeholder="Paste lyrics, a poem, a story or a message…"
          className="w-full rounded-xl border border-border bg-background p-3 text-base"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (rec.listening ? rec.stop() : rec.start())}
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium", rec.listening ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground")}
          >
            {rec.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {rec.listening ? "Stop" : "Speak"}
          </button>
          <select aria-label="Speaking language" value={micLang} onChange={(e) => setMicLang(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm">
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{text.length}/{SONG_TEXT_MAX}</span>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Translate first, then sing in…</span>
          <select value={translateTo} onChange={(e) => setTranslateTo(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-2">
            <option value="">Don't translate (sing in the text's language)</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.name}>{l.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Group title="Voice">
        <Chip on={voice === "male"} onClick={() => setVoice("male")}>Male</Chip>
        <Chip on={voice === "female"} onClick={() => setVoice("female")}>Female</Chip>
        <Chip on={voice === "duet"} onClick={() => setVoice("duet")}>Duet</Chip>
      </Group>

      <VoiceSelector lang={micLang} voiceControl={false} />


      <Group title="Genre">
        {GENRES.map((g) => (
          <Chip key={g} on={genre === g} onClick={() => setGenre(g)}>{g}</Chip>
        ))}
        <input value={customStyle} onChange={(e) => setCustomStyle(e.target.value.slice(0, 200))} placeholder="Custom style (optional)" className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
      </Group>

      <Group title={`Tempo: ${aiTempo ? "AI decides" : `${bpm} BPM · ${tempoLabel(bpm)}`}`}>
        <Chip on={aiTempo} onClick={() => setAiTempo((v) => !v)}>Let AI decide</Chip>
        <input type="range" min={60} max={180} value={bpm} disabled={aiTempo} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" className="w-full accent-[var(--color-primary)]" />
      </Group>

      <Group title="Music style">
        {MUSIC.map((m) => (
          <Chip key={m.v} on={music === m.v} onClick={() => setMusic(m.v)}>{m.l}</Chip>
        ))}
      </Group>

      <Group title="Mood (optional)">
        {MOODS.map((m) => (
          <Chip key={m} on={mood === m} onClick={() => setMood(mood === m ? "" : m)}>{m}</Chip>
        ))}
      </Group>

      <Group title="Length">
        <Chip on={length === "short"} onClick={() => setLength("short")}>Short (~30s)</Chip>
        <Chip on={length === "medium"} onClick={() => setLength("medium")}>Medium (1–2 min)</Chip>
        <Chip on={length === "full"} onClick={() => setLength("full")}>Full song</Chip>
      </Group>

      <Group title="Lyrics">
        <Chip on={rewrite} onClick={() => setRewrite(true)}>Rewrite into song lyrics</Chip>
        <Chip on={!rewrite} onClick={() => setRewrite(false)}>Sing exactly as written</Chip>
      </Group>

      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Music2 className="h-5 w-5" />}
        {busy ? `Composing your song… ${elapsed}s` : "Create Song"}
      </button>
      {busy && <p className="text-center text-xs text-muted-foreground">This usually takes 30 seconds to a couple of minutes. Keep this screen open.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p>}

      {current && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
          <p className="font-medium">{current.song.title}</p>
          <audio key={current.url} src={current.url} controls autoPlay className="w-full" />
          <div className="flex flex-wrap gap-2">
            <a href={current.url} download={`${current.song.title || "song"}.mp3`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-sm"><Download className="h-4 w-4" /> Download</a>
            <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-sm"><Share2 className="h-4 w-4" /> Share</button>
            <button type="button" onClick={generate} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-sm"><RotateCw className="h-4 w-4" /> Regenerate</button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80">{current.song.lyrics}</pre>
        </div>
      )}

      <StudioMixer
        bpm={bpm}
        onBpm={(b) => { setBpm(b); setAiTempo(false); }}
        song={current ? { url: current.url, title: current.song.title } : null}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">My Songs</h3>
        {songs.length === 0 && <p className="text-xs text-muted-foreground">Your songs are saved here automatically.</p>}
        {songs.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <button type="button" onClick={() => open(s)} className="flex min-h-11 flex-1 items-center gap-2 text-left text-sm">
              <Play className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
            </button>
            <button type="button" aria-label="Delete song" onClick={() => remove(s)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
