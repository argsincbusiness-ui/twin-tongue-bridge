import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { podcastInputSchema, studioUsageSchema } from "./studio/schema";

export const logStudioGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => studioUsageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { recordStudioUsage } = await import("./studio/usage.server");
    await recordStudioUsage(context.userId, data);
    return { ok: true };
  });

export const writePodcastScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => podcastInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { requestPodcastScript } = await import("./studio/podcast.server");
    return requestPodcastScript(getRequest(), context.userId, data);
  });

export const getStudioUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Only administrators can view Studio usage.");
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error: readError } = await context.supabase.from("studio_usage")
        .select("user_id, created_at, tool, language, character_count, generation_kind")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
      if (readError) throw new Error("Studio usage couldn't be loaded. Please try again.");
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  });