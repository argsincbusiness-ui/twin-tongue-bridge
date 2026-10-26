import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AccessInfo {
  status: "trial" | "active" | "inactive" | null;
  trialEndsAt: string | null;
  isAdmin: boolean;
  hasAccess: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessInfo>({
    status: null,
    trialEndsAt: null,
    isAdmin: false,
    hasAccess: false,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAccess({ status: null, trialEndsAt: null, isAdmin: false, hasAccess: false });
      return;
    }
    let cancelled = false;
    (async () => {
      // Creates profile/plan rows and grants the master admin role server-side.
      await supabase.rpc("ensure_account");
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (cancelled) return;
      const isAdmin = !!roleRows?.some((r) => r.role === "admin");
      // Free plan can use the app; plan limits are enforced on the server.
      setAccess({ status: null, trialEndsAt: null, isAdmin, hasAccess: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { session, user, loading, access };
}

export async function signOut() {
  await supabase.auth.signOut();
}
