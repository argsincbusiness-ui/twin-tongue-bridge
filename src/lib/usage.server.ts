import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageKind = "translation" | "photo" | "room" | "learning";

/**
 * Server-side plan enforcement. Atomically checks and consumes one unit of the
 * caller's daily free allowance (Pro and admins are unlimited). Throws a
 * user-facing error when blocked.
 */
export async function enforceUsage(supabase: SupabaseClient<any>, kind: UsageKind) {
  const { data, error } = await supabase.rpc("consume_usage", { _kind: kind });
  if (error) throw new Error(`Could not check your plan: ${error.message}`);
  const res = (data ?? {}) as { allowed?: boolean; reason?: string; limit?: number };
  if (res.allowed) return;
  if (res.reason === "suspended") throw new Error("Your account is suspended. Contact support.");
  if (res.reason === "pro_required") throw new Error("This feature needs Pro. Upgrade to Pro to unlock it.");
  const what = kind === "photo" ? "photo translations" : "translations";
  throw new Error(
    `You've used all ${res.limit ?? ""} free ${what} for today. Upgrade to Pro for unlimited use.`,
  );
}
