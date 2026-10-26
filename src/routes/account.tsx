import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useUsage } from "@/hooks/useUsage";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Neural Duplex Lite" },
      { name: "description", content: "Your plan, Pro expiry date, usage and payment history." },
      { property: "og:title", content: "My account — Neural Duplex Lite" },
      { property: "og:description", content: "Your plan, Pro expiry date, usage and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Payment = { id: string; ref: string; plan_months: number; amount: number; status: string; created_at: string };

function AccountPage() {
  const { user, loading } = useAuth();
  const { usage } = useUsage(!!user);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("payment_requests")
      .select("id, ref, plan_months, amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPayments((data as Payment[]) ?? []));
  }, [user]);

  if (loading) return null;
  if (!user) return <AuthScreen />;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/" className="text-xs text-muted-foreground">← Back to app</Link>
        <h1 className="font-display text-xl font-semibold">My account</h1>
        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-base font-semibold">
            Plan: {usage?.admin ? "Admin (unlimited)" : usage?.pro ? "Pro" : "Free"}
          </p>
          {usage?.pro && !usage.admin && usage.pro_expires_at && (
            <p className="mt-1">Pro expires on <strong>{new Date(usage.pro_expires_at).toLocaleDateString()}</strong></p>
          )}
          {usage && !usage.pro && (
            <p className="mt-1 text-muted-foreground">
              Today: {usage.translations_used}/{usage.translations_limit} translations, {usage.photos_used}/{usage.photos_limit} photos
            </p>
          )}
          {usage?.suspended && <p className="mt-1 text-destructive">Your account is suspended.</p>}
          {!usage?.admin && (
            <Link to="/upgrade" className="mt-3 inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              {usage?.pro ? "Renew / extend Pro" : "Upgrade to Pro"}
            </Link>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Payments</h2>
          {payments.length === 0 ? (
            <p className="text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>{p.ref} · {p.plan_months} mo · R{p.amount}</span>
                  <span className="text-xs capitalize text-muted-foreground">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex justify-between text-xs text-muted-foreground">
          <Link to="/privacy">Privacy (POPIA)</Link>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    </main>
  );
}
