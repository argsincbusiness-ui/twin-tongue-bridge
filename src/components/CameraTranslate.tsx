import { useCountedFn } from "@/hooks/useUsage";
import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, Volume2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { translateImage } from "@/lib/vision.functions";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { speak, cancelSpeak } from "@/hooks/useSpeech";
import { ShareMenu } from "@/components/ShareMenu";

/** Downscale a photo so the upload stays small and fast. */
async function toCompactBase64(
  file: File,
): Promise<{ base64: string; mimeType: string; preview: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read that file"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file is not a readable image"));
    el.src = dataUrl;
  });

  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64: dataUrl.split(",")[1] ?? "", mimeType: file.type, preview: dataUrl };
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: out.split(",")[1] ?? "", mimeType: "image/jpeg", preview: out };
}

interface Props {
  /** Language the photo text should be translated into. */
  targetLang: string;
  onTargetLang: (code: string) => void;
}

export function CameraTranslate({ targetLang, onTargetLang }: Props) {
  const run = useCountedFn(useServerFn(translateImage));
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    extracted: string;
    translated: string;
    detectedLang?: string;
  } | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { base64, mimeType, preview: p } = await toCompactBase64(file);
      setPreview(p);
      const out = await run({
        data: { imageBase64: base64, mimeType, targetLang: getLanguage(targetLang).name },
      });
      setResult(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    cancelSpeak();
    setPreview(null);
    setResult(null);
    setError(null);
    setSpeaking(false);
  };

  const readAloud = () => {
    if (!result?.translated) return;
    setSpeaking(true);
    speak(result.translated, targetLang, { onEnd: () => setSpeaking(false) });
  };

  return (
    <section className="panel-surface flex flex-1 flex-col gap-4 p-5 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Photo translate
          </p>
          <h2 className="font-display text-lg leading-tight">
            Snap a sign, menu or document
          </h2>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Into
          <select
            aria-label="Translate photo into"
            value={targetLang}
            onChange={(e) => onTargetLang(e.target.value)}
            className="max-w-[11rem] rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Camera className="h-4 w-4" /> Take photo
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-secondary disabled:opacity-50"
        >
          <ImageUp className="h-4 w-4" /> Upload image
        </button>
        {(preview || result) && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {preview && (
        <img
          src={preview}
          alt="Captured photo to translate"
          className="max-h-60 w-full rounded-xl border border-border object-contain"
        />
      )}

      {busy && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the text in your photo…
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl bg-secondary/40 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Text in photo{result.detectedLang ? ` · ${result.detectedLang}` : ""}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
              {result.extracted || "—"}
            </p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: "color-mix(in oklch, var(--color-speaker-b) 12%, transparent)" }}
          >
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Translation
            </p>
            <p className="whitespace-pre-wrap break-words font-display text-lg leading-snug">
              {result.translated || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={readAloud}
            disabled={!result.translated || speaking}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary disabled:opacity-40"
          >
            <Volume2 className="h-3.5 w-3.5" /> {speaking ? "Speaking…" : "Read aloud"}
          </button>
          <ShareMenu
            className="inline-block ml-2"
            text={result.extracted}
            translation={result.translated}
            lang={targetLang}
            sourceLangLabel={result.detectedLang || undefined}
            targetLangLabel={getLanguage(targetLang).name}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
        >
          {error}
        </p>
      )}
    </section>
  );
}
