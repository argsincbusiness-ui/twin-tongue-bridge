import { z } from "zod";

export const podcastInputSchema = z.object({
  input: z.string().trim().min(1, "Type a topic or paste some text first.").max(10000, "Please keep your topic or text to 10,000 characters or fewer."),
  tone: z.enum(["friendly", "professional", "energetic"]),
  length: z.enum(["short", "medium", "long"]),
  language: z.string().min(1).max(100),
});
export const podcastOutputSchema = z.object({
  lines: z.array(z.object({ host: z.enum(["Host A", "Host B"]), text: z.string() })),
});
export const studioUsageSchema = z.object({
  tool: z.enum(["voice-over", "dubbing", "podcast", "coach"]),
  language: z.string().min(1).max(100),
  characterCount: z.number().int().min(0).max(1000000),
  generationKind: z.enum(["production", "script"]).default("production"),
});
export type StudioUsageInput = z.infer<typeof studioUsageSchema>;

export function fitDubTiming(audioSeconds: number, videoSeconds: number) {
  if (!Number.isFinite(audioSeconds) || !Number.isFinite(videoSeconds) || audioSeconds <= 0 || videoSeconds <= 0) {
    throw new Error("We couldn't read the clip length. Please try another video.");
  }
  const rate = Math.max(0.85, Math.min(1.2, audioSeconds / videoSeconds));
  const fittedSeconds = audioSeconds / rate;
  return { rate, fittedSeconds, mismatch: Math.abs(fittedSeconds - videoSeconds) > Math.max(0.5, videoSeconds * 0.02) };
}

export type StudioUsageRow = { user_id: string; created_at: string; tool: string; language: string; character_count: number; generation_kind: string };
export function summarizeStudioUsage(rows: StudioUsageRow[], perDay: boolean) {
  const groups = new Map<string, { userId: string; day: string; generations: number; characters: number }>();
  for (const row of rows) {
    const day = perDay ? new Date(row.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }) : "All dates";
    const key = `${row.user_id}/${day}`;
    const group = groups.get(key) ?? { userId: row.user_id, day, generations: 0, characters: 0 };
    group.generations += 1;
    group.characters += row.character_count;
    groups.set(key, group);
  }
  return [...groups.values()];
}