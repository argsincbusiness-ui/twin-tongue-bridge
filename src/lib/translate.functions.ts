import { enforceUsage } from "@/lib/usage.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseAutoResponse } from "./translate-parse";


/** Min/max bounds for language identifier fields (BCP-47 tag or language name). */
export const LANG_MIN = 2;
export const LANG_MAX = 35;

/** Validates inputs sent to the {@link translate} server function. */
export const TranslateInputSchema = z.object({
  text: z.string().min(1).max(10000),
  /** Tone the interpreter should adopt in the target language. */
  style: z
    .enum(["natural", "casual", "professional", "formal", "friendly", "business"])
    .optional(),
  sourceLang: z.string().min(LANG_MIN).max(LANG_MAX),
  targetLang: z.string().min(LANG_MIN).max(LANG_MAX),
  /** Last few exchanges, oldest first, used as context for pronouns/terms. */
  history: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        original: z.string(),
        translated: z.string(),
      }),
    )
    .max(20)
    .optional(),
});
export type TranslateInput = z.infer<typeof TranslateInputSchema>;

/** Shape returned by the {@link translate} server function. */
export const TranslateOutputSchema = z.object({
  translated: z.string().min(1),
  /** Name of the language detected when sourceLang is "auto". */
  detectedLang: z.string().min(1).max(LANG_MAX).optional(),
});
export type TranslateOutput = z.infer<typeof TranslateOutputSchema>;

/** Sentinel accepted as sourceLang to request automatic detection. */
export const AUTO_SOURCE = "auto";

export const translate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranslateInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<TranslateOutput> => {
    await enforceUsage(context.supabase, "translation");
    const geminiKey = process.env.GEMINI_API_KEY;



    const auto = data.sourceLang.trim().toLowerCase() === AUTO_SOURCE;

    const historyBlock = (data.history ?? [])
      .slice(-6)
      .map(
        (h, i) =>
          `${i + 1}. (${h.from} -> ${h.to})\n   Original: ${h.original}\n   Translation: ${h.translated}`,
      )
      .join("\n");

    const sourceClause = auto
      ? "First identify which language the user's message is spoken in (it can be any language), then translate it"
      : `Translate the user's message from ${data.sourceLang}`;

    const outputClause = auto
      ? `- Respond ONLY with strict JSON: {"detectedLang":"<English name of the detected language>","translated":"<the translation>"}. No markdown fences, no commentary.`
      : "- Output ONLY the translated sentence. No quotes, no notes, no language labels, no alternatives.";

    const STYLE_RULES: Record<string, string> = {
      natural: "Sound like a fluent native speaker in everyday conversation.",
      casual: "Sound relaxed and informal, like friends chatting. Use contractions and slang freely.",
      professional: "Sound polished and competent, clear and courteous, without stiffness.",
      formal: "Use formal register, honorifics and complete sentences. Avoid slang and contractions.",
      friendly: "Sound warm, approachable and encouraging while staying accurate.",
      business: "Use concise business register with precise terminology suitable for meetings and negotiation.",
    };
    const styleRule = STYLE_RULES[data.style ?? "natural"] ?? STYLE_RULES.natural;

    const system = `You are a professional human interpreter for live face-to-face conversation.
${sourceClause} into ${data.targetLang}.
Rules:
${outputClause}
- Translate meaning, not words. Match the speaker's register: if they are casual, sound casual; if they are formal, sound formal.
- Preserve slang, idioms, humor, emphasis and emotional tone. Render them with the closest natural equivalent slang / idiom in ${data.targetLang} rather than a literal translation. Never explain a slang word — replace it.
- Use the everyday spoken form a native ${data.targetLang} speaker would actually say out loud, including contractions and discourse markers (e.g. "yeah", "well", "you know" → their natural equivalents).
- Preserve proper names, place names, addresses, phone numbers, dates, times, numeric values, currencies and units exactly.
- Use the conversation history to resolve pronouns (he/she/they/it/this/that) and keep terminology consistent.
- Silently correct obvious speech-recognition mistakes.
- If the input is already in ${data.targetLang}, return it cleaned up in the same register.
- Use punctuation appropriate to ${data.targetLang}.
- Tone: ${styleRule}`;

    const userMsg = historyBlock
      ? `Recent conversation context:\n${historyBlock}\n\nNow translate this new utterance:\n"""${data.text}"""`
      : `Translate this utterance:\n"""${data.text}"""`;

    /** Call the Gemini REST API with the user's own key, trying models in order. */
    async function callGemini(apiKey: string): Promise<string> {
      const models = [
        "gemini-3.5-flash",
        "gemini-flash-latest",
      ];
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < models.length; attempt++) {
        const model = models[attempt];
        if (attempt > 0) await new Promise((res) => setTimeout(res, 250 * attempt));
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: userMsg }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                // Disable "thinking" — translation is a reflex task and the
                // reasoning pass adds several seconds of latency.
                thinkingConfig: { thinkingBudget: 0 },
                ...(auto ? { responseMimeType: "application/json" } : {}),
              },
            }),
          },
        );

        if (r.ok) {
          const j = (await r.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          return (
            j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? ""
          );
        }

        const body = await r.text().catch(() => "");
        if (r.status === 401 || r.status === 403) {
          throw new Error(
            "The Gemini API key was rejected. Check that GEMINI_API_KEY is a valid Google AI Studio key and that the Generative Language API is enabled.",
          );
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
        lastError = new Error(`Translation failed (${r.status}): ${body.slice(0, 200)}`);
      }

      throw lastError ?? new Error("Translation failed");
    }

    let raw = "";
    try {
      if (!geminiKey) throw new Error("No Gemini API key configured");
      raw = await callGemini(geminiKey);
      if (!raw) throw new Error("Empty Gemini response");
    } catch (geminiErr) {
      // Gemini unavailable (overloaded, quota, bad key): use the backup translator.
      console.warn("Gemini translate failed, using AI Gateway:", (geminiErr as Error).message);
      const { translateViaGateway } = await import("./gateway-translate.server");
      raw = await translateViaGateway({ system, user: userMsg, json: auto });
    }
    if (!raw) throw new Error("Empty translation response");

    if (auto) {
      const parsed = parseAutoResponse(raw);
      if (parsed) return TranslateOutputSchema.parse(parsed);
      throw new Error("Auto-detect returned an unparseable response. Please try again.");
    }

    return TranslateOutputSchema.parse({ translated: raw });
  });

