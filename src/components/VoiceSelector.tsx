import { useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  VOICES,
  VOICE_STYLES,
  getVoicePrefs,
  getStyle,
  resolveVoiceStyle,
  setVoicePrefs,
  subscribeVoicePrefs,
} from "@/lib/voice-styles";
import { speak, cancelSpeak } from "@/hooks/useSpeech";
import { cn } from "@/lib/utils";

const PREVIEW_TEXT = "This is how the selected voice sounds.";

const selectCls =
  "min-h-9 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2";

/**
 * The ONE shared voice selector. Voice + Voice Style, stored in a single
 * global setting — changing it here updates every other screen that uses
 * this component. Shows the selected style's description, a Preview
 * button, and a small notice when the style fell back for the language.
 */
export function VoiceSelector({
  lang,
  voiceControl = true,
  className,
}: {
  /** Language used for the preview sample (and fallback resolution). */
  lang: string;
  /** Hide the Voice control on screens with their own voice casting (e.g. Sing It). */
  voiceControl?: boolean;
  className?: string;
}) {
  const prefs = useSyncExternalStore(subscribeVoicePrefs, getVoicePrefs);
  const resolved = resolveVoiceStyle(lang, prefs);
  const [previewing, setPreviewing] = useState(false);

  const chooseStyle = (id: string) => {
    const previous = getStyle(prefs.styleId);
    const next = getStyle(id);
    // Follow the style's suggested voice while the user hasn't picked a
    // deliberate voice of their own (i.e. still on the previous suggestion).
    if (prefs.voice === previous.suggestedVoice && next.suggestedVoice !== prefs.voice) {
      setVoicePrefs({ styleId: id, voice: next.suggestedVoice });
    } else {
      setVoicePrefs({ styleId: id });
    }
  };

  const preview = () => {
    cancelSpeak();
    setPreviewing(true);
    speak(PREVIEW_TEXT, lang, {
      voice: prefs.voice,
      onEnd: () => setPreviewing(false),
      onError: () => setPreviewing(false),
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
      aria-label="Voice and style"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Volume2 className="h-4 w-4 shrink-0 text-primary" />
        {voiceControl && (
          <select
            aria-label="Voice"
            className={selectCls}
            value={prefs.voice}
            onChange={(e) => setVoicePrefs({ voice: e.target.value })}
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Voice style"
          className={selectCls}
          value={prefs.styleId}
          onChange={(e) => chooseStyle(e.target.value)}
        >
          {VOICE_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={preview}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-secondary"
        >
          {previewing ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {previewing ? "Playing…" : "Preview"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {resolved.style.description}
        {resolved.notice ? ` · ${resolved.notice}` : ""}
      </p>
    </div>
  );
}
