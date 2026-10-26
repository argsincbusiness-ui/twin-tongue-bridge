import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UsageStatus {
  pro: boolean;
  admin: boolean;
  suspended: boolean;
  pro_expires_at: string | null;
  translations_used: number;
  translations_limit: number;
  photos_used: number;
  photos_limit: number;
}

/** Fire after any action that may have consumed usage so counters refresh. */
export function notifyUsageChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("usage-changed"));
}

export function useUsage(enabled = true) {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("usage_status");
    if (data) setUsage(data as unknown as UsageStatus);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const h = () => refresh();
    window.addEventListener("usage-changed", h);
    const t = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("usage-changed", h);
      clearInterval(t);
    };
  }, [enabled, refresh]);
  return { usage, refresh };
}

/** Wraps a server-fn caller so the usage counter refreshes after every call. */
export function useCountedFn<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return useCallback(
    async (...args: A) => {
      try {
        return await fn(...args);
      } finally {
        notifyUsageChanged();
      }
    },
    [fn],
  );
}
