import { authHeaders } from "@/lib/api-auth";

/**
 * Fetch the neural TTS audio for a given translation and return it as
 * a File suitable for the Web Share API or a download link.
 */
export async function fetchTtsFile(text: string, lang: string): Promise<File> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ text, lang, voice: "alloy" }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status})`);
  const blob = await res.blob();
  const name = `translation-${Date.now()}.mp3`;
  return new File([blob], name, { type: "audio/mpeg" });
}

export type ShareTarget = "whatsapp" | "facebook" | "instagram" | "tiktok" | "native";

const APP_LABEL: Record<Exclude<ShareTarget, "native">, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Trigger a browser download of the file. */
function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface TranscriptOpts {
  text: string;
  translation: string;
  sourceLangLabel?: string;
  targetLangLabel?: string;
  /** Optional extra lines, e.g. Learning Mode notes. */
  notes?: string;
}

/** Human-readable caption used for share sheets and clipboards. */
function buildCaption({
  text,
  translation,
  sourceLangLabel,
  targetLangLabel,
  notes,
}: TranscriptOpts): string {
  const src = sourceLangLabel ? `${sourceLangLabel}: ` : "";
  const tgt = targetLangLabel ? `${targetLangLabel}: ` : "→ ";
  const lines: string[] = [];
  if (text) lines.push(`${src}${text}`);
  if (translation) lines.push(`${tgt}${translation}`);
  if (notes) lines.push("", notes);
  return lines.join("\n");
}

/** Longer transcript body written to the .txt file. */
function buildTranscript(opts: TranscriptOpts): string {
  const stamp = new Date().toLocaleString();
  return [
    "Neural Duplex — Translation transcript",
    stamp,
    "",
    buildCaption(opts),
    "",
  ].join("\n");
}

function buildTranscriptFile(opts: TranscriptOpts): File {
  const body = buildTranscript(opts);
  return new File([body], `transcript-${Date.now()}.txt`, {
    type: "text/plain",
  });
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* ignore — clipboard is best-effort */
  }
}

/**
 * Share a translation. Attempts, in order:
 * 1. Native Web Share API with MP3 + transcript .txt attached, and the
 *    caption pre-filled — on iOS/Android this opens the OS share sheet
 *    where the user can pick WhatsApp, Instagram, Facebook, TikTok, etc.
 * 2. If the platform rejects multi-file share, retry with the audio only.
 * 3. For WhatsApp specifically: fall back to wa.me with the caption.
 * 4. Otherwise: download both files and instruct the user to attach them.
 *
 * The caption is always copied to the clipboard so the user can paste it
 * into apps like Instagram/TikTok that don't accept pre-filled text.
 */
export async function shareTranslation(opts: {
  target: ShareTarget;
  text: string;
  translation: string;
  lang: string;
  sourceLangLabel?: string;
  targetLangLabel?: string;
  notes?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { target, text, translation, lang, sourceLangLabel, targetLangLabel, notes } = opts;
  const transcriptOpts: TranscriptOpts = {
    text,
    translation,
    sourceLangLabel,
    targetLangLabel,
    notes,
  };
  const caption = buildCaption(transcriptOpts);

  // Always stash the caption on the clipboard so it can be pasted into
  // apps that don't accept pre-filled share text.
  await copyToClipboard(caption);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canShareFiles =
    canShare && typeof navigator.canShare === "function";

  // WhatsApp text-only quick path when the device can't share files.
  if (target === "whatsapp" && !canShareFiles) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(caption)}`,
      "_blank",
      "noopener,noreferrer",
    );
    return { ok: true, message: "Caption copied to clipboard." };
  }

  let audio: File;
  try {
    audio = await fetchTtsFile(translation, lang);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const transcript = buildTranscriptFile(transcriptOpts);

  // Preferred: OS share sheet with BOTH files (audio + transcript).
  if (canShareFiles) {
    const bundles: File[][] = [[audio, transcript], [audio]];
    for (const files of bundles) {
      if (!navigator.canShare({ files })) continue;
      try {
        await navigator.share({ files, title: "Translation", text: caption });
        return {
          ok: true,
          message:
            files.length > 1
              ? undefined
              : "Audio shared — transcript copied to clipboard.",
        };
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return { ok: true };
        // Fall through to try the next bundle / final fallback.
      }
    }
  }

  // Final fallback: download both files.
  downloadFile(audio);
  downloadFile(transcript);

  if (target === "whatsapp") {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(caption)}`,
      "_blank",
      "noopener,noreferrer",
    );
    return {
      ok: true,
      message:
        "Audio + transcript downloaded and caption copied — attach them in the WhatsApp chat that just opened.",
    };
  }
  if (target === "native") {
    return { ok: true, message: "Audio + transcript downloaded." };
  }
  return {
    ok: true,
    message: `Audio + transcript downloaded and caption copied — open ${APP_LABEL[target]} and attach them to your post or message.`,
  };
}

/** Save the spoken translation as an MP3 on this device. */
export async function saveTranslationAudio(translation: string, lang: string): Promise<void> {
  downloadFile(await fetchTtsFile(translation, lang));
}

/** Export the text (original, translation, notes) as a .txt file. */
export function exportTranslationText(opts: TranscriptOpts): void {
  downloadFile(buildTranscriptFile(opts));
}
