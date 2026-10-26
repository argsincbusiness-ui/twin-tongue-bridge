import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AudioLines, Mic, MicOff, Square, Volume2, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { useAuth } from "@/hooks/useAuth";
import { interpreterLanguages } from "@/lib/live-interpreter";
import { exportTranslationText } from "@/lib/share";

export function LiveInterpreter({ langA, langB }: { langA: string; langB: string }) {
  const { session } = useAuth();
  const [captions, setCaptions] = useState<{ role: "original" | "translation"; text: string }[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [usageSeconds, setUsageSeconds] = useState<number | null>(null);
  let pairError: string | null = null;
  try { interpreterLanguages(langA, langB); } catch (error) { pairError = error instanceof Error ? error.message : "Select two languages."; }
  const onEvent = (event: LiveEvent) => {
    if ((event.type === "session.usage.updated" || event.type === "session.closed") && typeof event.usage?.seconds === "number") setUsageSeconds(Math.max(15, event.usage.seconds));
    if (event.type === "gateway.session.created") setUsageSeconds(15);
    if ((event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") && typeof event.delta === "string") {
      const role = event.type === "session.input_transcript.delta" ? "original" : "translation";
      const text = event.delta;
      setCaptions((previous) => {
        const last = previous.at(-1);
        if (last?.role === role) return [...previous.slice(0, -1), { role, text: (last.text + text).slice(-10000) }];
        return [...previous.slice(-99), { role, text }];
      });
    }
  };
  const call = useLiveVoice({ onEvent, startData: { token: session?.access_token ?? "", langA, langB } });
  const canStart = call.status === "idle" || call.status === "closed";
  const original = captions.filter(c => c.role === "original").map(c => c.text).join("\n");
  const translation = captions.filter(c => c.role === "translation").map(c => c.text).join("\n");
  return <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5" aria-label="Live Interpreter">
    <div className="flex items-center gap-3"><AudioLines className="h-6 w-6 text-primary" /><div><h2 className="font-display text-lg font-semibold">Live Interpreter</h2><p className="text-xs text-muted-foreground">Pro · Uses AI credits · Maximum 15 minutes per session</p></div></div>
    <audio ref={call.audioRef} controls className="h-10 w-full" aria-label="Live interpreter audio" />
    <p role="status" className="text-sm capitalize text-primary">{call.status === "connected" ? "Listening · Live interpretation" : call.status}</p>
    {usageSeconds !== null && <p className="text-xs text-muted-foreground">Reported billable voice time: {usageSeconds.toFixed(0)} seconds{call.status === "closed" && !call.finalized ? " · Final usage unconfirmed" : ""}</p>}
    {pairError && <p role="alert" className="text-sm text-accent">{pairError}</p>}
    {call.error && <div role="alert" className="text-sm text-destructive"><p>{call.error}</p>{call.error.includes("needs Pro") && <Button asChild variant="link" className="px-0"><Link to="/upgrade">Upgrade to Pro</Link></Button>}</div>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!canStart || !!pairError || !session} onClick={() => { setCaptions([]); setUsageSeconds(null); call.start(); }}><Mic />Start live interpreter</Button>
      <Button variant="outline" disabled={canStart || call.status === "stopping"} onClick={call.stop}><Square />Stop</Button>
      <Button variant="outline" disabled={call.status !== "connected"} onClick={() => call.setMuted(!call.muted)}>{call.muted ? <MicOff /> : <Mic />}{call.muted ? "Unmute" : "Mute"}</Button>
      {call.playbackBlocked && <Button onClick={call.resumePlayback}><Volume2 />Play voice</Button>}
    </div>
    {captions.length > 0 && <div className="border-t border-border pt-4"><div className="mb-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => exportTranslationText({ text: original, translation })}><Download />Export text</Button><Button variant="outline" size="sm" onClick={async () => { try { const text = captions.map(c => `${c.role}: ${c.text}`).join("\n\n"); if (navigator.share) await navigator.share({ title: "Neural Duplex Live Interpreter", text }); else { await navigator.clipboard.writeText(text); setShareError("Conversation copied."); } } catch (error) { setShareError(error instanceof Error ? error.message : "Sharing unavailable."); } }}><Share2 />Share text</Button></div>{shareError && <p role="status" className="text-sm text-muted-foreground">{shareError}</p>}<div className="max-h-80 space-y-4 overflow-y-auto" aria-live="polite">{captions.map((caption,i) => <div key={i}><p className="mb-1 text-[10px] uppercase text-muted-foreground">{caption.role === "original" ? "Spoken phrase" : "Interpreter"}</p><p className={caption.role === "translation" ? "break-words text-sm text-primary" : "break-words text-sm"}>{caption.text}</p></div>)}</div></div>}
  </section>;
}