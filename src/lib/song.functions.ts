import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SONG_TEXT_MAX = 3000;

export const SongInputSchema = z.object({
  text: z.string().trim().min(1, "Please enter some text first.").max(SONG_TEXT_MAX),
  translateTo: z.string().max(40).optional(),
  voice: z.enum(["male", "female", "duet"]),
  genre: z.string().min(1).max(40),
  customStyle: z.string().max(200).optional(),
  /** Vocal delivery hint derived from the global Voice Style (Sing It). */
  delivery: z.string().max(200).optional(),
  bpm: z.number().int().min(60).max(180).nullable(),
  music: z.enum(["full", "light", "soft", "acapella"]),
  mood: z.string().max(30).optional(),
  length: z.enum(["short", "medium", "full"]),
  rewrite: z.boolean(),
});
export type SongInput = z.infer<typeof SongInputSchema>;

const MUSIC_DESC: Record<SongInput["music"], string> = {
  full: "full band arrangement with punchy drums, bass and beats",
  light: "light, minimal percussion with a gentle beat",
  soft: "no drums at all; voice accompanied only by soft acoustic guitar and piano",
  acapella: "a cappella: voices only, no instruments and no drums",
};
const VOICE_DESC: Record<SongInput["voice"], string> = {
  male: "a male lead vocalist singing",
  female: "a female lead vocalist singing",
  duet: "a male and female duet, trading lines on the verses and harmonising together on the chorus",
};

export const createSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SongInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { translateViaGateway } = await import("./gateway-translate.server");
    let lyrics = data.text;

    // 1) Optional translate and/or rewrite into song lyrics.
    if (data.translateTo || data.rewrite) {
      const lang = data.translateTo ? `in ${data.translateTo}` : "in the same language as the input";
      const system = data.rewrite
        ? `You are a songwriter. Turn the user's text into singable song lyrics ${lang}, with labelled sections like [Verse 1], [Chorus], [Verse 2], [Chorus]. Keep the meaning. ${data.length === "short" ? "Keep it to one short verse and chorus (about 8 lines)." : data.length === "medium" ? "About 16-20 lines." : "A full song, up to about 30 lines."} Output only the lyrics.`
        : `Translate the user's text ${lang}, keeping line breaks so it can be sung. Output only the translation.`;
      lyrics = (await translateViaGateway({ system, user: data.text, json: false })) || data.text;
    }

    // 2) Build the music prompt.
    const style = [data.genre, data.customStyle].filter(Boolean).join(", ");
    const tempo = data.bpm ? `around ${data.bpm} BPM` : "a tempo that suits the genre";
    const lengthHint =
      data.length === "medium" ? "Make the song about 1 to 2 minutes long." : data.length === "full" ? "Make it a complete song of about 3 minutes with intro, verses, choruses and outro." : "";
    const prompt = `A ${style} song with ${VOICE_DESC[data.voice]} clearly sung lyrics with melody. Music: ${MUSIC_DESC[data.music]}. Tempo: ${tempo}.${data.mood ? ` Mood: ${data.mood}.` : ""}${data.delivery ? ` Vocal delivery: ${data.delivery}.` : ""} Sing in the language of the lyrics, exactly as written. ${lengthHint}\nLyrics:\n${lyrics}`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Singing isn't configured yet.");
    const model = data.length === "short" ? "google/lyria-3-clip-preview" : "google/lyria-3-pro-preview";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/music", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model, input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      let msg = "";
      try {
        const j = JSON.parse(t) as { error?: { message?: string } | string; message?: string };
        msg = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message ?? "");
      } catch {
        /* ignore */
      }
      if (res.status === 429) throw new Error("Lots of songs are being made right now. Please try again in a minute.");
      if (res.status === 402) throw new Error(msg || "Out of AI credits for song creation.");
      throw new Error(msg || `Song creation failed (${res.status}). Please try again.`);
    }
    const audio = new Uint8Array(await res.arrayBuffer());
    if (audio.length < 1000) throw new Error("The song came back empty. Please try again.");

    // 3) Save to the user's private song library.
    const path = `${context.userId}/${crypto.randomUUID()}.mp3`;
    const up = await context.supabase.storage.from("songs").upload(path, audio, { contentType: "audio/mpeg" });
    if (up.error) throw new Error(`Couldn't save the song: ${up.error.message}`);
    const title = (lyrics.replace(/\[[^\]]*\]/g, "").trim().split("\n").find((l) => l.trim()) ?? "My song").slice(0, 60);
    const { data: row, error } = await context.supabase
      .from("songs")
      .insert({ user_id: context.userId, title, lyrics, settings: data as never, storage_path: path })
      .select("id, title, lyrics, storage_path, created_at, settings")
      .single();
    if (error) throw new Error(`Couldn't save the song: ${error.message}`);
    return row;
  });
