import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Permanently delete a user account (admin only). Needs the auth admin API. */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");
    if (data.userId === context.userId) throw new Error("You can't delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);
    await Promise.all([
      supabaseAdmin.from("profiles").delete().eq("id", data.userId),
      supabaseAdmin.from("subscriptions").delete().eq("user_id", data.userId),
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId),
    ]);
    return { ok: true };
  });
