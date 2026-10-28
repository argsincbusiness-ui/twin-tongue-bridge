import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/lib/api-auth";
import { resolveVoiceStyle, ttsRequestBody } from "@/lib/voice-styles";

/* ---------- Web Speech API typings (minimal) ---------- */
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const hasWebSpeech = () =>
  typeof window !== "undefined" && getRecognitionCtor() !== null;

/* ---------- Speech recognition with MediaRecorder fallback ---------- */

export interface RecognitionResult {
  text: string;
  final: boolean;
}

export interface UseRecognitionOptions {
  lang: string;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Auto-stop after this many ms of silence (Web Speech only). */
  silenceMs?: number;
}

export function useRecognition({ lang, onFinal, onInterim, silenceMs = 1500 }: UseRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedManually = useRef(false);

  const clearSilence = () => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const stop = useCallback(() => {
    stoppedManually.current = true;
    clearSilence();
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
  }, []);

  const startWebSpeech = useCallback(
    (Ctor: SpeechRecognitionCtor) => {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      let finalBuffer = "";

      rec.onresult = (e) => {
        // Discard any recognition results that arrive while TTS is
        // playing — those are almost certainly the mic hearing the
        // device's own speaker (feedback loop), not the user.
        if (ttsActive) {
          try {
            rec.abort();
          } catch {
            /* noop */
          }
          return;
        }
        // Rebuild both strings from scratch every event. Some browsers
        // re-emit earlier results in later `onresult` calls; appending
        // via `resultIndex` causes phrases to duplicate in the live
        // transcript. Rebuilding is idempotent.
        let finalText = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        finalBuffer = finalText;
        if (onInterim) onInterim((finalText + interim).trim());
        clearSilence();
        silenceTimer.current = setTimeout(() => {
          try {
            rec.stop();
          } catch {
            /* noop */
          }
        }, silenceMs);
      };

      rec.onerror = (ev) => {
        if (ev.error !== "no-speech" && ev.error !== "aborted") {
          setError(ev.error);
        }
      };
      rec.onend = () => {
        clearSilence();
        setListening(false);
        recRef.current = null;
        const text = finalBuffer.trim();
        // Same feedback-loop guard for the final result.
        if (text && !ttsActive) onFinal(text);
      };


      recRef.current = rec;
      stoppedManually.current = false;
      try {
        rec.start();
        setListening(true);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [lang, onFinal, onInterim, silenceMs],
  );

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 2048 || ttsActive) {
          setListening(false);
          return;
        }
        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("file", blob, `recording.${ext}`);
        // In auto-detect mode we deliberately send no language hint so the
        // model identifies whatever tongue was spoken.
        if (lang && lang !== "auto") form.append("language", lang);

        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
            headers: await authHeaders(),
          });
          const json = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(json.error ?? "Transcription failed");
          if (json.text && !ttsActive) onFinal(json.text.trim());
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setListening(false);
        }
      };

      mediaRef.current = mr;
      stoppedManually.current = false;
      mr.start();
      setListening(true);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setListening(false);
    }
  }, [lang, onFinal]);

  const start = useCallback(() => {
    if (listening) return;
    // Web Speech needs a fixed locale up front, so auto-detect always
    // records and transcribes server-side instead.
    const Ctor = lang === "auto" ? null : getRecognitionCtor();
    if (Ctor) startWebSpeech(Ctor);
    else void startMediaRecorder();
  }, [lang, listening, startMediaRecorder, startWebSpeech]);


  useEffect(() => () => stop(), [stop]);

  return { listening, error, start, stop };
}

/* ---------- Text-to-speech ---------- */

/**
 * Track the currently playing neural TTS audio element so a new utterance
 * (or reset) cancels the previous one.
 */
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let ttsActive = false;

/** Selected output device (setSinkId) and playback preferences. */
let outputSinkId: string | null = null;
let outputVolume = 1;
let outputRate = 1;

/** Route TTS playback to a specific audio output device, when supported. */
export function setOutputDevice(deviceId: string | null) {
  outputSinkId = deviceId && deviceId !== "default" ? deviceId : null;
}
export function setVoiceVolume(v: number) {
  outputVolume = Math.min(1, Math.max(0, v));
}
export function setVoiceRate(r: number) {
  outputRate = Math.min(2, Math.max(0.5, r));
}
export function getVoicePrefs() {
  return { sinkId: outputSinkId, volume: outputVolume, rate: outputRate };
}

/** True while a TTS utterance is being fetched or played back. */
export function isTtsActive() {
  return ttsActive;
}

function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}


/**
 * Speak text using the same class of neural TTS model that powers
 * ChatGPT / Claude / Gemini voice (OpenAI gpt-4o-mini-tts), proxied
 * through the Lovable AI Gateway. No browser-speechSynthesis fallback:
 * a single neural voice per utterance, never a second (browser) voice.
 */
export function speak(
  text: string,
  lang: string,
  opts: {
    rate?: number;
    pitch?: number;
    voice?: string;
    volume?: number;
    onEnd?: () => void;
    onError?: (message: string) => void;
  } = {},
) {
  if (typeof window === "undefined") {
    opts.onEnd?.();
    return;
  }
  // Stop any previous utterance immediately.
  stopCurrentAudio();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  const trimmed = text.trim();
  if (!trimmed) {
    opts.onEnd?.();
    return;
  }

  // Global voice + style from the shared Voice Selector, resolved for this
  // language (with fallback). Speed multiplies the user's own rate setting.
  const styleSpeed = resolveVoiceStyle(lang).style.speed;

  // Flip the guard synchronously so any in-flight recognition callback
  // that fires between now and audio playback is discarded.
  ttsActive = true;

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    ttsActive = false;
    opts.onEnd?.();
  };

  void (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(ttsRequestBody(trimmed, lang, opts.voice)),
      });
      if (!res.ok || !res.body) {
        let msg = `TTS failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* non-JSON body */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = (opts.rate ?? outputRate) * styleSpeed;
      audio.volume = opts.volume ?? outputVolume;
      if (outputSinkId) {
        const sinkable = audio as HTMLAudioElement & {
          setSinkId?: (id: string) => Promise<void>;
        };
        if (typeof sinkable.setSinkId === "function") {
          // Routing failure must not block playback — fall back to default.
          await sinkable.setSinkId(outputSinkId).catch(() => {});
        }
      }
      currentAudio = audio;
      currentObjectUrl = url;
      audio.onended = () => {
        if (currentAudio === audio) stopCurrentAudio();
        done();
      };
      audio.onerror = () => {
        if (currentAudio === audio) stopCurrentAudio();
        done();
      };
      await audio.play();
    } catch (e) {
      // Neural TTS unavailable — don't swap voices, but tell the user why.
      const msg = (e as Error).message || "Speech playback failed";
      if (opts.onError) opts.onError(msg);
      else if ((e as Error).name !== "NotAllowedError") {
        void import("sonner").then(({ toast }) => toast.error(msg)).catch(() => {});
      }
      done();
    }
  })();
}


/** Cancel any in-flight or playing utterance. */
export function cancelSpeak() {
  ttsActive = false;
  stopCurrentAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

