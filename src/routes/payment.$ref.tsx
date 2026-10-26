import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Upload, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/components/AuthScreen";
import { getPaymentSettings } from "@/lib/settings.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/payment/$ref")({
  head: () => ({
    meta: [
      { title: "Payment confirmation — Neural Duplex Lite" },
      { name: "description", content: "Your EFT payment confirmation and reference for Neural Duplex Lite Pro." },
      { property: "og:title", content: "Payment confirmation — Neural Duplex Lite" },
      { property: "og:description", content: "Your EFT payment confirmation and reference." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { ref } = Route.useParams();
  const { user, loading } = useAuth();
  const [p, setP] = useState<Tables<"payment_requests"> | null | undefined>(undefined);
  const [wa, setWa] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("payment_requests").select("*").eq("ref", ref).maybeSingle();
    setP(data);
  };

  useEffect(() => {
    if (!user) return;
    load();
    getPaymentSettings().then((s) => setWa(s?.whatsapp_number ?? "")).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ref]);

  if (loading) return null;
  if (!user) return <AuthScreen />;
  if (p === undefined) return <main className="min-h-screen bg-background" />;
  if (p === null)
    return (
      <main className="min-h-screen bg-background p-6 text-center text-foreground">
        <p>Payment {ref} was not found.</p>
        <Link to="/upgrade" className="mt-3 inline-block text-primary underline">Back to Upgrade</Link>
      </main>
    );

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const path = `${user!.id}/${p!.ref}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("payment-proofs").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("attach_payment_proof", { _id: p!.id, _path: path });
      if (error) throw error;
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const msg = encodeURIComponent(
    `Hi, I've paid for Neural Duplex Lite Pro.\nReference: ${p.ref}\nPlan: ${p.plan_months} month(s)\nAmount: R${p.paid_amount ?? p.amount}\nPaid on: ${p.paid_on ?? ""}\nName: ${p.payer_name ?? ""}\nEmail: ${user.email}\nI'm attaching my proof of payment.`,
  );
  const rows: [string, string][] = [
    ["Reference", p.ref],
    ["Plan", `${p.plan_months} month${p.plan_months > 1 ? "s" : ""}`],
    ["Amount due", `R${p.amount}`],
    ["Amount paid", p.paid_amount != null ? `R${p.paid_amount}` : "—"],
    ["Paid on", p.paid_on ?? "—"],
    ["Paid by", p.payer_name ? `${p.payer_name} (${p.payer_bank})` : "—"],
    ["Submitted", new Date(p.created_at).toLocaleString()],
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 font-display text-xl font-semibold">Payment submitted</h1>
          <p className="mt-1 font-mono text-2xl font-bold text-primary">{p.ref}</p>
          <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-0.5 text-xs capitalize">{p.status}</span>
          <p className="mt-3 text-sm text-muted-foreground">
            {p.status === "approved"
              ? "Your Pro plan is active. Enjoy!"
              : p.status === "rejected"
                ? "We couldn't match this payment. Please contact us on WhatsApp."
                : "Activated within a few hours after we confirm your payment."}
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {p.status === "pending" && (
          <section className="space-y-2">
            {wa && (
              <a
                href={`https://wa.me/${wa.replace(/\D/g, "")}?text=${msg}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground"
              >
                <MessageCircle className="h-4 w-4" /> Send proof on WhatsApp
              </a>
            )}
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {p.proof_path ? "Proof uploaded — replace" : "Upload proof of payment"}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
          </section>
        )}

        <div className="flex justify-between text-xs text-muted-foreground">
          <Link to="/account">My account</Link>
          <Link to="/">Back to app</Link>
        </div>
      </div>
    </main>
  );
}
