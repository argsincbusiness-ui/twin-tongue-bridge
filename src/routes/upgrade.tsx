import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Check, Upload, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/components/AuthScreen";
import { getPaymentSettings } from "@/lib/settings.functions";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade to Pro — Neural Duplex Lite" },
      { name: "description", content: "Unlimited translations, photo translation, conference rooms and Learning Mode. Pay by EFT." },
      { property: "og:title", content: "Upgrade to Pro — Neural Duplex Lite" },
      { property: "og:description", content: "Unlimited translations, rooms and Learning Mode. Pay by EFT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UpgradePage,
});

type Payment = Tables<"payment_requests">;

function UpgradePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getPaymentSettings>>>(null);
  const [months, setMonths] = useState<1 | 3 | 12>(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payerName, setPayerName] = useState("");
  const [payerBank, setPayerBank] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));

  const loadPayments = async (uid: string) => {
    const { data } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);
    setPayments(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    getPaymentSettings().then((data) => setSettings(data)).catch(() => setSettings(null));
    loadPayments(user.id);
  }, [user]);

  if (loading) return null;
  if (!user) return <AuthScreen />;

  const plans = settings
    ? [
        { m: 1 as const, label: "1 month", price: settings.price_1m },
        { m: 3 as const, label: "3 months", price: settings.price_3m },
        { m: 12 as const, label: "12 months", price: settings.price_12m },
      ]
    : [];

  const due = plans.find((p) => p.m === months)?.price;

  async function paid(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const name = payerName.trim();
    const bankName = payerBank.trim();
    const amt = Number(paidAmount || due);
    if (!name || name.length > 120) return setErr("Please enter the account holder name.");
    if (!bankName || bankName.length > 80) return setErr("Please enter your bank.");
    if (!amt || amt <= 0) return setErr("Please enter the amount you paid.");
    if (!paidOn) return setErr("Please enter the date you paid.");
    setBusy(true);
    try {
      const { data: req, error } = await supabase.rpc("create_payment_request", { _months: months });
      if (error || !req) throw error ?? new Error("Could not create payment");
      const { error: e2 } = await supabase.rpc("submit_payer_details", {
        _id: req.id, _payer_name: name, _payer_bank: bankName, _paid_amount: amt, _paid_on: paidOn,
      });
      if (e2) throw e2;
      navigate({ to: "/payment/$ref", params: { ref: req.ref } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function uploadProof(p: Payment, file: File) {
    setBusy(true);
    setErr(null);
    try {
      const path = `${user!.id}/${p.ref}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("payment-proofs").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("attach_payment_proof", { _id: p.id, _path: path });
      if (error) throw error;
      await loadPayments(user!.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const bank = settings && [
    ["Account holder", settings.bank_account_holder],
    ["Bank", settings.bank_name],
    ["Account number", settings.bank_account_number],
    ["Branch code", settings.bank_branch_code],
    ["Account type", settings.bank_account_type],
  ];
  // Payments stay paused until the owner has configured every bank field.
  const bankReady = !!settings && !!bank?.every(([, v]) => typeof v === "string" && v.trim().length > 0);

  if (!bankReady) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground">
        <div className="mx-auto max-w-lg space-y-4">
          <Link to="/" className="text-xs text-muted-foreground">← Back to app</Link>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="font-display text-xl font-semibold">Upgrade to Pro</h1>
          </div>
          <section className="rounded-2xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-1 font-semibold">Payments are temporarily paused</h2>
            <p className="text-muted-foreground">
              EFT payments are not open yet. Please check back soon — no payment is needed right now.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/" className="text-xs text-muted-foreground">← Back to app</Link>
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-semibold">Upgrade to Pro</h1>
        </div>
        <ul className="space-y-1 text-sm text-foreground/85">
          {["Unlimited translations", "Unlimited photo translations", "Conference rooms", "Learning Mode"].map((f) => (
            <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {f}</li>
          ))}
        </ul>

        <div className="grid grid-cols-3 gap-2">
          {plans.map((p) => (
            <button
              key={p.m}
              onClick={() => setMonths(p.m)}
              className={cn(
                "rounded-xl border p-3 text-center",
                months === p.m ? "border-primary bg-primary/15" : "border-border bg-card",
              )}
            >
              <div className="text-xs text-muted-foreground">{p.label}</div>
              <div className="mt-1 text-lg font-semibold">R{p.price}</div>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Pay by EFT</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {bank?.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Pay R{due ?? "…"} into the account above, then fill in your payment details below. You'll get a unique reference (ND-0001 style) — add it to your EFT or send it with your proof.
          </p>
          {settings?.whatsapp_number && (
            <p className="mt-2 text-xs">
              Questions? WhatsApp{" "}
              <a className="text-primary underline" href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                {settings.whatsapp_number}
              </a>
            </p>
          )}
        </section>

        <form onSubmit={paid} className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">Confirm your payment</h2>
          {([
            ["Account holder name (who paid)", payerName, setPayerName, "text", "e.g. J. Smith", 120],
            ["Your bank", payerBank, setPayerBank, "text", "e.g. Capitec, FNB, Absa", 80],
          ] as const).map(([label, val, set, type, ph, max]) => (
            <label key={label} className="block">
              <span className="text-xs text-muted-foreground">{label}</span>
              <input type={type} value={val} maxLength={max} placeholder={ph} required
                onChange={(e) => set(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Amount paid (R)</span>
              <input type="number" min="1" step="0.01" value={paidAmount} placeholder={String(due ?? "")}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Date paid</span>
              <input type="date" value={paidOn} required onChange={(e) => setPaidOn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
            </label>
          </div>
          <button type="submit" disabled={busy || !settings}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} I've paid — confirm payment
          </button>
          {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        </form>

        {payments.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-1 font-semibold">Your payment requests</h2>
            <p className="mb-3 text-xs text-muted-foreground">Activated within a few hours after we confirm your payment.</p>
            <ul className="space-y-3">
              {payments.map((p) => (
                <li key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Link to="/payment/$ref" params={{ ref: p.ref }} className="font-mono text-base font-semibold text-primary underline">{p.ref}</Link>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs capitalize",
                        p.status === "approved" ? "bg-primary/20 text-primary" : p.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-secondary text-foreground",
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.plan_months} month{p.plan_months > 1 ? "s" : ""} · R{p.amount} · {new Date(p.created_at).toLocaleDateString()}
                  </div>
                  {p.status === "pending" && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary">
                      <Upload className="h-3.5 w-3.5" />
                      {p.proof_path ? "Proof uploaded — replace" : "Upload proof of payment (optional)"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadProof(p, e.target.files[0])}
                      />
                    </label>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link to="/privacy" className="block text-center text-xs text-muted-foreground">Privacy (POPIA)</Link>
      </div>
    </main>
  );
}
