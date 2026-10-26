import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Film, GraduationCap, Loader, Mic, Mic2, Plus, Radio, Share2, Square, Trash2, Wand2 } from "lucide-react";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { translate } from "@/lib/translate.functions";
import { coachTurn } from "@/lib/coach.functions";
import { useCountedFn } from "@/hooks/useUsage";
import {
  STUDIO_VOICES, audioToVideo, downloadBlob, extFor, joinClips, shareMedia, synthesize, transcribeFile,
  type SocialTarget,
} from "@/lib/studio-audio";
import { cn } from "@/lib/utils";

type Tab = "voiceover" | "dubbing" | "podcast" | "coach";
const TABS: { key: Tab; label: string; icon: typeof Mic }[] = [
  { key: "voiceover", label: "Voice-over", icon: Mic2 },
  { key: "dubbing", label: "Dubbing", icon: Film },
  { key: "podcast", label: "Podcast", icon: Radio },
  { key: "coach", label: "Studio Coach", icon: GraduationCap },
];

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50";

function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
    </select>
  );
}
function VoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      {STUDIO_VOICES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
    </select>
  );
}

/** Player + save/export/share bar used by every Studio tool. */
function Output({ audio, transcript, name }: { audio: Blob | null; transcript: string; name: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [video, setVideo] = useState<Blob | null>(null);
  const url = audio ? URL.createObjectURL(audio) : null;
  if (!audio && !transcript) return null;
  const stamp = `${name}-${Date.now()}`;
  const audioFile = () => new File([audio!], `${stamp}.${extFor(audio!)}`, { type: audio!.type });
  const textFile = () => new File([transcript], `${stamp}.txt`, { type: "text/plain" });
  const makeVideo = async () => {
    if (video) return video;
    const v = await audioToVideo(audio!, "Neural Duplex Studio", transcript);
    setVideo(v);
    return v;
  };
  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key); setMsg(null);
    try { setMsg((await fn()) || null); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const share = (t: SocialTarget, withVideo: boolean) =>
    run(t, async () => {
      const files: File[] = [];
      if (audio) {
        if (withVideo) {
          const v = await makeVideo();
          files.push(new File([v], `${stamp}.${extFor(v)}`, { type: v.type }));
        } else files.push(audioFile());
      }
      files.push(textFile());
      return (await shareMedia(t, files, transcript)) ?? "Shared.";
    });
  const socials: { t: SocialTarget; label: string; video: boolean }[] = [
    { t: "native", label: "Share…", video: false },
    { t: "whatsapp", label: "WhatsApp", video: false },
    { t: "facebook", label: "Facebook", video: true },
    { t: "instagram", label: "Instagram", video: true },
    { t: "tiktok", label: "TikTok", video: true },
    { t: "youtube", label: "YouTube", video: true },
    { t: "x", label: "X", video: true },
  ];
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      {url && <audio controls src={url} className="w-full" />}
      {transcript && <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm text-foreground/80">{transcript}</p>}
      <div className="flex flex-wrap gap-2">
        {audio && (
          <>
            <button className={ghost} disabled={!!busy} onClick={() => downloadBlob(audio, `${stamp}.${extFor(audio)}`)}>
              <Download className="h-3.5 w-3.5" /> Save audio ({extFor(audio).toUpperCase()})
            </button>
            <button className={ghost} disabled={!!busy} onClick={() => run("video", async () => {
              const v = await makeVideo();
              downloadBlob(v, `${stamp}.${extFor(v)}`);
              return `Video saved (${extFor(v).toUpperCase()}).`;
            })}>
              {busy === "video" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />} Save video
            </button>
          </>
        )}
        <button className={ghost} disabled={!transcript} onClick={() => downloadBlob(textFile(), textFile().name)}>
          <FileText className="h-3.5 w-3.5" /> Save transcript (.txt)
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {socials.map((s) => (
          <button key={s.t} className={ghost} disabled={!!busy} onClick={() => share(s.t, s.video)}>
            {busy === s.t ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} {s.label}
          </button>
        ))}
      </div>
      {msg && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

function useRecorder(onDone: (b: Blob) => void) {
  const rec = useRef<MediaRecorder | null>(null);
  const [on, setOn] = useState(false);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const r = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setOn(false); onDone(new Blob(chunks, { type: r.mimeType })); };
    r.start(); rec.current = r; setOn(true);
  };
  return { on, start, stop: () => rec.current?.stop() };
}

function VoiceOver() {
  const [script, setScript] = useState("");
  const [lang, setLang] = useState("en-US");
  const [voice, setVoice] = useState("alloy");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { setAudio(await synthesize(script, lang, voice)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Paste or type a script (up to 10,000 characters), choose a language and voice, then generate. You can play, save or share the finished audio and transcript.</p>
      <textarea className={cn(field, "min-h-40")} maxLength={10000} placeholder="Type or paste your voice-over script…" value={script} onChange={(e) => setScript(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2"><LangSelect value={lang} onChange={setLang} /><VoiceSelect value={voice} onChange={setVoice} /></div>
      <button className={btn} disabled={busy || !script.trim()} onClick={go}>
        {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate voice-over
      </button>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? script : ""} name="voiceover" />
    </div>
  );
}

function Dubbing() {
  const translateFn = useCountedFn(useServerFn(translate));
  const [from, setFrom] = useState("en-US");
  const [to, setTo] = useState("zu-ZA");
  const [voice, setVoice] = useState("onyx");
  const [source, setSource] = useState<Blob | null>(null);
  const [original, setOriginal] = useState("");
  const [dubbed, setDubbed] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRecorder(setSource);
  const go = async () => {
    setErr(null); setAudio(null);
    try {
      let text = original;
      if (source && !text.trim()) { setStep("Transcribing…"); text = await transcribeFile(source, from); setOriginal(text); }
      if (!text.trim()) throw new Error("No speech found. Upload a clip, record, or type the original text.");
      setStep("Translating…");
      const r = await translateFn({ data: { text, sourceLang: getLanguage(from)?.name ?? from, targetLang: getLanguage(to)?.name ?? to } });
      setDubbed(r.translated);
      setStep("Recording dub…");
      setAudio(await synthesize(r.translated, to, voice));
    } catch (e) { setErr((e as Error).message); } finally { setStep(null); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Record or upload a short audio or video clip. We transcribe what is said, translate it into your chosen language and re-voice it. Clear speech with little background noise works best.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className={ghost}>
          <Plus className="h-3.5 w-3.5" /> Upload audio / video
          <input type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { setSource(e.target.files?.[0] ?? null); setOriginal(""); }} />
        </label>
        <button className={ghost} onClick={() => (rec.on ? rec.stop() : (setOriginal(""), rec.start()))}>
          {rec.on ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {rec.on ? "Stop recording" : "Record"}
        </button>
        {source && <span className="text-xs text-muted-foreground">Clip ready ({Math.round(source.size / 1024)} KB)</span>}
      </div>
      <textarea className={cn(field, "min-h-24")} maxLength={10000} placeholder="Original words (filled automatically from your clip, or type them)" value={original} onChange={(e) => setOriginal(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-3"><LangSelect value={from} onChange={setFrom} /><LangSelect value={to} onChange={setTo} /><VoiceSelect value={voice} onChange={setVoice} /></div>
      <button className={btn} disabled={!!step || (!source && !original.trim())} onClick={go}>
        {step ? <Loader className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {step ?? "Dub it"}
      </button>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? `Original (${getLanguage(from)?.name}):\n${original}\n\nDub (${getLanguage(to)?.name}):\n${dubbed}` : ""} name="dub" />
    </div>
  );
}

interface Line { host: 0 | 1; text: string }
function Podcast() {
  const [title, setTitle] = useState("My podcast");
  const [lang, setLang] = useState("en-US");
  const [voices, setVoices] = useState<[string, string]>(["alloy", "onyx"]);
  const [names, setNames] = useState<[string, string]>(["Host A", "Host B"]);
  const [lines, setLines] = useState<Line[]>([{ host: 0, text: "" }, { host: 1, text: "" }]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const filled = lines.filter((l) => l.text.trim());
  const go = async () => {
    setErr(null); setAudio(null);
    try {
      const clips: Blob[] = [];
      for (let i = 0; i < filled.length; i++) {
        setProgress(`Recording line ${i + 1}/${filled.length}…`);
        clips.push(await synthesize(filled[i].text, lang, voices[filled[i].host]));
      }
      setProgress("Mixing episode…");
      setAudio(await joinClips(clips));
    } catch (e) { setErr((e as Error).message); } finally { setProgress(null); }
  };
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Give your episode a title, choose a language and a voice for each host, then write the lines in order. Each line is spoken by its host and joined into one episode.</p>
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title" />
      <LangSelect value={lang} onChange={setLang} />
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1].map((h) => (
          <div key={h} className="space-y-1">
            <input className={field} value={names[h]} onChange={(e) => setNames((n) => (h ? [n[0], e.target.value] : [e.target.value, n[1]]))} />
            <VoiceSelect value={voices[h]} onChange={(v) => setVoices((x) => (h ? [x[0], v] : [v, x[1]]))} />
          </div>
        ))}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <select className={cn(field, "w-32")} value={l.host} onChange={(e) => set(i, { host: Number(e.target.value) as 0 | 1 })}>
            <option value={0}>{names[0]}</option><option value={1}>{names[1]}</option>
          </select>
          <textarea className={cn(field, "min-h-12")} value={l.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="What they say…" />
          <button className={ghost} aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <button className={ghost} onClick={() => setLines((ls) => [...ls, { host: ls.length % 2 ? 1 : 0, text: "" } as Line])}><Plus className="h-3.5 w-3.5" /> Add line</button>
        <button className={btn} disabled={!!progress || filled.length === 0} onClick={go}>
          {progress ? <Loader className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} {progress ?? "Produce episode"}
        </button>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? `${title}\n\n${filled.map((l) => `${names[l.host]}: ${l.text}`).join("\n")}` : ""} name="podcast" />
    </div>
  );
}

function Coach() {
  const coachFn = useServerFn(coachTurn);
  const [lang, setLang] = useState("en-US");
  const [native, setNative] = useState("en-US");
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const rec = useRecorder(async (b) => {
    setBusy("Listening back…");
    try { setScript(await transcribeFile(b, lang)); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  });
  const go = async () => {
    setErr(null); setBusy("Coaching…");
    try {
      const r = await coachFn({ data: { original: script, translation: script, sourceLang: getLanguage(native)?.name ?? native, targetLang: getLanguage(lang)?.name ?? lang } });
      if (!r) throw new Error("No coaching came back — try a longer line.");
      const text = [
        `Your line: ${script}`, "", `Smoother delivery: ${r.natural}`, `Pronunciation: ${r.pronunciation}`,
        ...(r.vocab.length ? ["", "Key words:", ...r.vocab.map((v) => `• ${v.term} — ${v.meaning}`)] : []),
        ...(r.tip ? ["", `Tip: ${r.tip}`] : []),
      ].join("\n");
      setNotes(text);
      setBusy("Recording reference read…");
      setAudio(await synthesize(r.natural || script, lang, "fable"));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Record or type a line. The coach suggests a smoother read, pronunciation, key words and a reference recording.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><span className="text-xs text-muted-foreground">Performing in</span><LangSelect value={lang} onChange={setLang} /></div>
        <div><span className="text-xs text-muted-foreground">Your language</span><LangSelect value={native} onChange={setNative} /></div>
      </div>
      <textarea className={cn(field, "min-h-24")} maxLength={10000} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Your line…" />
      <div className="flex gap-2">
        <button className={ghost} onClick={() => (rec.on ? rec.stop() : rec.start())}>
          {rec.on ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {rec.on ? "Stop" : "Record my take"}
        </button>
        <button className={btn} disabled={!!busy || !script.trim()} onClick={go}>
          {busy ? <Loader className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} {busy ?? "Coach me"}
        </button>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={notes} name="coach" />
    </div>
  );
}

/** Studio: voice-over, dubbing, podcast and coach, all saveable and shareable. */
export function StudioPro() {
  const [tab, setTab] = useState<Tab>("voiceover");
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
            tab === key ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary",
          )}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {tab === "voiceover" && <VoiceOver />}
      {tab === "dubbing" && <Dubbing />}
      {tab === "podcast" && <Podcast />}
      {tab === "coach" && <Coach />}
    </section>
  );
}
