import { Link } from "@tanstack/react-router";
import { Crown, ArrowLeft } from "lucide-react";

export function ProRequired({ feature = "Conference room" }: { feature?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <Crown className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-3 font-display text-lg font-semibold">{feature} is a Pro feature</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade to Pro for unlimited translations and photos, conference rooms and Learning Mode.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link to="/upgrade" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Upgrade to Pro
          </Link>
          <Link to="/" className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </div>
    </main>
  );
}
