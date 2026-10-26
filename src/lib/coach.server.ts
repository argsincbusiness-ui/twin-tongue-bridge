import type { CoachInput } from "@/lib/coach-schema";

/** Build the system + user prompt pair for the Learning Mode coach. */
export function buildCoachPrompt(data: CoachInput): { system: string; user: string } {
  const system = `You are a warm, concise language coach helping someone learn ${data.targetLang} during a live conversation.
Respond ONLY with strict JSON, no markdown fences and no commentary, in exactly this shape:
{"natural":"...","pronunciation":"...","vocab":[{"term":"...","meaning":"..."}],"tip":"..."}
Rules:
- "natural": the most natural way a native ${data.targetLang} speaker would say the translated sentence out loud. If the translation is already perfectly natural, return it unchanged.
- "pronunciation": a simple phonetic respelling of the ${data.targetLang} sentence for a ${data.sourceLang} speaker, using syllables separated by hyphens and CAPITALS for the stressed syllable. No IPA.
- "vocab": at most 4 genuinely useful words or short phrases from the ${data.targetLang} sentence, each with a short plain-language meaning. Skip trivial words like "the" or "and". Use [] when nothing is worth teaching.
- "tip": one short sentence of usage, register or culture advice. Empty string if there is nothing useful to add.
- Keep every field short enough to read at a glance mid-conversation.`;

  const user = `Source language: ${data.sourceLang}
Target language: ${data.targetLang}
They said: """${data.original}"""
Translation spoken: """${data.translation}"""`;

  return { system, user };
}

/**
 * Call Gemini (with the project's own GEMINI_API_KEY) for the coaching payload
 * and return the raw message content. Errors are surfaced so the caller can
 * decide to skip the learning card without disturbing the conversation.
 */
export async function requestCoach(
  key: string,
  prompt: { system: string; user: string },
): Promise<string> {
  const models = ["gemini-3.5-flash", "gemini-flash-latest"];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    if (attempt > 0) await new Promise((res) => setTimeout(res, 250 * attempt));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.user }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      },
    );

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return (
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? ""
      );
    }

    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("The Gemini API key was rejected for Learning Mode.");
    }
    // 429 (quota is per-model), 5xx (busy) and 400/404 (model-specific
    // rejection) fall through to the next model.
    lastError =
      res.status === 429
        ? new Error("Rate limited. Learning tips paused briefly.")
        : new Error(`Learning Mode failed (${res.status}): ${body.slice(0, 160)}`);
  }

  throw lastError ?? new Error("Learning Mode failed");
}
