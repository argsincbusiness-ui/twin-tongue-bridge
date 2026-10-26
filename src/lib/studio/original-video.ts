import { fitDubTiming } from "./schema";

/** Browser-only real-time rendering: original pictures, only the new voice track. */
export async function dubOriginalVideo(original: Blob, dub: Blob, onProgress: (message: string) => void, signal?: AbortSignal) {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser can't save a dub on the original video. Try an up-to-date Chrome or Edge browser; you can still save the audio or captioned video.");
  }
  const video = document.createElement("video");
  const originalUrl = URL.createObjectURL(original);
  video.src = originalUrl; video.muted = true; video.playsInline = true; video.preload = "auto";
  const ctx = new AudioContext();
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  let source: AudioBufferSourceNode | undefined;
  try {
    await ctx.resume();
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("This browser can't open this video. Please try an MP4 or WebM clip."));
      signal?.addEventListener("abort", () => reject(new DOMException("Rendering stopped", "AbortError")), { once: true });
      video.load();
    });
    if (signal?.aborted) throw new DOMException("Rendering stopped", "AbortError");
    const buffer = await ctx.decodeAudioData(await dub.arrayBuffer());
    const timing = fitDubTiming(buffer.duration, video.duration);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const drawing = canvas.getContext("2d");
    if (!drawing || !canvas.width || !canvas.height) throw new Error("We couldn't read the original picture. Please try another clip.");
    const destination = ctx.createMediaStreamDestination();
    source = ctx.createBufferSource(); source.buffer = buffer;
    source.playbackRate.value = timing.rate;
    source.connect(destination); // Deliberately never connect the original sound.
    stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const mime = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error("This browser can't record video. Try Chrome or Edge; your dubbed audio is still available.");
    recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const activeRecorder = recorder;
    const done = new Promise<void>((resolve, reject) => {
      activeRecorder.onstop = () => resolve();
      activeRecorder.onerror = () => reject(new Error("The browser couldn't finish this video. Please try again with a shorter clip."));
      video.onerror = () => reject(new Error("The original video stopped playing. Please try another clip."));
      signal?.addEventListener("abort", () => reject(new DOMException("Rendering stopped", "AbortError")), { once: true });
    });
    const warning = timing.mismatch
      ? timing.fittedSeconds > video.duration
        ? "The dub is still too long at 1.2× speed; the ending is cut off. Shorten the words and dub again for a complete fit."
        : "The dub is still too short at 0.85× speed; the end of the video is silent. Add words and dub again for a closer fit."
      : "";
    const draw = () => {
      drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(`Rendering original footage… ${Math.min(100, Math.round(video.currentTime / video.duration * 100))}%${warning ? ` ${warning}` : ""}`);
      frame = requestAnimationFrame(draw);
    };
    drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.onended = () => { if (activeRecorder.state !== "inactive") activeRecorder.stop(); };
    await video.play();
    recorder.start(250); source.start(); draw();
    await done;
    if (!chunks.length) throw new Error("The browser produced an empty video. Please try again in Chrome or Edge.");
    return { video: new Blob(chunks, { type: mime.split(";")[0] }), warning };
  } catch (error) {
    if (error instanceof DOMException && error.name !== "AbortError") {
      throw new Error("This browser couldn't render the original video. Try Chrome or Edge, or save the audio instead.");
    }
    throw error;
  } finally {
    cancelAnimationFrame(frame);
    video.pause(); video.removeAttribute("src"); video.load();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    try { source?.stop(); } catch { /* Already finished. */ }
    stream?.getTracks().forEach(track => track.stop());
    await ctx.close(); URL.revokeObjectURL(originalUrl);
  }
}