import { Link } from "@tanstack/react-router";
import { Crown, AlertTriangle } from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

/** Usage counter, limit-hit upgrade prompt and 3-day expiry reminder. */
export function PlanBar() {
  const { usage } = useUsage();
  if (!usage) return null;

  if (usage.pro) {
    if (usage.admin || !usage.pro_expires_at) return null;
    const msLeft = new Date(usage.pro_expires_at).getTime() - Date.now();
    if (msLeft > 3 * 86400_000) return null;
    return (
      <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs sm:mx-6">
        <span>
          Your Pro plan ends on {new Date(usage.pro_expires_at).toLocaleDateString()}.
        </span>
        <Link to="/upgrade" className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground">
          Renew
        </Link>
      </div>
    );
  }

  const tLeft = Math.max(0, usage.translations_limit - usage.translations_used);
  const pLeft = Math.max(0, usage.photos_limit - usage.photos_used);
  const out = tLeft === 0 || pLeft === 0;

  return (
    <div
      className={
        "mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs sm:mx-6 " +
        (out ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/40")
      }
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {out && <AlertTriangle className="h-3.5 w-3.5 text-primary" />}
        <span>
          <strong className="text-foreground">{tLeft}/{usage.translations_limit}</strong> translations ·{" "}
          <strong className="text-foreground">{pLeft}/{usage.photos_limit}</strong> photos left today
        </span>
      </span>
      <span className="flex items-center gap-2">
        {out && <span className="hidden text-foreground sm:inline">Out of free uses for today.</span>}
        <Link
          to="/upgrade"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground"
        >
          <Crown className="h-3.5 w-3.5" /> Upgrade
        </Link>
      </span>
    </div>
  );
}
