import { authHeaders } from "@/lib/api-auth";

/** Studio voices offered in the UI (mapped to natural neural voices server-side). */
export const STUDIO_VOICES = [
  { key: "alloy", label: "Kore — warm female" },
  { key: "echo", label: "Puck — upbeat male" },
  { key: "fable", label: "Aoede — storyteller" },
  { key: "onyx", label: "Charon — deep male" },
  { key: "nova", label: "Leda — bright female" },
  { key: "shimmer", label: "Zephyr — calm" },
] as const;

/** Render speech for a script through the app's voice engine. */
export async function synthesize(text: string, lang: string, voice = "alloy"): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ text: text.slice(0, 10000), lang, voice }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Voice failed (${res.status})`);
  }
  return res.blob();
}

/** Speech-to-text for uploaded or recorded audio/video. */
export async function transcribeFile(file: Blob, lang?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, (file as File).name || "audio.webm");
  if (lang) form.append("language", lang);
  const res = await fetch("/api/transcribe", { method: "POST", headers: await authHeaders(), body: form });
  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(json.error || `Transcription failed (${res.status})`);
  return json.text ?? "";
}

/** Encode an AudioBuffer as 16-bit PCM WAV. */
export function bufferToWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2;
  const out = new DataView(new ArrayBuffer(44 + len));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + len, true); w(8, "WAVE"); w(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, len, true);
  let off = 44;
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  for (let i = 0; i < buf.length; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  return new Blob([out], { type: "audio/wav" });
}

/** Join several audio clips (with a short gap) into one WAV file. */
export async function joinClips(clips: Blob[], gapSec = 0.35): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const bufs = await Promise.all(clips.map(async (b) => ctx.decodeAudioData(await b.arrayBuffer())));
    const rate = bufs[0]?.sampleRate ?? 24000;
    const gap = Math.round(gapSec * rate);
    const total = bufs.reduce((n, b) => n + Math.round(b.duration * rate) + gap, 0);
    const off = new OfflineAudioContext(1, Math.max(total, 1), rate);
    let t = 0;
    for (const b of bufs) {
      const src = off.createBufferSource();
      src.buffer = b;
      src.connect(off.destination);
      src.start(t);
      t += b.duration + gapSec;
    }
    return bufferToWav(await off.startRendering());
  } finally {
    void ctx.close();
  }
}

/**
 * Turn audio into a shareable video (title card + captions) for social apps
 * that only accept video. Uses MP4 when the browser can record it, else WebM.
 */
export async function audioToVideo(audio: Blob, title: string, caption: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1080;
  const g = canvas.getContext("2d")!;
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(await audio.arrayBuffer());
  const dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(dest);
  const analyser = ctx.createAnalyser();
  src.connect(analyser);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(
    (m) => MediaRecorder.isTypeSupported(m),
  ) ?? "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const words = caption.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).length > 34) { lines.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd;
  }
  if (cur) lines.push(cur);
  const bins = new Uint8Array(64);
  let raf = 0;
  const draw = () => {
    g.fillStyle = "#06201f"; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = "#2dd4bf"; g.font = "bold 56px sans-serif"; g.textAlign = "center";
    g.fillText(title.slice(0, 30), 540, 160);
    analyser.getByteFrequencyData(bins);
    for (let i = 0; i < 32; i++) {
      const h = 20 + bins[i] * 1.2;
      g.fillRect(140 + i * 25, 540 - h / 2, 16, h);
    }
    g.fillStyle = "#e6fffb"; g.font = "38px sans-serif";
    const prog = ctx.currentTime / buf.duration;
    const start = Math.max(0, Math.floor(prog * lines.length) - 1);
    lines.slice(start, start + 4).forEach((l, i) => g.fillText(l, 540, 780 + i * 52));
    raf = requestAnimationFrame(draw);
  };
  draw();
  rec.start();
  src.start();
  await new Promise<void>((r) => (src.onended = () => r()));
  await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
  cancelAnimationFrame(raf);
  void ctx.close();
  return new Blob(chunks, { type: mime.split(";")[0] });
}

export function extFor(blob: Blob): string {
  if (blob.type.includes("mpeg")) return "mp3";
  if (blob.type.includes("wav")) return "wav";
  if (blob.type.includes("mp4")) return "mp4";
  if (blob.type.includes("webm")) return "webm";
  return "bin";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type SocialTarget = "native" | "whatsapp" | "facebook" | "instagram" | "tiktok" | "x" | "youtube";

const WEB_SHARE: Partial<Record<SocialTarget, (t: string) => string>> = {
  whatsapp: (t) => `https://wa.me/?text=${encodeURIComponent(t)}`,
  facebook: (t) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(t)}&u=${encodeURIComponent(location.origin)}`,
  x: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
  instagram: () => "https://www.instagram.com/",
  tiktok: () => "https://www.tiktok.com/upload",
  youtube: () => "https://studio.youtube.com/",
};

/** Share media + transcript via OS sheet; otherwise download and open the app. */
export async function shareMedia(target: SocialTarget, files: File[], transcript: string): Promise<string | undefined> {
  try { await navigator.clipboard?.writeText(transcript); } catch { /* best effort */ }
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text: transcript, title: "Neural Duplex Studio" });
      return undefined;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return undefined;
    }
  }
  files.forEach((f) => downloadBlob(f, f.name));
  const url = WEB_SHARE[target]?.(transcript);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  return "Files saved to your device and transcript copied — attach them in the app that opened.";
}
