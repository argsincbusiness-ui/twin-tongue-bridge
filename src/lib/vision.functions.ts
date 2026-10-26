import { enforceUsage } from "@/lib/usage.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Input for {@link translateImage}: a base64 photo plus the target language. */
export const ImageTranslateInputSchema = z.object({
  /** Raw base64 (no data: prefix) of the captured / uploaded photo. */
  imageBase64: z.string().min(16).max(8_000_000),
  mimeType: z.string().min(3).max(60),
  targetLang: z.string().min(2).max(35),
});
export type ImageTranslateInput = z.infer<typeof ImageTranslateInputSchema>;

export const ImageTranslateOutputSchema = z.object({
  /** Text found in the photo, transcribed verbatim. */
  extracted: z.string(),
  translated: z.string(),
  detectedLang: z.string().max(60).optional(),
});
export type ImageTranslateOutput = z.infer<typeof ImageTranslateOutputSchema>;

/**
 * Reads the text in a photo (sign, menu, document) and translates it,
 * using the project's own Gemini key — the same engine as live speech
 * translation, so wording and tone stay consistent.
 */
export const translateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageTranslateInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ImageTranslateOutput> => {
    await enforceUsage(context.supabase, "photo");
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error(
        "No Gemini API key is configured. Add GEMINI_API_KEY in project secrets.",
      );
    }

    const prompt = `You are a professional interpreter reading a photo.
1. Transcribe ALL readable text in the image, verbatim, in its original language, preserving line order.
2. Identify the language of that text.
3. Translate it into ${data.targetLang} the way a fluent native speaker would say it, preserving meaning, tone, names, numbers, prices, dates and units exactly.
Respond ONLY with strict JSON: {"detectedLang":"<English name of the source language>","extracted":"<verbatim text>","translated":"<the translation>"}.
If the image contains no readable text, return empty strings for extracted and translated. No markdown fences, no commentary.`;

    const models = [
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ];
    let lastError: Error | null = null;
    let raw = "";

    for (let attempt = 0; attempt < models.length; attempt++) {
      const model = models[attempt];
      if (attempt > 0) await new Promise((res) => setTimeout(res, 300 * attempt));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (r.ok) {
        const j = (await r.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        raw =
          j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
        break;
      }

      const body = await r.text().catch(() => "");
      if (r.status === 401 || r.status === 403) {
        throw new Error(
          "The Gemini API key was rejected, or the image could not be read. Check GEMINI_API_KEY and try a clearer photo.",
        );
      }
      if (r.status === 413) {
        throw new Error("That photo is too large. Try a smaller or lower-resolution image.");
      }
      if (r.status === 429) {
        lastError = new Error(
          "Gemini rate limit or quota reached. Please try again shortly.",
        );
        // Quota is per-model: try the next model, which has its own quota.
        continue;
      }
      if (r.status >= 500) {
        lastError = new Error(
          "Gemini is busy right now (high demand). Please try again in a moment.",
        );
        continue;
      }
      // 400 (model rejected the request shape) and 404 (unknown model) also
      // fall through to the next model before surfacing an error.
      lastError = new Error(`Photo translation failed (${r.status}): ${body.slice(0, 200)}`);
    }

    if (!raw) throw lastError ?? new Error("No text could be read from that photo.");

    let extracted = "";
    let translated = "";
    let detectedLang: string | undefined;

    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const j = JSON.parse(cleaned) as Partial<ImageTranslateOutput>;
      extracted = typeof j.extracted === "string" ? j.extracted.trim() : "";
      translated = typeof j.translated === "string" ? j.translated.trim() : "";
      detectedLang =
        typeof j.detectedLang === "string" && j.detectedLang.trim()
          ? j.detectedLang.trim().slice(0, 60)
          : undefined;
    } catch {
      translated = cleaned;
    }

    if (!extracted && !translated) {
      throw new Error("No readable text was found in that photo.");
    }

    return ImageTranslateOutputSchema.parse({ extracted, translated, detectedLang });
  });
