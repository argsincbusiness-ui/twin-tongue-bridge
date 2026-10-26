/**
 * Backup translator: Lovable AI Gateway (Responses API, streamed) used only
 * when Gemini is unavailable. Server-only — reads LOVABLE_API_KEY.
 */
export async function translateViaGateway(opts: {
  system: string;
  user: string;
  json: boolean;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Backup translator is not configured.");

  const body: Record<string, unknown> = {
    model: "openai/gpt-6-astra",
    instructions: opts.system,
    input: [{ role: "user", content: opts.user }],
    reasoning: { effort: "low" },
    store: false,
    stream: true,
  };
  if (opts.json) {
    body.text = {
      format: {
        type: "json_schema",
        name: "translation",
        strict: true,
        schema: {
          type: "object",
          properties: { detectedLang: { type: "string" }, translated: { type: "string" } },
          required: ["detectedLang", "translated"],
          additionalProperties: false,
        },
      },
    };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let msg = "";
    try {
      msg = (JSON.parse(t) as { error?: { message?: string }; message?: string }).error?.message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 402) throw new Error(msg || "Backup translator is out of AI credits.");
    if (res.status === 429) throw new Error("Translation is busy right now. Please try again shortly.");
    throw new Error(msg || `Backup translation failed (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error")
            throw new Error(ev.response?.error?.message || "Backup translation failed.");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Backup")) throw e;
        }
      }
    }
  }
  return out.trim();
}
