import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/lib/api-auth";
import { isTtsActive } from "@/hooks/useSpeech";
import { PAUSE_HINT_MS, describeSpeechError, normalizeUtterance } from "@/lib/duplex";

/* ---------- Minimal Web Speech typings ---------- */
type ResultLike = { isFinal: boolean; 0: { transcript: string } };
type EventLike = { results: ArrayLike<ResultLike> };
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type ListenPhase = "silent" | "speaking" | "pausing";
export type ListenEngine = "web-speech" | "recorder" | "none";

export interface ContinuousOptions {
  /** BCP-47 tag, or "auto" to force server-side detection. */
  lang: string;
  /** Trailing silence that finalizes an utterance, in ms. */
  pauseMs: number;
  onUtterance: (text: string) => void;
  onInterim?: (text: string) => void;
  onPhase?: (phase: ListenPhase) => void;
  onError?: (info: { message: string; fatal: boolean }) => void;
  /** Calibrated speech-energy threshold (0–1) from the VAD calibration screen. */
  vadThreshold?: number;
  /** Preferred microphone (recorder engine only; Web Speech uses the OS default). */
  inputDeviceId?: string | null;
}


/** Web Speech drops the session periodically; cap silent restarts. */
const MAX_RESTARTS = 60;
/** Ignore recorder blobs below this size — they contain no usable audio. */
const MIN_BLOB_BYTES = 2048;
const VAD_INTERVAL_MS = 100;
const VAD_FLOOR = 0.012;

/**
 * Continuous listening for Duplex Talk.
 *
 * Unlike the turn-based `useRecognition`, this keeps the microphone open and
 * only finalizes when the speaker has been silent for `pauseMs`. Shorter
 * pauses never cut a sentence in half. Two engines are supported:
 *
 * - `web-speech`: on-device recognition when a fixed locale is selected.
 * - `recorder`: MediaRecorder + Web Audio energy detection, used for
 *   auto-detect (no locale to give the browser) and browsers without the
 *   Web Speech API. Each utterance is uploaded as a complete audio file.
 */
export function useContinuousRecognition(opts: ContinuousOptions) {
  const [listening, setListening] = useState(false);
  const [engine, setEngine] = useState<ListenEngine>("none");

  // Keep callbacks in refs: the listening session must survive re-renders
  // without being torn down and restarted mid-sentence.
  const cb = useRef(opts);
  cb.current = opts;

  const activeRef = useRef(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const finalizingRef = useRef(false);
  const restartsRef = useRef(0);
  const finalBufRef = useRef("");
  const interimBufRef = useRef("");
  const phaseRef = useRef<ListenPhase>("silent");

  const finalizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recorder-engine resources.
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const noiseFloorRef = useRef(VAD_FLOOR);

  const setPhase = useCallback((p: ListenPhase) => {
    if (phaseRef.current === p) return;
    phaseRef.current = p;
    cb.current.onPhase?.(p);
  }, []);

  const clearTimers = useCallback(() => {
    if (finalizeTimer.current) clearTimeout(finalizeTimer.current);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    finalizeTimer.current = null;
    hintTimer.current = null;
  }, []);

  /* ---------------- Web Speech engine ---------------- */

  const emit = useCallback((text: string) => {
    const clean = normalizeUtterance(text);
    finalBufRef.current = "";
    interimBufRef.current = "";
    setPhase("silent");
    // Empty / echo utterances are filtered by the orchestrator, which also
    // owns duplicate detection; always report so it can decide.
    cb.current.onUtterance(clean);
  }, [setPhase]);

  const startWebSpeech = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return false;

    const spawn = () => {
      if (!activeRef.current) return;
      const rec = new Ctor();
      rec.lang = cb.current.lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      finalizingRef.current = false;

      const armTimers = () => {
        clearTimers();
        hintTimer.current = setTimeout(() => setPhase("pausing"), PAUSE_HINT_MS);
        finalizeTimer.current = setTimeout(() => {
          const text = `${finalBufRef.current} ${interimBufRef.current}`;
          finalizingRef.current = true;
          clearTimers();
          try {
            rec.stop();
          } catch {
            /* noop */
          }
          emit(text);
        }, cb.current.pauseMs);
      };

      rec.onresult = (e) => {
        // Echo guard: anything heard while our own TTS plays is the speaker,
        // not the user.
        if (isTtsActive()) return;
        restartsRef.current = 0;
        let finalText = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal) finalText += `${r[0].transcript} `;
          else interim += r[0].transcript;
        }
        // Rebuild (never append) — some browsers re-emit earlier results,
        // which would otherwise duplicate phrases in the transcript.
        finalBufRef.current = finalText;
        interimBufRef.current = interim;
        const live = normalizeUtterance(`${finalText} ${interim}`);
        if (live) {
          setPhase("speaking");
          cb.current.onInterim?.(live);
        }
        armTimers();
      };

      rec.onerror = (ev) => {
        const info = describeSpeechError(ev.error);
        if (info.fatal) {
          activeRef.current = false;
          clearTimers();
          setListening(false);
          setPhase("silent");
        }
        if (info.message && (info.fatal || ev.error !== "no-speech")) {
          cb.current.onError?.(info);
        }
      };

      rec.onend = () => {
        recRef.current = null;
        if (!activeRef.current) {
          clearTimers();
          setListening(false);
          return;
        }
        if (finalizingRef.current) return; // orchestrator restarts the turn
        // Chrome ends the session on its own every ~minute or after silence.
        // Respawn so the conversation keeps flowing.
        restartsRef.current += 1;
        if (restartsRef.current > MAX_RESTARTS) {
          activeRef.current = false;
          setListening(false);
          cb.current.onError?.({
            message: "Speech recognition kept dropping. Tap start to resume.",
            fatal: true,
          });
          return;
        }
        setTimeout(spawn, 120);
      };

      try {
        rec.start();
        recRef.current = rec;
        setListening(true);
      } catch {
        // start() on an already-started instance — safe to ignore.
      }
    };

    spawn();
    return true;
  }, [clearTimers, emit, setPhase]);

  /* ---------------- Recorder + VAD engine ---------------- */

  const uploadSegment = useCallback(async (blob: Blob) => {
    if (blob.size < MIN_BLOB_BYTES || isTtsActive()) return;
    const form = new FormData();
    const type = blob.type.split(";")[0] ?? "";
    const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
    form.append("file", blob, `utterance.${ext}`);
    if (cb.current.lang && cb.current.lang !== "auto") {
      form.append("language", cb.current.lang);
    }
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        headers: await authHeaders(),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Transcription failed (${res.status})`);
      if (json.text && !isTtsActive()) emit(json.text);
    } catch (e) {
      cb.current.onError?.({ message: (e as Error).message, fatal: false });
    }
  }, [emit]);

  const newRecorderSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activeRef.current) return;
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch {
      return;
    }
    chunksRef.current = [];
    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      chunksRef.current = [];
      void uploadSegment(blob);
      // Immediately open a fresh, self-contained segment so no speech is lost.
      if (activeRef.current) newRecorderSegment();
    };
    recorderRef.current = mr;
    try {
      mr.start();
    } catch {
      /* noop */
    }
  }, [uploadSegment]);

  const startRecorder = useCallback(async () => {
    try {
      const deviceId = cb.current.inputDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx!();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      let voiced = false;
      let lastVoiceAt = Date.now();
      noiseFloorRef.current = VAD_FLOOR;

      vadTimer.current = setInterval(() => {
        if (!activeRef.current) return;
        // Never listen to ourselves.
        if (isTtsActive()) {
          lastVoiceAt = Date.now();
          return;
        }
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const rms = Math.sqrt(sum / buf.length);
        // Slowly adapt to the room's noise floor.
        noiseFloorRef.current = Math.min(
          0.05,
          noiseFloorRef.current * 0.98 + Math.min(rms, 0.05) * 0.02,
        );
        const floor = Math.max(VAD_FLOOR, cb.current.vadThreshold ?? VAD_FLOOR);
        const threshold = Math.max(floor, noiseFloorRef.current * 2.2);
        const now = Date.now();


        if (rms > threshold) {
          voiced = true;
          lastVoiceAt = now;
          setPhase("speaking");
          return;
        }
        if (!voiced) return;
        const quietFor = now - lastVoiceAt;
        if (quietFor >= cb.current.pauseMs) {
          voiced = false;
          setPhase("silent");
          const mr = recorderRef.current;
          if (mr && mr.state !== "inactive") mr.stop(); // onstop uploads + reopens
        } else if (quietFor >= PAUSE_HINT_MS) {
          setPhase("pausing");
        }
      }, VAD_INTERVAL_MS);

      newRecorderSegment();
      setListening(true);
    } catch (e) {
      const name = (e as Error).name || (e as Error).message;
      activeRef.current = false;
      setListening(false);
      cb.current.onError?.(describeSpeechError(name));
    }
  }, [newRecorderSegment, setPhase]);

  /* ---------------- Public API ---------------- */

  const stop = useCallback(() => {
    activeRef.current = false;
    finalizingRef.current = true;
    clearTimers();
    setPhase("silent");
    finalBufRef.current = "";
    interimBufRef.current = "";

    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    recRef.current = null;

    if (vadTimer.current) {
      clearInterval(vadTimer.current);
      vadTimer.current = null;
    }
    const mr = recorderRef.current;
    recorderRef.current = null;
    if (mr && mr.state !== "inactive") {
      mr.onstop = null;
      try {
        mr.stop();
      } catch {
        /* noop */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setListening(false);
  }, [clearTimers, setPhase]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    restartsRef.current = 0;
    finalBufRef.current = "";
    interimBufRef.current = "";
    finalizingRef.current = false;

    const useWebSpeech = cb.current.lang !== "auto" && getCtor() !== null;
    if (useWebSpeech) {
      setEngine("web-speech");
      startWebSpeech();
    } else if (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    ) {
      setEngine("recorder");
      void startRecorder();
    } else {
      setEngine("none");
      activeRef.current = false;
      cb.current.onError?.({
        message: "This browser has no microphone or speech support.",
        fatal: true,
      });
    }
  }, [startRecorder, startWebSpeech]);

  useEffect(() => () => stop(), [stop]);

  return { listening, engine, start, stop };
}
