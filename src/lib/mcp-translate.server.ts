import { createClient } from "@supabase/supabase-js";
import { enforceUsage } from "@/lib/usage.server";
import { translateViaGateway } from "@/lib/gateway-translate.server";

type Input = { text: string; sourceLang?: string; targetLang: string; style?: "natural" | "casual" | "professional" | "formal" | "friendly" | "business" };

export async function translateForMcp(accessToken: string, input: Input) {
  const text = input.text.trim();
  const sourceLang = (input.sourceLang ?? "auto").trim();
  const targetLang = input.targetLang.trim();
  if (!text || text.length > 10000) throw new Error("Text must contain 1–10,000 characters.");
  if (sourceLang.length < 2 || sourceLang.length > 35 || targetLang.length < 2 || targetLang.length > 35) {
    throw new Error("Language names or language tags must be 2–35 characters.");
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Consume the same daily allowance and enforce the same Pro/suspension rules as the app.
  await enforceUsage(supabase, "translation");

  const auto = sourceLang.toLowerCase() === "auto";
  const styles: Record<string, string> = {
    natural: "Sound like a fluent native speaker in everyday conversation.",
    casual: "Sound relaxed and informal, like friends chatting.",
    professional: "Sound polished, clear and courteous.",
    formal: "Use formal register and complete sentences. Avoid slang.",
    friendly: "Sound warm, approachable and encouraging.",
    business: "Use concise business register with precise terminology.",
  };
  const style = styles[input.style ?? "natural"] ?? styles.natural;
  const system = `You are a professional human interpreter. Translate the user's message ${auto ? "from its detected language" : `from ${sourceLang}`} into ${targetLang}.
Rules:
- ${auto ? 'Return ONLY strict JSON: {"detectedLang":"<English language name>","translated":"<translation>"}. No markdown.' : "Return ONLY the translated text, with no notes or language labels."}
- Translate meaning, not words. Preserve slang, idioms, humor, emphasis and emotional tone naturally.
- Use everyday spoken language appropriate to ${targetLang}.
- Preserve proper names, addresses, phone numbers, dates, times, numbers, currencies and units exactly.
- Silently correct obvious speech-recognition mistakes.
- If the input is already in ${targetLang}, return it cleaned up in the same register.
- Tone: ${style}`;
  const user = `Translate this utterance:\n"""${text}"""`;

  let raw = "";
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    for (const model of ["gemini-3.5-flash", "gemini-flash-latest"]) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 }, ...(auto ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      if (response.ok) {
        const json = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        raw = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("").trim() ?? "";
        if (raw) break;
      }
      if (response.status === 401 || response.status === 403) break;
    }
  }

  if (!raw) raw = await translateViaGateway({ system, user, json: auto });
  if (!raw) throw new Error("The translation provider returned an empty response.");
  if (!auto) return { translated: raw };
  try {
    const parsed = JSON.parse(raw) as { detectedLang?: unknown; translated?: unknown };
    if (typeof parsed.detectedLang !== "string" || typeof parsed.translated !== "string" || !parsed.translated.trim()) {
      throw new Error("The auto-detection response was incomplete. Please try again.");
    }
    return { detectedLang: parsed.detectedLang, translated: parsed.translated };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("The auto-detection response could not be parsed. Please try again.");
    throw error;
  }
}
