import { Mic, Volume2, Loader2, SendHorizonal } from "lucide-react";
import { useState } from "react";
import { AUTO_LANGUAGE, LANGUAGES, getLanguage, isAutoLang } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { ShareMenu } from "@/components/ShareMenu";

export type SpeakerStatus = "idle" | "listening" | "translating" | "previewing" | "speaking";

interface Props {
  side: "a" | "b";
  langCode: string;
  onLangChange: (code: string) => void;
  status: SpeakerStatus;
  active: boolean;
  transcript: string;
  translation: string;
  flipped?: boolean;
  onMic: () => void;
  onReplay?: () => void;
  disabledMic?: boolean;
  /** Language name detected for this side when set to auto-detect. */
  detectedLang?: string;
  /** Send a typed message instead of speaking. */
  onType?: (text: string) => void;
}

const STATUS_LABEL: Record<SpeakerStatus, string> = {
  idle: "Tap mic to speak",
  listening: "Listening…",
  translating: "Translating…",
  previewing: "Preview ready…",
  speaking: "Speaking…",
};

export function SpeakerPanel({
  side,
  langCode,
  onLangChange,
  status,
  active,
  transcript,
  translation,
  flipped,
  onMic,
  onReplay,
  disabledMic,
  detectedLang,
  onType,
}: Props) {
  const [typed, setTyped] = useState("");
  const submitTyped = () => {
    const t = typed.trim();
    if (!t || !onType || busy) return;
    onType(t);
    setTyped("");
  };

  const lang = getLanguage(langCode);
  const accent = side === "a" ? "var(--color-speaker-a)" : "var(--color-speaker-b)";
  const listening = status === "listening";
  const busy = status === "translating" || status === "previewing" || status === "speaking";

  return (
    <section
      className={cn(
        "panel-surface relative flex flex-1 flex-col gap-4 p-5 sm:p-7 transition-all",
        active ? "ring-2" : "ring-0 opacity-95",
      )}
      style={{
        ["--tw-ring-color" as string]: accent,
        transform: flipped ? "rotate(180deg)" : undefined,
      }}
      aria-label={`Speaker ${side.toUpperCase()}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-full font-display text-base font-semibold"
            style={{ backgroundColor: accent, color: "var(--color-primary-foreground)" }}
          >
            {side.toUpperCase()}
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Speaker {side.toUpperCase()}
            </p>
            <p className="font-display text-lg leading-tight">
              {lang.flag} {lang.nativeName}
              {isAutoLang(langCode) && detectedLang && (
                <span className="ml-2 text-sm text-muted-foreground">· {detectedLang}</span>
              )}
            </p>
          </div>
        </div>

        <select
          aria-label="Language"
          value={langCode}
          onChange={(e) => onLangChange(e.target.value)}
          className="max-w-[10rem] rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ ["--tw-ring-color" as string]: accent }}
        >
          <option value={AUTO_LANGUAGE.code}>
            {AUTO_LANGUAGE.flag} Auto-detect (any language)
          </option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </header>

      <div className="flex-1 space-y-3 overflow-hidden">
        <div className="min-h-[3.5rem] rounded-xl bg-secondary/40 p-3">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            You said
          </p>
          <p className="font-display text-lg leading-snug text-foreground/90 break-words">
            {transcript || <span className="text-muted-foreground/60">—</span>}
          </p>
        </div>

        <div
          className="min-h-[5rem] rounded-xl p-3"
          style={{ background: `color-mix(in oklch, ${accent} 12%, transparent)` }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Translation
          </p>
          <p
            className="font-display text-xl sm:text-2xl leading-snug break-words"
            style={{ color: accent }}
          >
            {translation || <span className="text-muted-foreground/60 text-base">—</span>}
          </p>
        </div>
      </div>

      {onType && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitTyped();
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type here — it will be translated and spoken"
            aria-label={`Type a message as Speaker ${side.toUpperCase()}`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as string]: accent }}
          />
          <button
            type="submit"
            disabled={!typed.trim() || busy}
            aria-label="Send typed message"
            className="grid h-9 w-9 place-items-center rounded-lg text-primary-foreground disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      )}

      <footer className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onMic}
          disabled={disabledMic}
          className={cn(
            "relative grid h-20 w-20 place-items-center rounded-full text-primary-foreground transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
            listening && "mic-pulse",
          )}
          style={{
            backgroundColor: accent,
            boxShadow: active ? `0 0 40px -8px ${accent}` : undefined,
          }}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Start listening"}
        >
          {status === "translating" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>

        <div className="flex flex-col items-end gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: busy || listening ? accent : "var(--color-muted-foreground)" }}
          >
            {STATUS_LABEL[status]}
          </span>
          <div className="flex items-center gap-2">
            <ShareMenu text={transcript} translation={translation} lang={langCode} />
            <button
              type="button"
              onClick={onReplay}
              disabled={!translation || status === "speaking"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary disabled:opacity-40"
            >
              <Volume2 className="h-3.5 w-3.5" /> Replay
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
