import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer } from "@/lib/api-auth.server";

/**
 * Audio transcription fallback for browsers without Web Speech API
 * (e.g. iOS Safari, in-app webviews). Accepts multipart/form-data with
 * a `file` field. Forwards to Lovable AI Gateway STT.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyBearer(request);
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json(
            { error: "LOVABLE_API_KEY is not configured" },
            { status: 500 },
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const file = form.get("file");
        const language = (form.get("language") as string | null) ?? undefined;
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Missing or empty audio file" }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ error: "Audio too large (max 20MB)" }, { status: 413 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, file.name || "recording.webm");
        if (language) {
          // Pass bare ISO-639-1 only; locale strings get rejected.
          upstream.append("language", language.split("-")[0]);
        }

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          },
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return Response.json(
            { error: `Transcription failed (${res.status})`, detail: body.slice(0, 300) },
            { status: res.status },
          );
        }

        const json = (await res.json()) as { text?: string };
        return Response.json({ text: json.text ?? "" });
      },
    },
  },
});
