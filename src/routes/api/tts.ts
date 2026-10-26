import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer } from "@/lib/api-auth.server";

/**
 * Neural text-to-speech.
 * Primary: Google Gemini TTS (user's GEMINI_API_KEY), PCM wrapped as WAV.
 * Fallback: Lovable AI Gateway (openai/gpt-4o-mini-tts, MP3).
 */

const GEMINI_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

// Map OpenAI-style voice names the client sends to Gemini prebuilt voices.
const VOICE_MAP: Record<string, string> = {
  alloy: "Kore",
  echo: "Puck",
  fable: "Aoede",
  onyx: "Charon",
  nova: "Leda",
  shimmer: "Zephyr",
};

function describe(status: number): string {
  if (status === 402) return "out of credits";
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "key rejected";
  if (status === 400) return "bad request";
  if (status >= 500) return "service unavailable";
  return "error";
}

function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1, bits = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  const byteRate = (sampleRate * channels * bits) / 8;
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, (channels * bits) / 8, true);
  v.setUint16(34, bits, true);
  w(36, "data");
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

type Attempt = { ok: true; audio: Uint8Array } | { ok: false; status: number };

async function geminiTts(key: string, model: string, text: string, lang: string, voice: string): Promise<Attempt> {
  const prompt = lang
    ? `Read the following text aloud exactly as written, naturally, as a native ${lang} speaker with authentic pronunciation and intonation:\n\n${text}`
    : `Read the following text aloud naturally:\n\n${text}`;
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      },
    );
  } catch {
    return { ok: false, status: 503 };
  }
  if (!res.ok) {
    await res.text().catch(() => "");
    return { ok: false, status: res.status };
  }
  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  } | null;
  const inline = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) return { ok: false, status: 502 };
  const pcm = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000);
  return { ok: true, audio: pcmToWav(pcm, rate) };
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyBearer(request);
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: { text?: string; lang?: string; voice?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const text = (body.text ?? "").trim();
        if (!text) {
          return Response.json({ error: "Missing 'text'" }, { status: 400 });
        }
        if (text.length > 10000) {
          return Response.json({ error: "Text too long (max 10000 chars)" }, { status: 413 });
        }

        const voice = body.voice ?? "alloy";
        const lang = body.lang ?? "";
        const failures: string[] = [];

        // 1) Gemini TTS — fall through models on any non-OK except a rejected key.
        const gKey = process.env.GEMINI_API_KEY;
        if (gKey) {
          const gVoice = VOICE_MAP[voice] ?? "Kore";
          for (const model of GEMINI_TTS_MODELS) {
            const r = await geminiTts(gKey, model, text, lang, gVoice);
            if (r.ok) {
              const bytes = new Uint8Array(new ArrayBuffer(r.audio.length));
              bytes.set(r.audio);
              return new Response(new Blob([bytes], { type: "audio/wav" }), {
                headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
              });
            }
            failures.push(`Gemini ${r.status}: ${describe(r.status)}`);
            if (r.status === 401 || r.status === 403) break; // key rejected — other models won't help
          }
        } else {
          failures.push("Gemini: GEMINI_API_KEY not set");
        }

        // 2) Fallback: Lovable AI Gateway.
        const lKey = process.env.LOVABLE_API_KEY;
        if (lKey) {
          const instructions = lang
            ? `Speak naturally in ${lang} as a native speaker would. Read the text exactly as written.`
            : "Speak naturally as a native speaker.";
          try {
            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
              method: "POST",
              headers: { Authorization: `Bearer ${lKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini-tts",
                input: text,
                voice,
                instructions,
                response_format: "mp3",
              }),
            });
            if (upstream.ok) {
              return new Response(upstream.body, {
                headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
              });
            }
            await upstream.text().catch(() => "");
            failures.push(`Lovable ${upstream.status}: ${describe(upstream.status)}`);
          } catch {
            failures.push("Lovable: network error");
          }
        }

        const lastStatus = Number(/(\d{3})/.exec(failures[failures.length - 1] ?? "")?.[1] ?? 502);
        return Response.json(
          { error: `TTS failed (${failures.join("; ")})` },
          { status: lastStatus >= 400 ? lastStatus : 502 },
        );
      },
    },
  },
});
