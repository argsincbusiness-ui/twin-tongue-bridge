import { supabase } from "@/integrations/supabase/client";
import { friendlyStorageError, storagePathFor } from "@/lib/videos";

/** Browser-side actions for the user's private Videos library (RLS-protected on the server). */

export type VideoRow = {
  id: string;
  user_id: string;
  title: string;
  tool: string;
  language: string | null;
  duration_seconds: number | null;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

const COLUMNS = "id,user_id,title,tool,language,duration_seconds,size_bytes,storage_path,created_at";

export async function listVideos(): Promise<VideoRow[]> {
  const { data, error } = await supabase
    .from("videos")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Couldn't load your videos: ${error.message}`);
  return (data ?? []) as VideoRow[];
}

/** Reads a media blob's length in seconds (works for audio and video). */
export function readMediaDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    const cleanup = () => { el.removeAttribute("src"); el.load(); };
    const done = (value: number | null) => { cleanup(); resolve(value); };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    el.src = URL.createObjectURL(blob);
    setTimeout(() => done(null), 8000);
  });
}

export async function saveVideo(
  blob: Blob,
  meta: { tool: string; language?: string | null; title: string; durationSeconds?: number | null },
): Promise<VideoRow> {
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData?.user;
  if (!user) throw new Error("Please sign in first.");
  const type = blob.type || "video/mp4";
  const path = storagePathFor(user.id, { name: meta.title, type });
  const up = await supabase.storage.from("videos").upload(path, blob, { contentType: type });
  if (up.error) throw new Error(friendlyStorageError(up.error.message));
  const { data: row, error } = await supabase
    .from("videos")
    .insert({
      user_id: user.id,
      title: meta.title,
      tool: meta.tool,
      language: meta.language ?? null,
      duration_seconds: meta.durationSeconds ?? null,
      size_bytes: blob.size,
      storage_path: path,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from("videos").remove([path]);
    throw new Error(friendlyStorageError(error.message));
  }
  return row as VideoRow;
}

/** Short-lived private link for playing a saved video. */
export async function videoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("videos").createSignedUrl(path, 60 * 60);
  if (error || !data) throw new Error("Couldn't open that video. It may have been deleted.");
  return data.signedUrl;
}

export async function deleteVideo(row: VideoRow): Promise<void> {
  await supabase.storage.from("videos").remove([row.storage_path]);
  const { error } = await supabase.from("videos").delete().eq("id", row.id);
  if (error) throw new Error(`Couldn't delete that video: ${error.message}`);
}

export async function downloadVideo(row: VideoRow): Promise<void> {
  const url = await videoUrl(row.storage_path);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't download that video. Please try again.");
  const ext = (row.storage_path.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/g, "") || "mp4";
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${row.title.replace(/[\\/:*?"<>|]/g, "-")}.${ext}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
