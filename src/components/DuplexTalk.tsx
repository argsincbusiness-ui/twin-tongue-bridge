import { useUsage } from "@/hooks/useUsage";
import { useNavigate } from "@tanstack/react-router";
import { useCountedFn } from "@/hooks/useUsage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Mic,
  Square,
  Loader2,
  Volume2,
  GraduationCap,
  ArrowLeftRight,
  Trash2,
  AlertTriangle,
  Timer,
  Sparkles,
  SlidersHorizontal,
  Keyboard,
  SendHorizonal,


} from "lucide-react";
import { translate } from "@/lib/translate.functions";
import { coachTurn } from "@/lib/coach.functions";
import type { CoachOutput } from "@/lib/coach-schema";
import { useContinuousRecognition, type ListenPhase } from "@/hooks/useContinuousRecognition";
import { speak, cancelSpeak } from "@/hooks/useSpeech";
import { LANGUAGES, AUTO_LANGUAGE, getLanguage, isAutoLang } from "@/lib/languages";
import { VadCalibration } from "@/components/VadCalibration";
import { ShareMenu } from "@/components/ShareMenu";
import { LiveInterpreter } from "@/components/LiveInterpreter";
import { Button } from "@/components/ui/button";
import type { CoachOutput as _C } from "@/lib/coach-schema";

import { cn } from "@/lib/utils";
import {
  DEFAULT_PAUSE_SECONDS,
  ECHO_GUARD_MS,
  PAUSE_OPTIONS,
  clampPauseSeconds,
  decideUtterance,
  otherSide,
  pauseMs,
  phaseHint,
  phaseLabel,
  utteranceKey,
  type DuplexPhase,
  type LastTurn,
  type PauseSeconds,
  type Side,
} from "@/lib/duplex";

interface Turn {
  id: number;
  side: Side;
  original: string;
  translated: string;
  fromLang: string;
  toLang: string;
  speakCode: string;
  via: "voice" | "typed";

  coach?: CoachOutput | null;
  coachLoading?: boolean;
}

interface Props {
  langA: string;
  langB: string;
  onLangA: (code: string) => void;
  onLangB: (code: string) => void;
}

const SIDE_LABEL: Record<Side, string> = { a: "Speaker A", b: "Speaker B" };

export function DuplexTalk({ langA, langB, onLangA, onLangB }: Props) {
  const translateFn = useCountedFn(useServerFn(translate));
  const coachFn = useServerFn(coachTurn);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<DuplexPhase>("idle");
  const [side, setSide] = useState<Side>("a");
  const [seconds, setSeconds] = useState<PauseSeconds>(DEFAULT_PAUSE_SECONDS);
  const [learning, setLearning] = useState(false);
  const { usage } = useUsage();
  const navigate = useNavigate();
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [vadThreshold, setVadThreshold] = useState<number | undefined>(undefined);
  /** SPEAK = hands-free mic mode, TYPE = keyboard input for the active speaker. */
  const [mode, setMode] = useState<"speak" | "type" | "live">("speak");
  const [draft, setDraft] = useState("");



  // Mirrors for values read inside long-lived callbacks.
  const runningRef = useRef(running);
  runningRef.current = running;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const sideRef = useRef(side);
  sideRef.current = side;
  const learningRef = useRef(learning);
  learningRef.current = learning;
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  /** Invalidates in-flight async work when the user stops or switches. */
  const epochRef = useRef(0);
  const lastTurnRef = useRef<LastTurn | null>(null);
  const turnIdRef = useRef(0);
  const recARef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const recBRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const recFor = useCallback(
    (s: Side) => (s === "a" ? recARef.current : recBRef.current),
    [],
  );

  const stopAllMics = useCallback(() => {
    recARef.current?.stop();
    recBRef.current?.stop();
  }, []);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2600);
  }, []);

  /** Open the mic for a side and enter the listening state. */
  const listenOn = useCallback(
    (s: Side) => {
      if (!runningRef.current) return;
      stopAllMics();
      sideRef.current = s;
      setSide(s);
      setInterim("");
      setPhase("listening");
      phaseRef.current = "listening";
      // Small delay so the previous recogniser fully releases the device.
      setTimeout(() => {
        if (!runningRef.current || sideRef.current !== s) return;
        recFor(s)?.start();
      }, 80);
    },
    [recFor, stopAllMics],
  );

  const fetchCoaching = useCallback(
    async (turnId: number, epoch: number, payload: {
      original: string;
      translation: string;
      sourceLang: string;
      targetLang: string;
    }) => {
      try {
        const result = (await coachFn({ data: payload })) as CoachOutput | null;
        if (epochRef.current !== epoch) return;
        setTurns((list) =>
          list.map((t) => (t.id === turnId ? { ...t, coach: result, coachLoading: false } : t)),
        );
      } catch {
        // Learning Mode is additive: never interrupt the conversation.
        setTurns((list) =>
          list.map((t) => (t.id === turnId ? { ...t, coach: null, coachLoading: false } : t)),
        );
      }
    },
    [coachFn],
  );

  /** Core turn pipeline: translate → speak → hand over to the other side. */
  const runTurn = useCallback(
    async (from: Side, text: string, opts?: { typed?: boolean }) => {
      const typed = opts?.typed === true;
      const epoch = ++epochRef.current;
      const to = otherSide(from);
      const sourceCode = from === "a" ? langA : langB;
      const targetRaw = from === "a" ? langB : langA;
      const targetCode = isAutoLang(targetRaw) ? "en-US" : targetRaw;
      const sourceName = isAutoLang(sourceCode) ? "auto" : getLanguage(sourceCode).name;
      const targetName = getLanguage(targetCode).name;
      // Typed turns are valid even when continuous listening is off.
      const alive = () => epochRef.current === epoch && (typed || runningRef.current);

      stopAllMics();
      setInterim("");
      setPhase("translating");
      phaseRef.current = "translating";
      setError(null);

      try {
        const result = await translateFn({
          data: {
            text,
            sourceLang: sourceName,
            targetLang: targetName,
            history: turnsRef.current.slice(-10).map((t) => ({
              from: t.fromLang,
              to: t.toLang,
              original: t.original,
              translated: t.translated,
            })),
          },
        });
        if (!alive()) return;

        const spoken = result.translated.trim();
        const id = ++turnIdRef.current;
        const turn: Turn = {
          id,
          side: from,
          original: text,
          translated: spoken,
          fromLang: isAutoLang(sourceCode) ? (result.detectedLang ?? "auto") : getLanguage(sourceCode).name,
          toLang: targetName,
          speakCode: targetCode,
          via: typed ? "typed" : "voice",
          coachLoading: learningRef.current,
        };
        setTurns((list) => [...list.slice(-49), turn]);

        if (learningRef.current) {
          void fetchCoaching(id, epoch, {
            original: text,
            translation: spoken,
            sourceLang: turn.fromLang === "auto" ? "the speaker's language" : turn.fromLang,
            targetLang: targetName,
          });
        }

        setPhase("speaking");
        phaseRef.current = "speaking";
        speak(spoken, targetCode, {
          onEnd: () => {
            if (epochRef.current !== epoch) return;
            if (!runningRef.current) {
              // Typed turn outside continuous mode: settle back to idle.
              setPhase("idle");
              phaseRef.current = "idle";
              setSide(to);
              sideRef.current = to;
              return;
            }
            setPhase("switching");
            phaseRef.current = "switching";
            if (resumeTimer.current) clearTimeout(resumeTimer.current);
            // Echo guard: let the speaker fully drain before re-opening the mic.
            resumeTimer.current = setTimeout(() => {
              if (epochRef.current !== epoch || !runningRef.current) return;
              listenOn(to);
            }, ECHO_GUARD_MS);
          },
        });
      } catch (e) {
        if (epochRef.current !== epoch) return;
        setError((e as Error).message);
        if (runningRef.current) {
          // Recoverable: keep the conversation alive on the same speaker.
          listenOn(from);
        } else {
          setPhase(typed ? "idle" : "error");
          phaseRef.current = typed ? "idle" : "error";
        }
      }
    },
    [fetchCoaching, langA, langB, listenOn, stopAllMics, translateFn],
  );

  /** Send a typed message through the same pipeline as a spoken one. */
  const sendTyped = useCallback(() => {
    const text = draft.trim();
    if (!text || phaseRef.current === "translating" || phaseRef.current === "speaking") return;
    setDraft("");
    lastTurnRef.current = { key: utteranceKey(text), at: Date.now() };
    void runTurn(sideRef.current, text, { typed: true });
  }, [draft, runTurn]);


  /** Gatekeeper for finalized utterances. */
  const handleUtterance = useCallback(
    (from: Side, text: string) => {
      if (!runningRef.current || sideRef.current !== from) return;
      const decision = decideUtterance({
        text,
        phase: phaseRef.current,
        previous: lastTurnRef.current,
        now: Date.now(),
      });
      if (decision === "ignore-empty") {
        // Nothing usable — silently keep listening on the same side.
        listenOn(from);
        return;
      }
      if (decision === "ignore-duplicate") {
        flashNotice("Skipped a repeated phrase");
        listenOn(from);
        return;
      }
      if (decision === "ignore-busy") return;

      lastTurnRef.current = { key: utteranceKey(text), at: Date.now() };
      void runTurn(from, text);
    },
    [flashNotice, listenOn, runTurn],
  );

  const handlePhase = useCallback((from: Side, p: ListenPhase) => {
    if (!runningRef.current || sideRef.current !== from) return;
    if (phaseRef.current !== "listening" && phaseRef.current !== "waiting") return;
    const next: DuplexPhase = p === "pausing" ? "waiting" : "listening";
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const handleError = useCallback(
    (info: { message: string; fatal: boolean }) => {
      if (!info.message) return;
      setError(info.message);
      if (info.fatal) {
        runningRef.current = false;
        setRunning(false);
        epochRef.current++;
        stopAllMics();
        cancelSpeak();
        setPhase("error");
      }
    },
    [stopAllMics],
  );

  const recA = useContinuousRecognition({
    lang: langA,
    pauseMs: pauseMs(seconds),
    onUtterance: (t) => handleUtterance("a", t),
    onInterim: (t) => sideRef.current === "a" && setInterim(t),
    onPhase: (p) => handlePhase("a", p),
    onError: handleError,
    vadThreshold,

  });
  const recB = useContinuousRecognition({
    lang: langB,
    pauseMs: pauseMs(seconds),
    onUtterance: (t) => handleUtterance("b", t),
    onInterim: (t) => sideRef.current === "b" && setInterim(t),
    onPhase: (p) => handlePhase("b", p),
    onError: handleError,
    vadThreshold,

  });
  recARef.current = recA;
  recBRef.current = recB;

  const stopConversation = useCallback(() => {
    epochRef.current++;
    runningRef.current = false;
    setRunning(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    stopAllMics();
    cancelSpeak();
    setInterim("");
    setPhase("idle");
    phaseRef.current = "idle";
  }, [stopAllMics]);

  const startConversation = useCallback(() => {
    setError(null);
    lastTurnRef.current = null;
    epochRef.current++;
    runningRef.current = true;
    setRunning(true);
    listenOn(sideRef.current);
  }, [listenOn]);

  /** Manual hand-over; safe to hammer thanks to epoch invalidation. */
  const switchSpeaker = useCallback(() => {
    const next = otherSide(sideRef.current);
    epochRef.current++;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    cancelSpeak();
    lastTurnRef.current = null;
    if (runningRef.current) listenOn(next);
    else {
      sideRef.current = next;
      setSide(next);
    }
  }, [listenOn]);

  const clearConversation = useCallback(() => {
    setTurns([]);
    lastTurnRef.current = null;
    setError(null);
    setInterim("");
  }, []);

  const replay = useCallback((turn: Turn) => {
    cancelSpeak();
    speak(turn.translated, turn.speakCode);
  }, []);

  // Changing the threshold mid-conversation restarts the mic so the new
  // value takes effect on the very next sentence.
  useEffect(() => {
    if (!runningRef.current) return;
    if (phaseRef.current !== "listening" && phaseRef.current !== "waiting") return;
    listenOn(sideRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    cancelSpeak();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const speakerLabel = SIDE_LABEL[side];
  const nextLabel = SIDE_LABEL[otherSide(side)];
  const label = phaseLabel(phase, { speakerLabel, nextSpeakerLabel: nextLabel });
  const hint = phaseHint(phase, seconds);
  const accent = side === "a" ? "var(--color-speaker-a)" : "var(--color-speaker-b)";
  const busy = phase === "translating";
  const engineNote = useMemo(() => {
    const active = side === "a" ? recA.engine : recB.engine;
    if (!running || active === "none") return null;
    return active === "recorder" ? "Cloud transcription" : "On-device recognition";
  }, [recA.engine, recB.engine, running, side]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Language pair + settings */}
      <section className="panel-surface flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <LangSelect
            label="Speaker A"
            value={langA}
            onChange={onLangA}
            accent="var(--color-speaker-a)"
            active={side === "a" && running}
          />
          <button
            type="button"
            onClick={switchSpeaker}
            aria-label="Switch active speaker"
            className="mt-5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-secondary/60 text-foreground/80 transition-colors hover:bg-secondary"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <LangSelect
            label="Speaker B"
            value={langB}
            onChange={onLangB}
            accent="var(--color-speaker-b)"
            active={side === "b" && running}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Pause
            </span>
            <div
              role="radiogroup"
              aria-label="End-of-sentence pause threshold in seconds"
              className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1"
            >
              {PAUSE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={seconds === s}
                  onClick={() => setSeconds(clampPauseSeconds(s))}
                  className={cn(
                    "min-w-9 rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                    seconds === s
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-secondary",
                  )}
                >
                  {s}s{s === 3 ? "" : ""}
                </button>
              ))}
            </div>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              3s recommended
            </span>
            <button
              type="button"
              onClick={() => setCalibrating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 hover:bg-secondary"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Calibrate
            </button>
          </div>


          <button
            type="button"
            onClick={() => {
              if (!usage?.pro) { navigate({ to: "/upgrade" }); return; }
              setLearning((v) => !v);
            }}
            aria-pressed={learning}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              learning
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-secondary/60 text-foreground/80 hover:bg-secondary",
            )}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Learning Mode {usage && !usage.pro ? "(Pro)" : learning ? "On" : "Off"}
          </button>
        </div>
      </section>

      <div role="radiogroup" aria-label="Interpreter mode" className="flex flex-wrap gap-2">
        {(["speak", "type", "live"] as const).map((m) => <Button key={m} role="radio" aria-checked={mode === m} variant={mode === m ? "default" : "outline"} onClick={() => { if (m !== mode) { stopConversation(); setMode(m); } }}>{m === "live" ? "Live Interpreter" : m === "type" ? "Type" : "Speak"}</Button>)}
      </div>
      {mode === "live" ? <LiveInterpreter key={`${langA}:${langB}`} langA={langA} langB={langB} /> : <>
      {/* Live state */}
      <section
        className="panel-surface relative flex flex-col items-center gap-3 p-6 text-center"
        aria-live="polite"
      >
        <div
          role="radiogroup"
          aria-label="Input mode"
          className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1"
        >
          {(["speak", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                if (m === mode) return;
                if (m === "type" && runningRef.current) stopConversation();
                setMode(m);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              {m === "speak" ? <Mic className="h-3.5 w-3.5" /> : <Keyboard className="h-3.5 w-3.5" />}
              {m}
            </button>
          ))}
        </div>

        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
          style={{ background: `color-mix(in oklch, ${accent} 18%, transparent)`, color: accent }}
        >
          {speakerLabel}
        </span>

        {mode === "speak" ? (
          <button
            type="button"
            onClick={running ? stopConversation : startConversation}
            className={cn(
              "relative grid h-28 w-28 place-items-center rounded-full text-primary-foreground transition-transform active:scale-95",
              (phase === "listening" || phase === "waiting") && "mic-pulse",
            )}
            style={{
              backgroundColor: running ? accent : "var(--color-primary)",
              boxShadow: running ? `0 0 60px -10px ${accent}` : undefined,
            }}
            aria-label={running ? "Stop conversation" : "Start conversation"}
          >
            {busy ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : phase === "speaking" ? (
              <Volume2 className="h-10 w-10" />
            ) : running ? (
              <Square className="h-9 w-9" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </button>
        ) : (
          <div className="flex w-full max-w-prose flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendTyped();
                }
              }}
              rows={3}
              maxLength={10000}
              aria-label={`Type a message as ${speakerLabel}`}
              placeholder={`Type as ${speakerLabel} — it will be translated and spoken aloud`}
              className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2"
              style={{ ["--tw-ring-color" as string]: accent }}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={switchSpeaker}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> Switch to {nextLabel}
              </button>
              <button
                type="button"
                onClick={sendTyped}
                disabled={!draft.trim() || phase === "translating" || phase === "speaking"}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {phase === "translating" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SendHorizonal className="h-3.5 w-3.5" />
                )}
                Translate & speak
              </button>
            </div>
          </div>
        )}

        <div className="min-h-[3.25rem]">
          <p className="font-display text-lg leading-tight" style={{ color: accent }}>
            {mode === "type" && phase === "idle" ? `Typing as ${speakerLabel}` : label}
          </p>
          <p className="text-xs text-muted-foreground">
            {mode === "type" && phase === "idle"
              ? "Enter to send · Shift+Enter for a new line"
              : hint}
          </p>
        </div>

        {mode === "speak" && interim && (phase === "listening" || phase === "waiting") && (
          <p className="max-w-prose rounded-xl bg-secondary/40 px-3 py-2 text-sm text-foreground/80">
            {interim}
          </p>
        )}

        {mode === "speak" && running && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={switchSpeaker}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Switch to {nextLabel}
            </button>
            {engineNote && (
              <span className="text-[11px] text-muted-foreground">{engineNote}</span>
            )}
          </div>
        )}


        {notice && <p className="text-[11px] text-muted-foreground">{notice}</p>}
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Conversation */}
      <section className="panel-surface flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Conversation
          </h2>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-secondary"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div ref={listRef} className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No messages yet. Choose both languages, then tap the mic and speak—or type a message. Each translated turn appears here, ready to replay or share.
            </p>
          ) : (
            turns.map((t) => (
              <TurnCard key={t.id} turn={t} onReplay={() => replay(t)} />
            ))
          )}
        </div>
      </section>
      </>}
      <VadCalibration
        open={calibrating}
        onClose={() => setCalibrating(false)}
        onApply={({ pause, threshold }) => {
          setSeconds(pause);
          setVadThreshold(threshold);
          setNotice(`Calibrated: pause set to ${pause}s for this room.`);
        }}
      />
    </div>
  );

}

function LangSelect({
  label,
  value,
  onChange,
  accent,
  active,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  accent: string;
  active: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className="mb-1 truncate text-[10px] uppercase tracking-widest"
        style={{ color: active ? accent : "var(--color-muted-foreground)" }}
      >
        {label}
      </p>
      <select
        aria-label={`${label} language`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-lg border border-border bg-secondary/60 px-2.5 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: accent }}
      >
        <option value={AUTO_LANGUAGE.code}>{AUTO_LANGUAGE.flag} Auto-detect</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TurnCard({ turn, onReplay }: { turn: Turn; onReplay: () => void }) {
  const accent =
    turn.side === "a" ? "var(--color-speaker-a)" : "var(--color-speaker-b)";
  return (
    <article
      className="rounded-xl border border-border/70 bg-secondary/25 p-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>
          {SIDE_LABEL[turn.side]} · {turn.fromLang} → {turn.toLang}
          {turn.via === "typed" ? " · typed" : ""}

        </span>
        <button
          type="button"
          onClick={onReplay}
          aria-label="Replay translation"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium text-foreground/80 hover:bg-secondary"
        >
          <Volume2 className="h-3 w-3" /> Replay
        </button>
        <ShareMenu
          size="xs"
          direction="down"
          text={turn.original}
          translation={turn.translated}
          lang={turn.speakCode}
          sourceLangLabel={turn.fromLang}
          targetLangLabel={turn.toLang}
          notes={turn.coach ? coachNotes(turn.coach) : undefined}
        />
      </div>
      <p className="text-sm text-foreground/70 break-words">{turn.original}</p>
      <p
        className="mt-1 font-display text-lg leading-snug break-words"
        style={{ color: accent }}
      >
        {turn.translated}
      </p>

      {turn.coachLoading && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Preparing learning notes…
        </p>
      )}
      {turn.coach && <LearningCard coach={turn.coach} />}
      {turn.coach && (
        <div className="mt-2 flex justify-end">
          <ShareMenu
            size="xs"
            label="Share notes"
            text={turn.original}
            translation={turn.coach.natural || turn.translated}
            lang={turn.speakCode}
            sourceLangLabel={turn.fromLang}
            targetLangLabel={turn.toLang}
            notes={coachNotes(turn.coach)}
          />
        </div>
      )}
    </article>
  );
}

function coachNotes(c: _C): string {
  const l = ["Learning notes:"];
  if (c.natural) l.push(`More natural: ${c.natural}`);
  if (c.pronunciation) l.push(`Say it like: ${c.pronunciation}`);
  c.vocab.forEach((v) => l.push(`- ${v.term} — ${v.meaning}`));
  if (c.tip) l.push(`Tip: ${c.tip}`);
  return l.join("\n");
}

function LearningCard({ coach }: { coach: CoachOutput }) {
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-background/60 p-3">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Learning notes
      </p>
      {coach.natural && (
        <p className="text-xs">
          <span className="text-muted-foreground">More natural: </span>
          <span className="text-foreground/90">{coach.natural}</span>
        </p>
      )}
      {coach.pronunciation && (
        <p className="text-xs">
          <span className="text-muted-foreground">Say it like: </span>
          <span className="font-mono text-foreground/90">{coach.pronunciation}</span>
        </p>
      )}
      {coach.vocab.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {coach.vocab.map((v) => (
            <li
              key={v.term}
              className="rounded-md bg-secondary/60 px-2 py-1 text-[11px]"
              title={v.meaning}
            >
              <span className="font-semibold">{v.term}</span>
              <span className="text-muted-foreground"> — {v.meaning}</span>
            </li>
          ))}
        </ul>
      )}
      {coach.tip && <p className="text-[11px] italic text-muted-foreground">{coach.tip}</p>}
    </div>
  );
}
