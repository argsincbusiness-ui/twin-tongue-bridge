import { PlanBar } from "@/components/PlanBar";
import { UserRound } from "lucide-react";
import { useCountedFn } from "@/hooks/useUsage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  RotateCw,
  Sparkles,
  Power,
  LogOut,
  ShieldCheck,
  Users,
  UsersRound,
  Camera,
  Repeat,
  Music2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { translate } from "@/lib/translate.functions";
import { useRecognition, speak, cancelSpeak, hasWebSpeech } from "@/hooks/useSpeech";
import { buildPreviewPlan } from "@/lib/preview";
import { SpeakerPanel, type SpeakerStatus } from "@/components/SpeakerPanel";
import { VoiceSelector } from "@/components/VoiceSelector";
import { DuplexTalk } from "@/components/DuplexTalk";
import { CameraTranslate } from "@/components/CameraTranslate";
import { SingIt } from "@/components/SingIt";
import { StudioPro } from "@/components/StudioPro";
import { Clapperboard } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { AuthScreen } from "@/components/AuthScreen";
import { InactiveScreen } from "@/components/InactiveScreen";
import { useAuth, signOut } from "@/hooks/useAuth";
import { getLanguage, isAutoLang, AUTO_CODE, findLanguageByName } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { PublicWebsite } from "@/components/PublicWebsite";
import { GlobalNavigationShell } from "@/components/GlobalNavigationShell";


export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { open?: boolean; mode?: "duplex" | "face" | "camera" | "sing" | "studio" } => ({
    open: search.open === true || search.open === "true" ? true : undefined,
    mode: search.mode === "face" || search.mode === "camera" || search.mode === "sing" || search.mode === "studio" || search.mode === "duplex" ? search.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Neural Duplex AI Lite — Real-time face-to-face interpreter" },
      {
        name: "description",
        content:
          "Two-person AI interpreter for face-to-face conversations. Auto-detects, translates and speaks — hands-free.",
      },
      { property: "og:title", content: "Neural Duplex AI Lite" },
      {
        property: "og:description",
        content: "Real-time AI interpreter for face-to-face conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, loading, access } = useAuth();
  const { open } = Route.useSearch();
  if (!open && !user) return <PublicWebsite />;
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }
  if (!user) return <AuthScreen />;
  if (!access.hasAccess) return <InactiveScreen email={user.email ?? ""} access={access} />;
  return (
    <GlobalNavigationShell>
      <Translator isAdmin={access.isAdmin} userEmail={user.email ?? ""} />
    </GlobalNavigationShell>
  );
}

type Side = "a" | "b";

interface Exchange {
  from: string;
  to: string;
  original: string;
  translated: string;
}

function Translator({ isAdmin, userEmail }: { isAdmin: boolean; userEmail: string }) {
  const translateFn = useCountedFn(useServerFn(translate));
  const { mode: initialMode } = Route.useSearch();

  const [langA, setLangA] = useState(AUTO_CODE);
  const [langB, setLangB] = useState("en-US");
  const [detectedA, setDetectedA] = useState<string | null>(null);
  const [detectedB, setDetectedB] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<Side>("a");
  const [statusA, setStatusA] = useState<SpeakerStatus>("idle");
  const [statusB, setStatusB] = useState<SpeakerStatus>("idle");
  const [textA, setTextA] = useState({ original: "", translation: "" });
  const [textB, setTextB] = useState({ original: "", translation: "" });
  const [autoMode, setAutoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [supportsSpeech, setSupportsSpeech] = useState(true);
  const [mode, setMode] = useState<"face" | "duplex" | "camera" | "sing" | "studio">(initialMode ?? "duplex");

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const autoModeRef = useRef(autoMode);
  autoModeRef.current = autoMode;

  useEffect(() => {
    setSupportsSpeech(
      hasWebSpeech() ||
        (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  const setStatus = (side: Side, s: SpeakerStatus) =>
    side === "a" ? setStatusA(s) : setStatusB(s);
  const setText = (side: Side, original: string, translation: string) =>
    side === "a"
      ? setTextA({ original, translation })
      : setTextB({ original, translation });

  const handleFinal = useCallback(
    async (side: Side, finalText: string) => {
      if (!finalText.trim()) {
        setStatus(side, "idle");
        return;
      }
      const sourceCode = side === "a" ? langA : langB;
      const targetCodeRaw = side === "a" ? langB : langA;
      // Both sides on auto has no meaningful target — default to English.
      const targetLang = isAutoLang(targetCodeRaw) ? "en-US" : targetCodeRaw;
      const sourceName = isAutoLang(sourceCode) ? "auto" : getLanguage(sourceCode).name;
      const otherSide: Side = side === "a" ? "b" : "a";

      setText(side, finalText, "");
      setStatus(side, "translating");
      setError(null);

      try {
        const result = await translateFn({
          data: {
            text: finalText,
            sourceLang: sourceName,
            targetLang: getLanguage(targetLang).name,
            history: history.slice(-10),
          },
        });
        const { previewText, spokenText, previewMs } = buildPreviewPlan(result);
        if (isAutoLang(sourceCode) && result.detectedLang) {
          (side === "a" ? setDetectedA : setDetectedB)(result.detectedLang);
        }

        setText(side, finalText, spokenText);
        setHistory((h) => [
          ...h.slice(-19),
          {
            from: isAutoLang(sourceCode)
              ? (result.detectedLang ?? "auto")
              : getLanguage(sourceCode).name,
            to: getLanguage(targetLang).name,
            original: finalText,
            translated: spokenText,
          },
        ]);

        setStatus(side, "idle");
        setText(otherSide, "", previewText);
        setStatus(otherSide, "previewing");

        // Hard-stop BOTH recognition instances before TTS starts so
        // the mic can't pick up the device's own speaker output and
        // re-transcribe it into a feedback loop.
        recA.stop();
        recB.stop();

        await new Promise((r) => setTimeout(r, previewMs));

        setStatus(otherSide, "speaking");
        speak(spokenText, targetLang, {
          onEnd: () => {
            setStatus(otherSide, "idle");
            if (autoModeRef.current) {
              setActiveSide(otherSide);
              // Small delay so the audio device fully releases before
              // we re-open the mic; prevents the tail of the utterance
              // from being captured.
              setTimeout(() => startListening(otherSide), 400);
            }
          },
        });

      } catch (e) {
        setError((e as Error).message);
        setStatus(side, "idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [langA, langB, translateFn, history],
  );

  // Intentionally NOT wiring onInterim: streaming partial results into the
  // UI produced a "looping phrase" effect on some browsers (Android Chrome
  // re-emits earlier results). We render only the clean, final transcript
  // once recognition ends and translation completes.
  const recA = useRecognition({
    lang: langA,
    onFinal: (t) => handleFinal("a", t),
  });
  const recB = useRecognition({
    lang: langB,
    onFinal: (t) => handleFinal("b", t),
  });

  const startListening = useCallback(
    (side: Side) => {
      recA.stop();
      recB.stop();
      cancelSpeak();
      setActiveSide(side);
      // Clear BOTH sides so leftover streaming text from a previous
      // turn never bleeds into the new speaker's fields.
      setTextA({ original: "", translation: "" });
      setTextB({ original: "", translation: "" });
      setStatus(side, "listening");
      setTimeout(() => (side === "a" ? recA.start() : recB.start()), 50);
    },
    [recA, recB],
  );


  useEffect(() => {
    if (!recA.listening && statusA === "listening") setStatusA("idle");
  }, [recA.listening, statusA]);
  useEffect(() => {
    if (!recB.listening && statusB === "listening") setStatusB("idle");
  }, [recB.listening, statusB]);

  const handleMic = (side: Side) => {
    const status = side === "a" ? statusA : statusB;
    if (status === "listening") {
      side === "a" ? recA.stop() : recB.stop();
      setStatus(side, "idle");
      return;
    }
    startListening(side);
  };

  const swapLanguages = () => {
    setLangA(langB);
    setLangB(langA);
    setDetectedA(null);
    setDetectedB(null);
  };

  const reset = () => {
    recA.stop();
    recB.stop();
    cancelSpeak();
    setTextA({ original: "", translation: "" });
    setTextB({ original: "", translation: "" });
    setStatusA("idle");
    setStatusB("idle");
    setHistory([]);
    setDetectedA(null);
    setDetectedB(null);
    setAutoMode(false);
    setError(null);
  };

  const replay = (side: Side) => {
    const t = side === "a" ? textA.translation : textB.translation;
    const code = side === "a" ? langA : langB;
    const detected = side === "a" ? detectedA : detectedB;
    // For auto-detect, the detected value is a language name. Map it back to
    // a BCP-47 code so TTS receives a stable tag; fall back to English.
    const lang = isAutoLang(code)
      ? (findLanguageByName(detected ?? "")?.code ?? "en-US")
      : code;
    if (!t) return;
    setStatus(side, "speaking");
    speak(t, lang, { onEnd: () => setStatus(side, "idle") });
  };


  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col items-start justify-between gap-3 px-4 py-3 lg:flex-row lg:items-center sm:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
            }}
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold leading-tight">
              Neural Duplex <span className="text-muted-foreground">Lite</span>
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Face-to-face interpreter
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
          <div
            role="radiogroup"
            aria-label="Conversation mode"
            className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-secondary/60 p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === "duplex"}
              onClick={() => setMode("duplex")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "duplex"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              <Repeat className="h-3.5 w-3.5" /> Duplex Talk
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "face"}
              onClick={() => setMode("face")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "face"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              <Users className="h-3.5 w-3.5" /> Face-to-face
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "camera"}
              onClick={() => setMode("camera")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "camera"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              <Camera className="h-3.5 w-3.5" /> Photo
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "sing"}
              onClick={() => setMode("sing")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "sing"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              <Music2 className="h-3.5 w-3.5" /> Sing It
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "studio"}
              onClick={() => setMode("studio")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "studio"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-secondary",
              )}
            >
              <Clapperboard className="h-3.5 w-3.5" /> Studio
            </button>
          </div>
          <Link
            to="/room"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            <UsersRound className="h-3.5 w-3.5" /> Conference room
          </Link>
          <InstallAppButton />
          {mode === "face" && (
          <button
            type="button"
            onClick={() => setAutoMode((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              autoMode
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-secondary/60 text-foreground/80 hover:bg-secondary",
            )}
            aria-pressed={autoMode}
          >
            <Power className="h-3.5 w-3.5" />
            Auto {autoMode ? "On" : "Off"}
          </button>
          )}
          {mode === "face" && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reset
          </button>
          )}
          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            <UserRound className="h-3.5 w-3.5" /> Account
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
              title="Admin"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            title={`Sign out ${userEmail}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <PlanBar />

      {/* One shared voice + style setting for every speaking screen. */}
      <div className="px-3 sm:px-6">
        <VoiceSelector lang={isAutoLang(langB) ? (isAutoLang(langA) ? "en-US" : langA) : langB} />
      </div>


      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
        {mode === "duplex" ? (
          <DuplexTalk
            langA={langA}
            langB={langB}
            onLangA={(c) => {
              setLangA(c);
              setDetectedA(null);
            }}
            onLangB={(c) => {
              setLangB(c);
              setDetectedB(null);
            }}
          />
        ) : mode === "studio" ? (
          <StudioPro />
        ) : mode === "sing" ? (
          <SingIt />
        ) : mode === "camera" ? (
          <CameraTranslate
            targetLang={isAutoLang(langB) ? "en-US" : langB}
            onTargetLang={(c) => {
              setLangB(c);
              setDetectedB(null);
            }}
          />
        ) : (
        <>
        <SpeakerPanel
          side="a"
          langCode={langA}
          onLangChange={(c) => {
            setLangA(c);
            setDetectedA(null);
          }}
          detectedLang={detectedA ?? undefined}
          status={statusA}
          active={activeSide === "a"}
          transcript={textA.original}
          translation={textA.translation}
          flipped
          onMic={() => handleMic("a")}
          onReplay={() => replay("a")}
          onType={(t) => { recA.stop(); recB.stop(); cancelSpeak(); setActiveSide("a"); void handleFinal("a", t); }}
          disabledMic={statusB === "listening" || statusB === "translating"}
        />

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-6 h-px bg-border" />
          <button
            type="button"
            onClick={swapLanguages}
            disabled={isAutoLang(langA) && isAutoLang(langB)}
            aria-label="Swap languages"
            className="relative grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground/80 shadow-sm hover:bg-secondary"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <SpeakerPanel
          side="b"
          langCode={langB}
          onLangChange={(c) => {
            setLangB(c);
            setDetectedB(null);
          }}
          detectedLang={detectedB ?? undefined}
          status={statusB}
          active={activeSide === "b"}
          transcript={textB.original}
          translation={textB.translation}
          onMic={() => handleMic("b")}
          onReplay={() => replay("b")}
          onType={(t) => { recA.stop(); recB.stop(); cancelSpeak(); setActiveSide("b"); void handleFinal("b", t); }}
          disabledMic={statusA === "listening" || statusA === "translating"}
        />
        </>
        )}
      </div>

      {(error || !supportsSpeech) && (
        <div className="px-4 pb-4 sm:px-6">
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
          >
            {!supportsSpeech
              ? "This device doesn't expose a microphone or speech API."
              : error}
          </p>
        </div>
      )}
    </main>
  );
}
