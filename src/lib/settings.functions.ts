import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the public payment settings (prices, EFT bank details, WhatsApp
 * number) for the Upgrade screen. The app_settings table itself is
 * admin-only; this function exposes only the fields a signed-in user needs
 * to make a payment.
 */
export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select(
        "price_1m, price_3m, price_12m, bank_account_holder, bank_name, bank_account_number, bank_branch_code, bank_account_type, whatsapp_number",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
