import { enforceUsage } from "@/lib/usage.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CoachInputSchema, CoachOutputSchema, parseCoachResponse } from "@/lib/coach-schema";
import { buildCoachPrompt, requestCoach } from "@/lib/coach.server";
import type { CoachOutput } from "@/lib/coach-schema";

/**
 * Learning Mode: after a turn has already been translated and spoken, produce
 * a more natural phrasing, a pronunciation guide and a little vocabulary.
 * Deliberately a separate call so it can never delay the live conversation.
 */
export const coachTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CoachInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CoachOutput | null> => {
    await enforceUsage(context.supabase, "learning");
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    const raw = await requestCoach(key, buildCoachPrompt(data));
    const parsed = parseCoachResponse(raw);
    return parsed ? CoachOutputSchema.parse(parsed) : null;
  });
