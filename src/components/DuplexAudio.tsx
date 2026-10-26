import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bluetooth,
  Headphones,
  Mic,
  RefreshCw,
  Smartphone,
  Speaker,
  X,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import {
  connectionSummary,
  enumerateAudioDevices,
  primeDeviceLabels,
  resolveSelection,
  type AudioDeviceSnapshot,
} from "@/lib/audio-devices";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  inputId: string | null;
  outputId: string | null;
  onInput: (id: string | null) => void;
  onOutput: (id: string | null) => void;
}

const EMPTY: AudioDeviceSnapshot = {
  inputs: [],
  outputs: [],
  labelled: false,
  supported: false,
  canChooseOutput: false,
};

/** Build a short sine-wave WAV so the speaker test costs nothing and works offline. */
function beepWav(seconds = 0.6, freq = 660, sampleRate = 24000): Blob {
  const n = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // Fade in/out so the tone doesn't click.
    const env = Math.min(1, i / 600, (n - i) / 600);
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 12000 * env), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function DuplexAudio({ open, onClose, inputId, outputId, onInput, onOutput }: Props) {
  const [snapshot, setSnapshot] = useState<AudioDeviceSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testingMic, setTestingMic] = useState(false);
  const [level, setLevel] = useState(0);

  const stopMicTest = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const snap = await enumerateAudioDevices();
      setSnapshot(snap);
      if (!snap.supported) setError("This browser cannot list audio devices.");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const handler = () => {
      void refresh();
      setNotice("Audio devices changed — list refreshed.");
    };
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
  }, [open, refresh]);

  useEffect(() => () => stopMicTest.current(), []);

  const grantLabels = useCallback(async () => {
    const res = await primeDeviceLabels();
    if (!res.ok) setError(res.error ?? "Microphone unavailable");
    else {
      setError(null);
      await refresh();
    }
  }, [refresh]);

  const testMic = useCallback(async () => {
    if (testingMic) {
      stopMicTest.current();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: inputId && inputId !== "default" ? { deviceId: { exact: inputId } } : true,
      });
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 8));
      }, 80);
      setTestingMic(true);
      stopMicTest.current = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
        setTestingMic(false);
        setLevel(0);
        stopMicTest.current = () => {};
      };
      void refresh();
    } catch (e) {
      setError((e as Error).message || "Could not open that microphone.");
    }
  }, [inputId, refresh, testingMic]);

  const testSpeaker = useCallback(async () => {
    setError(null);
    try {
      const url = URL.createObjectURL(beepWav());
      const audio = new Audio(url);
      const sinkable = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (outputId && outputId !== "default" && typeof sinkable.setSinkId === "function") {
        await sinkable.setSinkId(outputId);
      }
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setNotice("Test tone sent to the selected output.");
    } catch (e) {
      setError((e as Error).message || "Could not play through that output.");
    }
  }, [outputId]);

  if (!open) return null;

  const input = resolveSelection(snapshot.inputs, inputId);
  const output = resolveSelection(snapshot.outputs, outputId);
  const summary = connectionSummary(input, output);
  const Icon =
    summary.icon === "bluetooth" ? Bluetooth : summary.icon === "wired" ? Headphones : Smartphone;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-0 backdrop-blur sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Duplex audio devices"
    >
      <div className="panel-surface flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Duplex Audio</h2>
            <p className="text-xs text-muted-foreground">
              Real devices reported by your browser — nothing is simulated.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audio settings"
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-secondary/60 hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/25 p-3">
          <Icon className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{summary.text}</p>
            <p className="truncate text-xs text-muted-foreground">
              In: {input?.label ?? "Not available"} · Out: {output?.label ?? "System default"}
            </p>
          </div>
        </div>

        {!snapshot.labelled && snapshot.supported && (
          <button
            type="button"
            onClick={grantLabels}
            className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-xs text-foreground/90"
          >
            Device names are hidden until microphone access is granted.
            <span className="ml-1 font-semibold text-primary">Grant access</span>
          </button>
        )}

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">Input device</span>
          <select
            value={input?.deviceId ?? ""}
            onChange={(e) => onInput(e.target.value || null)}
            className="min-h-11 rounded-lg border border-border bg-secondary/60 px-3 text-sm"
          >
            {snapshot.inputs.length === 0 && <option value="">No microphones found</option>}
            {snapshot.inputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.bluetooth ? "🎧 " : d.wired ? "🔌 " : "🎙 "}
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">Output device</span>
          <select
            value={output?.deviceId ?? ""}
            onChange={(e) => onOutput(e.target.value || null)}
            disabled={!snapshot.canChooseOutput}
            className="min-h-11 rounded-lg border border-border bg-secondary/60 px-3 text-sm disabled:opacity-60"
          >
            {snapshot.outputs.length === 0 && <option value="">System default</option>}
            {snapshot.outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.bluetooth ? "🎧 " : d.wired ? "🔌 " : "🔈 "}
                {d.label}
              </option>
            ))}
          </select>
          {!snapshot.canChooseOutput && (
            <span className="text-[11px] text-muted-foreground">
              This browser routes playback to whatever your device has selected — pick the output in
              your phone or system audio settings.
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void testMic()}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium",
              testingMic
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-secondary/60 hover:bg-secondary",
            )}
          >
            <Mic className="h-4 w-4" /> {testingMic ? "Stop test" : "Test microphone"}
          </button>
          <button
            type="button"
            onClick={() => void testSpeaker()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 text-xs font-medium hover:bg-secondary"
          >
            <Speaker className="h-4 w-4" /> Test speaker
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 text-xs font-medium hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Rescan devices
          </button>
          <button
            type="button"
            onClick={() => {
              onInput(null);
              onOutput(null);
              setNotice("Reset to your device's default microphone and speaker.");
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 text-xs font-medium hover:bg-secondary"
          >
            <Volume2 className="h-4 w-4" /> Use phone default
          </button>
        </div>

        {testingMic && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Speak — the bar should move. If it stays flat, pick another input.
            </p>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Bluetooth earbuds, headsets and speakers appear here once paired with your phone or
          computer. Browsers cannot pair devices themselves — pair in your system settings, then tap
          Rescan. If a device disconnects mid-conversation, Neural Duplex falls back to the built-in
          microphone and speaker automatically.
        </p>

        {notice && <p className="text-[11px] text-primary">{notice}</p>}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
