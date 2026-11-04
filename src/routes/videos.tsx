import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Loader, Trash2, UploadCloud } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { GlobalNavigationShell } from "@/components/GlobalNavigationShell";
import { Button } from "@/components/ui/button";
import { formatDuration, toolLabel, validateVideoFile } from "@/lib/videos";
import {
  deleteVideo, downloadVideo, listVideos, readMediaDuration, saveVideo, videoUrl,
  type VideoRow,
} from "@/lib/videos-library";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Videos — Neural Duplex Lite" },
      { name: "description", content: "Your private video library: saved dubs, uploads and Studio exports." },
      { property: "og:title", content: "Videos — Neural Duplex Lite" },
      { property: "og:description", content: "Your private video library: saved dubs, uploads and Studio exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VideosPage,
});

function VideoCard({ row, onDeleted }: { row: VideoRow; onDeleted: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    videoUrl(row.storage_path)
      .then((u) => { if (alive) setUrl(u); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, [row.storage_path]);

  const when = row.created_at ? new Date(row.created_at).toLocaleDateString() : null;
  const sizeMb = row.size_bytes ? `${(row.size_bytes / (1024 * 1024)).toFixed(1)} MB` : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-3">
      {url ? (
        <video controls preload="metadata" src={url} className="w-full rounded-xl bg-black/40" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">
          {err ? err : <Loader className="h-4 w-4 animate-spin" />}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">{row.title}</p>
        <p className="text-xs text-muted-foreground">
          {toolLabel(row.tool)}
          {row.language ? ` · ${row.language}` : ""}
          {when ? ` · ${when}` : ""}
          {row.duration_seconds ? ` · ${formatDuration(row.duration_seconds)}` : ""}
          {sizeMb ? ` · ${sizeMb}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="border border-border" disabled={busy} onClick={() => run(() => downloadVideo(row))}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
        <Button variant="ghost" size="sm" className="border border-border text-destructive" disabled={busy} onClick={() => run(async () => { await deleteVideo(row); onDeleted(row.id); })}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
    </section>
  );
}

function VideosPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<VideoRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listVideos());
    } catch (e) {
      setErr((e as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (loading) return null;
  if (!user) return <AuthScreen />;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateVideoFile(file);
    if (problem) { setErr(problem); return; }
    setUploading(true); setErr(null);
    try {
      const durationSeconds = await readMediaDuration(file);
      const title = file.name.replace(/\.[^.]+$/, "").trim() || "My video";
      const saved = await saveVideo(file, { tool: "upload", title, durationSeconds });
      setItems((prev) => [saved, ...(prev ?? [])]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <GlobalNavigationShell active="videos">
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold">Videos</h1>
              <p className="text-xs text-muted-foreground">
                Your private library — only you can see these. Save dubs from Studio here, or upload your own clips (up to 200 MB).
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload video"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
              />
            </label>
          </header>

          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

          {items === null ? (
            <p className="text-sm text-muted-foreground">Loading your videos…</p>
          ) : items.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No videos yet. Upload a clip above, or in Studio use “Save to my Videos” after generating a dub or voice-over.
            </section>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((row) => (
                <VideoCard key={row.id} row={row} onDeleted={(id) => setItems((prev) => (prev ?? []).filter((v) => v.id !== id))} />
              ))}
            </div>
          )}
        </div>
      </main>
    </GlobalNavigationShell>
  );
}
