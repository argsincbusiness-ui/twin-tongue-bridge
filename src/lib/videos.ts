/** Pure helpers for the Videos library — no browser or database access here, so tests can run anywhere. */

/** Matches the videos storage bucket's per-file limit. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export function validateVideoFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("video/")) {
    return "Please choose a video file (MP4, WebM or similar).";
  }
  if (file.size <= 0) {
    return "That file looks empty. Please choose a different video.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "Videos can be up to 200 MB. Please choose a smaller file.";
  }
  return null;
}

function extFromType(type: string): string {
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("matroska")) return "mkv";
  return "mp4";
}

/** Where a video is stored: first folder is always the owner's user id. */
export function storagePathFor(userId: string, file: { name: string; type: string }): string {
  const raw = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = raw.length > 0 && raw.length <= 5 ? raw : extFromType(file.type);
  return `${userId}/${crypto.randomUUID()}.${ext || "mp4"}`;
}

export function toolLabel(tool: string): string {
  switch (tool) {
    case "voice-over": return "Voice-over";
    case "dubbing": return "Dubbing";
    case "podcast": return "Podcast";
    case "coach": return "Coach";
    default: return "Upload";
  }
}

/** Default title for a Studio save, e.g. "Voice-over · English · 3 Nov 2026". */
export function libraryTitle(tool: string, languageName: string, date = new Date()): string {
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${toolLabel(tool)} · ${languageName} · ${day}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function friendlyStorageError(message: string): string {
  if (/exceed|too large|limit/i.test(message)) {
    return "That video is too big to save (200 MB max). Try a shorter clip.";
  }
  return `Couldn't save your video: ${message}`;
}
