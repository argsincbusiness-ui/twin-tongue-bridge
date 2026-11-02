import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, LogOut, ShieldCheck } from "lucide-react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useUsage } from "@/hooks/useUsage";
import { AuthScreen } from "@/components/AuthScreen";
import { GlobalNavigationShell } from "@/components/GlobalNavigationShell";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Neural Duplex Lite" },
      { name: "description", content: "Your Neural Duplex profile: plan, usage and account links." },
      { property: "og:title", content: "Profile — Neural Duplex Lite" },
      { property: "og:description", content: "Your plan, usage and account links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, access } = useAuth();
  const { usage } = useUsage(!!user);

  if (loading) return null;
  if (!user) return <AuthScreen />;

  const plan = usage?.admin ? "Admin (unlimited)" : usage?.pro ? "Pro" : "Free";
  const initial = (user.email ?? "?").slice(0, 1).toUpperCase();
  const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString() : null;

  return (
    <GlobalNavigationShell active="profile">
      <main className="min-h-screen px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-4">
          <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-semibold text-primary-foreground"
              style={{ background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))" }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">{user.email}</p>
              {memberSince && <p className="text-xs text-muted-foreground">Member since {memberSince}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-1 font-semibold">Plan</h2>
            <p className="text-base font-semibold">{plan}</p>
            {usage?.pro && !usage.admin && usage.pro_expires_at && (
              <p className="mt-1">
                Pro expires on <strong>{new Date(usage.pro_expires_at).toLocaleDateString()}</strong>
              </p>
            )}
            {usage && !usage.pro && (
              <p className="mt-1 text-muted-foreground">
                Today: {usage.translations_used}/{usage.translations_limit} translations,{" "}
                {usage.photos_used}/{usage.photos_limit} photos
              </p>
            )}
            {usage?.suspended && <p className="mt-1 text-destructive">Your account is suspended.</p>}
            {!usage?.admin && (
              <Link
                to="/upgrade"
                className="mt-3 inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                {usage?.pro ? "Renew / extend Pro" : "Upgrade to Pro"}
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-2 text-sm">
            <h2 className="px-2 pb-1 pt-2 font-semibold">Account</h2>
            <nav className="flex flex-col">
              <Link
                to="/account"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/10"
              >
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">Payments &amp; history</span>
              </Link>
              <Link
                to="/privacy"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/10"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">Privacy (POPIA)</span>
              </Link>
              {access.isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/10"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">Admin dashboard</span>
                </Link>
              )}
            </nav>
          </section>

          <button
            onClick={() => signOut()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </main>
    </GlobalNavigationShell>
  );
}
