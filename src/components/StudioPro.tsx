import { useEffect, useRef, useState } from "react";
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
import { VoiceSelector } from "@/components/VoiceSelector";
import { Button } from "@/components/ui/button";
import { logStudioGeneration, writePodcastScript } from "@/lib/studio.functions";
import { dubOriginalVideo } from "@/lib/studio/original-video";
import { libraryTitle } from "@/lib/videos";
import { readMediaDuration, saveVideo } from "@/lib/videos-library";
import type { StudioUsageInput } from "@/lib/studio/schema";
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
function Output({ audio, transcript, name, originalVideo, library }: { audio: Blob | null; transcript: string; name: string; originalVideo?: Blob | null; library?: { tool: string; language: string } }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [video, setVideo] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const renderAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    setVideo(null); setMsg(null);
    const next = audio ? URL.createObjectURL(audio) : null;
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); renderAbort.current?.abort(); };
  }, [audio, originalVideo]);
  if (!audio && !transcript) return null;
  const stamp = `${name}-${Date.now()}`;
  const audioFile = () => { if (!audio) throw new Error("Generate audio first."); return new File([audio], `${stamp}.${extFor(audio)}`, { type: audio.type }); };
  const textFile = () => new File([transcript], `${stamp}.txt`, { type: "text/plain" });
  const makeVideo = async () => {
    if (video) return video;
    if (!audio) throw new Error("Generate audio first.");
    const v = await audioToVideo(audio, "Neural Duplex Studio", transcript);
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
            <Button variant="ghost" className={ghost} disabled={!!busy} onClick={() => downloadBlob(audio, `${stamp}.${extFor(audio)}`)}>
              <Download className="h-3.5 w-3.5" /> Save audio ({extFor(audio).toUpperCase()})
            </Button>
            <Button variant="ghost" className={ghost} disabled={!!busy} onClick={() => run("video", async () => {
              const v = await makeVideo();
              downloadBlob(v, `${stamp}.${extFor(v)}`);
              return `Video saved (${extFor(v).toUpperCase()}).`;
            })}>
              {busy === "video" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />} Save video
            </Button>
            {originalVideo && <Button variant="outline" size="sm" className="h-auto whitespace-normal text-left" disabled={!!busy} onClick={() => run("original", async () => {
              const controller = new AbortController(); renderAbort.current = controller;
              setMsg("Rendering original footage…");
              const result = await dubOriginalVideo(originalVideo, audio, setMsg, controller.signal);
              downloadBlob(result.video, `${stamp}-original.${extFor(result.video)}`);
              return `Video saved (original footage). ${result.warning}`;
            })}>
              {busy === "original" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />} Save video (original footage)
            </Button>}
            {library && <Button variant="outline" size="sm" className="h-auto whitespace-normal text-left" disabled={!!busy} onClick={() => run("library", async () => {
              const controller = new AbortController(); renderAbort.current = controller;
              setMsg("Preparing video…");
              const v = originalVideo ? (await dubOriginalVideo(originalVideo, audio, setMsg, controller.signal)).video : await makeVideo();
              setMsg("Saving to your Videos…");
              const durationSeconds = await readMediaDuration(audio);
              const saved = await saveVideo(v, {
                tool: library.tool,
                language: library.language,
                title: libraryTitle(library.tool, getLanguage(library.language)?.name ?? library.language),
                durationSeconds,
              });
              return `Saved to your Videos page as “${saved.title}”.`;
            })}>
              {busy === "library" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Save to my Videos
            </Button>}
          </>
        )}
        <Button variant="ghost" className={ghost} disabled={!transcript} onClick={() => downloadBlob(textFile(), textFile().name)}>
          <FileText className="h-3.5 w-3.5" /> Save transcript (.txt)
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {socials.map((s) => (
          <Button variant="ghost" key={s.t} className={ghost} disabled={!!busy} onClick={() => share(s.t, s.video)}>
            {busy === s.t ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} {s.label}
          </Button>
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

function useStudioLog() {
  const log = useServerFn(logStudioGeneration);
  return (tool: StudioUsageInput["tool"], language: string, characterCount: number) =>
    log({ data: { tool, language, characterCount } });
}

function VoiceOver() {
  const log = useStudioLog();
  const [script, setScript] = useState("");
  const [lang, setLang] = useState("en-US");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { setAudio(await synthesize(script, lang)); await log("voice-over", lang, script.length); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Paste or type a script (up to 10,000 characters), choose a language and voice, then generate. You can play, save or share the finished audio and transcript.</p>
      <textarea className={cn(field, "min-h-40")} maxLength={10000} placeholder="Type or paste your voice-over script…" value={script} onChange={(e) => setScript(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2"><LangSelect value={lang} onChange={setLang} /></div>
      <VoiceSelector lang={lang} />
      <Button variant="ghost" className={btn} disabled={busy || !script.trim()} onClick={go}>
        {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate voice-over
      </Button>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? script : ""} name="voiceover" />
    </div>
  );
}

function Dubbing() {
  const log = useStudioLog();
  const [putOnOriginal, setPutOnOriginal] = useState(false);
  const [dubVideo, setDubVideo] = useState<Blob | null>(null);
  const translateFn = useCountedFn(useServerFn(translate));
  const [from, setFrom] = useState("en-US");
  const [to, setTo] = useState("zu-ZA");
  const [source, setSource] = useState<Blob | null>(null);
  const [original, setOriginal] = useState("");
  const [dubbed, setDubbed] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRecorder((clip) => { setSource(clip); setPutOnOriginal(false); setAudio(null); setDubVideo(null); });
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
      setAudio(await synthesize(r.translated, to));
      setDubVideo(putOnOriginal && source?.type.startsWith("video/") ? source : null);
      await log("dubbing", to, r.translated.length);
    } catch (e) { setErr((e as Error).message); } finally { setStep(null); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Record or upload a short audio or video clip. We transcribe what is said, translate it into your chosen language and re-voice it. Clear speech with little background noise works best. This is a voice dub, not lip-sync.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className={ghost}>
          <Plus className="h-3.5 w-3.5" /> Upload audio / video
          <input type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setSource(file); setOriginal(""); setAudio(null); setDubVideo(null); setPutOnOriginal(file?.type.startsWith("video/") ?? false); }} />
        </label>
        <Button variant="ghost" className={ghost} onClick={() => (rec.on ? rec.stop() : (setOriginal(""), rec.start()))}>
          {rec.on ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {rec.on ? "Stop recording" : "Record"}
        </Button>
        {source && <span className="text-xs text-muted-foreground">Clip ready ({Math.round(source.size / 1024)} KB)</span>}
      </div>
      {source?.type.startsWith("video/") && <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={putOnOriginal} disabled={!!step} onChange={e => setPutOnOriginal(e.target.checked)} /> Put dub on original video
      </label>}
      <textarea className={cn(field, "min-h-24")} maxLength={10000} placeholder="Original words (filled automatically from your clip, or type them)" value={original} onChange={(e) => setOriginal(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2"><LangSelect value={from} onChange={setFrom} /><LangSelect value={to} onChange={setTo} /></div>
      <VoiceSelector lang={to} />
      <Button variant="ghost" className={btn} disabled={!!step || (!source && !original.trim())} onClick={go}>
        {step ? <Loader className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {step ?? "Dub it"}
      </Button>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? `Original (${getLanguage(from)?.name}):\n${original}\n\nDub (${getLanguage(to)?.name}):\n${dubbed}` : ""} name="dub" originalVideo={dubVideo} />
    </div>
  );
}

interface Line { host: 0 | 1; text: string }
function Podcast() {
  const log = useStudioLog();
  const writeScript = useServerFn(writePodcastScript);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "energetic">("friendly");
  const [length, setLength] = useState<"short" | "medium" | "long">("short");
  const [writing, setWriting] = useState(false);
  const write = async () => {
    if (!topic.trim() || topic.length > 10000) { setErr("Type a topic or paste up to 10,000 characters first."); return; }
    setWriting(true); setErr(null);
    try {
      const result = await writeScript({ data: { input: topic, tone, length, language: getLanguage(lang)?.name ?? lang } });
      if (result.error || !result.lines) throw new Error(result.error || "No script came back. Please try again later.");
      setLines(result.lines); setNames(["Host A", "Host B"]); setAudio(null);
    } catch (e) { setErr((e as Error).message); } finally { setWriting(false); }
  };
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
      await log("podcast", lang, filled.reduce((sum, line) => sum + line.text.length, 0));
    } catch (e) { setErr((e as Error).message); } finally { setProgress(null); }
  };
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Give your episode a title, choose a language and a voice for each host, then write the lines in order. Each line is spoken by its host and joined into one episode.</p>
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title" />
      <LangSelect value={lang} onChange={setLang} />
      <VoiceSelector lang={lang} voiceControl={false} />
      <fieldset className="space-y-2 border-y border-border py-3" disabled={writing || !!progress}>
        <legend className="px-1 text-sm font-medium">Write script for me</legend>
        <textarea aria-label="Podcast topic or source text" className={cn(field, "min-h-24")} maxLength={10000} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Paste text or type a topic…" />
        <p className="text-xs text-muted-foreground">{topic.length.toLocaleString()} / 10,000</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Tone<select aria-label="Script tone" className={field} value={tone} onChange={e => setTone(e.target.value as typeof tone)}><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="energetic">Energetic</option></select></label>
          <label className="text-xs text-muted-foreground">Length<select aria-label="Script length" className={field} value={length} onChange={e => setLength(e.target.value as typeof length)}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label>
        </div>
        <Button size="sm" disabled={writing || !!progress || !topic.trim()} onClick={write}>{writing ? <Loader className="animate-spin" /> : <Wand2 />} {writing ? "Writing script…" : "Write script"}</Button>
      </fieldset>
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
          <select className={cn(field, "w-24 shrink-0 sm:w-32")} value={l.host} onChange={(e) => set(i, { host: Number(e.target.value) as 0 | 1 })}>
            <option value={0}>{names[0]}</option><option value={1}>{names[1]}</option>
          </select>
          <textarea className={cn(field, "min-h-12 min-w-0")} value={l.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="What they say…" />
          <Button variant="ghost" className={ghost} aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="ghost" className={ghost} onClick={() => setLines((ls) => [...ls, { host: ls.length % 2 ? 1 : 0, text: "" } as Line])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
        <Button variant="ghost" className={btn} disabled={writing || !!progress || filled.length === 0} onClick={go}>
          {progress ? <Loader className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} {progress ?? "Produce episode"}
        </Button>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Output audio={audio} transcript={audio ? `${title}\n\n${filled.map((l) => `${names[l.host]}: ${l.text}`).join("\n")}` : ""} name="podcast" />
    </div>
  );
}

function Coach() {
  const log = useStudioLog();
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
      setAudio(await synthesize(r.natural || script, lang));
      await log("coach", lang, script.length);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Record or type a line. The coach suggests a smoother read, pronunciation, key words and a reference recording.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><span className="text-xs text-muted-foreground">Performing in</span><LangSelect value={lang} onChange={setLang} /></div>
        <div><span className="text-xs text-muted-foreground">Your language</span><LangSelect value={native} onChange={setNative} /></div>
      </div>
      <VoiceSelector lang={lang} />
      <textarea className={cn(field, "min-h-24")} maxLength={10000} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Your line…" />
      <div className="flex gap-2">
        <Button variant="ghost" className={ghost} onClick={() => (rec.on ? rec.stop() : rec.start())}>
          {rec.on ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {rec.on ? "Stop" : "Record my take"}
        </Button>
        <Button variant="ghost" className={btn} disabled={!!busy || !script.trim()} onClick={go}>
          {busy ? <Loader className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} {busy ?? "Coach me"}
        </Button>
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
          <Button variant="ghost" key={key} onClick={() => setTab(key)} className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
            tab === key ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary",
          )}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </Button>
        ))}
      </div>
      {tab === "voiceover" && <VoiceOver />}
      {tab === "dubbing" && <Dubbing />}
      {tab === "podcast" && <Podcast />}
      {tab === "coach" && <Coach />}
    </section>
  );
}
