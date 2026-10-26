import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Check, Loader2, Mic, X } from "lucide-react";
import {
  buildNoiseProfile,
  CALIBRATION_MS,
  CALIBRATION_TICK_MS,
  meterPercent,
  noiseAdvice,
  NOISE_LABEL,
  type NoiseProfile,
} from "@/lib/vad-calibration";
import { describeSpeechError, type PauseSeconds } from "@/lib/duplex";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when the user accepts the recommendation. */
  onApply: (result: { pause: PauseSeconds; threshold: number }) => void;
}

type Stage = "intro" | "measuring" | "done" | "error";

/**
 * Ambient-noise calibration: listens to the room for a few seconds, measures
 * the RMS energy floor, and recommends a pause threshold that won't cut the
 * speaker off in that environment.
 */
export function VadCalibration({ open, onClose, onApply }: Props) {
  const [stage, setStage] = useState<Stage>("intro");
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<NoiseProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (!open) {
      cleanup();
      setStage("intro");
      setProfile(null);
      setLevel(0);
      setProgress(0);
      setError(null);
    }
  }, [open, cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setProfile(null);
    setLevel(0);
    setProgress(0);
    setStage("measuring");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Raw signal: no suppression, so we measure the real room.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("AudioContext unavailable");
      const ctx = new Ctor();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      const samples: number[] = [];
      const startedAt = Date.now();

      timerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const rms = Math.sqrt(sum / buf.length);
        samples.push(rms);
        setLevel(meterPercent(rms));
        const elapsed = Date.now() - startedAt;
        setProgress(Math.min(100, Math.round((elapsed / CALIBRATION_MS) * 100)));
        if (elapsed >= CALIBRATION_MS) {
          cleanup();
          setLevel(0);
          setProfile(buildNoiseProfile(samples));
          setStage("done");
        }
      }, CALIBRATION_TICK_MS);
    } catch (e) {
      cleanup();
      const code = (e as { name?: string }).name ?? "unknown";
      setError(describeSpeechError(code).message || "Couldn't access the microphone.");
      setStage("error");
    }
  }, [cleanup]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Microphone calibration"
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
    >
      <div className="panel-surface flex w-full max-w-md flex-col gap-4 rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Calibrate your room</h2>
            <p className="text-xs text-muted-foreground">
              Stay quiet for {Math.round(CALIBRATION_MS / 1000)} seconds — we'll measure the
              background noise and pick the best pause length.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calibration"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60 text-foreground/70 hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live meter */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Input level
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${level}%`,
                background:
                  "linear-gradient(90deg, var(--color-speaker-a), var(--color-speaker-b))",
              }}
            />
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/70">
            <div
              className="h-full bg-primary/70 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {stage === "done" && profile && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{NOISE_LABEL[profile.noise]}</span>
              <span className="text-xs text-muted-foreground">
                floor {(profile.floor * 100).toFixed(1)}% · peak {(profile.peak * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{noiseAdvice(profile)}</p>
            <p className="text-sm">
              Recommended pause:{" "}
              <span className="font-display text-lg font-semibold text-primary">
                {profile.suggestedPause}s
              </span>
            </p>
          </div>
        )}

        {stage === "error" && error && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={stage === "measuring"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-secondary",
              stage === "measuring" && "opacity-60",
            )}
          >
            {stage === "measuring" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {stage === "measuring" ? "Listening…" : stage === "intro" ? "Start test" : "Retest"}
          </button>
          {stage === "done" && profile && (
            <button
              type="button"
              onClick={() => {
                onApply({ pause: profile.suggestedPause, threshold: profile.suggestedThreshold });
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" />
              Use {profile.suggestedPause}s
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
