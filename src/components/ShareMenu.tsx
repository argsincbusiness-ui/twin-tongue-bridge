import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader, Share2 } from "lucide-react";
import {
  exportTranslationText,
  saveTranslationAudio,
  shareTranslation,
  type ShareTarget,
} from "@/lib/share";
import { cn } from "@/lib/utils";

const SHARE_TARGETS: { key: ShareTarget; label: string; color: string }[] = [
  { key: "native", label: "Share…", color: "var(--color-primary)" },
  { key: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { key: "facebook", label: "Facebook", color: "#1877F2" },
  { key: "instagram", label: "Instagram", color: "#E1306C" },
  { key: "tiktok", label: "TikTok", color: "#FF0050" },
];

interface Props {
  text: string;
  translation: string;
  /** BCP-47 code used for the spoken audio. */
  lang: string;
  sourceLangLabel?: string;
  targetLangLabel?: string;
  notes?: string;
  disabled?: boolean;
  size?: "sm" | "xs";
  /** Open the menu upward (default) or downward. */
  direction?: "up" | "down";
  label?: string;
  className?: string;
}

/** Share / save audio / export text — reusable on every screen. */
export function ShareMenu({
  text,
  translation,
  lang,
  sourceLangLabel,
  targetLangLabel,
  notes,
  disabled,
  size = "sm",
  direction = "up",
  label = "Share",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const run = async (key: string, fn: () => Promise<string | undefined | void>) => {
    setBusy(key);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
    } catch (e) {
      setMsg((e as Error).message || "Something went wrong");
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const opts = { text, translation, sourceLangLabel, targetLangLabel, notes };
  const itemCls =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary disabled:opacity-40";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !translation}
        aria-label="Share, save or export"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 font-medium text-foreground/80 hover:bg-secondary disabled:opacity-40",
          size === "xs" ? "px-2 py-1 text-[10px]" : "gap-1.5 rounded-lg px-3 py-1.5 text-xs",
        )}
      >
        {busy ? (
          <Loader className={size === "xs" ? "h-3 w-3 animate-spin" : "h-3.5 w-3.5 animate-spin"} />
        ) : (
          <Share2 className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        )}
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-30 w-48 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lg",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {SHARE_TARGETS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="menuitem"
              disabled={busy !== null}
              className={itemCls}
              onClick={() =>
                run(t.key, async () => {
                  const res = await shareTranslation({ target: t.key, lang, ...opts });
                  return res.message ?? (res.ok ? undefined : "Share failed");
                })
              }
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              {t.label}
              {busy === t.key && <Loader className="ml-auto h-3 w-3 animate-spin" />}
            </button>
          ))}
          <div className="h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            disabled={busy !== null}
            className={itemCls}
            onClick={() =>
              run("audio", async () => {
                await saveTranslationAudio(translation, lang);
                return "Audio saved to your device.";
              })
            }
          >
            <Download className="h-3.5 w-3.5" /> Save audio (MP3)
            {busy === "audio" && <Loader className="ml-auto h-3 w-3 animate-spin" />}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy !== null}
            className={itemCls}
            onClick={() =>
              run("text", async () => {
                exportTranslationText(opts);
                return "Text exported.";
              })
            }
          >
            <FileText className="h-3.5 w-3.5" /> Export text (.txt)
          </button>
        </div>
      )}
      {msg && (
        <p className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md bg-card px-2 py-1 text-right text-[11px] text-muted-foreground shadow">
          {msg}
        </p>
      )}
    </div>
  );
}
