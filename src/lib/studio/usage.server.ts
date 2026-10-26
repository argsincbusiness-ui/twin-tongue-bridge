import type { StudioUsageInput } from "./schema";

export async function recordStudioUsage(userId: string, data: StudioUsageInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("studio_usage").insert({
    user_id: userId, tool: data.tool, language: data.language,
    character_count: data.characterCount, generation_kind: data.generationKind,
  });
  if (error) throw new Error("Your generation finished, but the Studio usage log couldn't be saved. Please contact the administrator.");
}