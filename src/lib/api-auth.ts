import { supabase } from "@/integrations/supabase/client";

/**
 * Authorization header for the raw `/api/*` speech endpoints, which
 * require a signed-in user (they spend paid AI credits).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
