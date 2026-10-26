import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { adminDeleteUser } from "@/lib/admin.functions";
import { useAuth, signOut } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/components/AuthScreen";
import type { Tables } from "@/integrations/supabase/types";
import { StudioUsage } from "@/components/StudioUsage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Neural Duplex Lite" },
      { name: "description", content: "Manage payments, users, subscriptions and settings." },
      { property: "og:title", content: "Admin dashboard — Neural Duplex Lite" },
      { property: "og:description", content: "Admin tools for Neural Duplex Lite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Pending Payments", "Users", "Subscriptions", "Settings", "Stats", "Studio usage"] as const;
type Tab = (typeof TABS)[number];

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  pro_expires_at: string | null;
  suspended: boolean;
  is_admin: boolean;
};

const btn = "rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50";
const btnPrimary = "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50";
const isActivePro = (u: UserRow) => u.plan === "pro" && !!u.pro_expires_at && new Date(u.pro_expires_at) > new Date();

function AdminPage() {
  const { user, loading, access } = useAuth();
  const [tab, setTab] = useState<Tab>("Pending Payments");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<Tables<"payment_requests">[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, s, r, pay] = await Promise.all([
      supabase.from("profiles").select("id, email, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id, plan, pro_expires_at, suspended"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
    ]);
    const err = p.error || s.error || r.error || pay.error;
    if (err) return setErr(err.message);
    const subMap = new Map((s.data ?? []).map((x) => [x.user_id, x]));
    const admins = new Set((r.data ?? []).filter((x) => x.role === "admin").map((x) => x.user_id));
    setUsers(
      (p.data ?? []).map((x) => ({
        id: x.id,
        email: x.email,
        created_at: x.created_at,
        plan: subMap.get(x.id)?.plan ?? "free",
        pro_expires_at: subMap.get(x.id)?.pro_expires_at ?? null,
        suspended: subMap.get(x.id)?.suspended ?? false,
        is_admin: admins.has(x.id),
      })),
    );
    setPayments(pay.data ?? []);
  }, []);

  useEffect(() => {
    if (access.isAdmin) load();
  }, [access.isAdmin, load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null } | void>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fn();
      if (res && res.error) throw new Error(res.error.message);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <AuthScreen />;
  if (!access.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Admins only</h1>
          <Link to="/" className={cn(btn, "mt-4 inline-flex items-center gap-1")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Go home
          </Link>
        </div>
      </main>
    );
  }

  const emailOf = (id: string) => users.find((u) => u.id === id)?.email ?? id.slice(0, 8);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-base font-semibold">Admin</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/" className={btn}>Back to app</Link>
          <button onClick={() => signOut()} className={btn}>Sign out</button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
              tab === t ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary",
            )}
          >
            {t}
            {t === "Pending Payments" && ` (${payments.filter((p) => p.status === "pending").length})`}
          </button>
        ))}
      </nav>
      <div className="p-4">
        {err && <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">{err}</p>}
        {tab === "Pending Payments" && <Payments payments={payments} emailOf={emailOf} busy={busy} run={run} />}
        {tab === "Users" && <Users users={users} busy={busy} run={run} selfId={user.id} />}
        {tab === "Subscriptions" && <Subs users={users} busy={busy} run={run} />}
        {tab === "Settings" && <Settings />}
        {tab === "Stats" && <Stats />}
        {tab === "Studio usage" && <StudioUsage emailOf={emailOf} />}
      </div>
    </main>
  );
}

type Run = (fn: () => PromiseLike<{ error: { message: string } | null } | void>) => Promise<void>;

function Payments({ payments, emailOf, busy, run }: { payments: Tables<"payment_requests">[]; emailOf: (id: string) => string; busy: boolean; run: Run }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? payments : payments.filter((p) => p.status === "pending");
  const openProof = async (path: string) => {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all payments
      </label>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
      {list.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono font-semibold">{p.ref}</span>
            <span className="text-xs capitalize text-muted-foreground">{p.status}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {emailOf(p.user_id)} · {p.plan_months} mo · R{p.amount} · {new Date(p.created_at).toLocaleString()}
          </div>
          {p.payer_name ? (
            <div className="mt-1 text-xs">
              Paid by <strong>{p.payer_name}</strong> ({p.payer_bank}) · R{p.paid_amount} on {p.paid_on}
              {p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount) && (
                <span className="ml-1 text-destructive">· amount differs</span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">No payer details given</div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {p.proof_path ? (
              <button className={btn} onClick={() => openProof(p.proof_path!)}>View proof</button>
            ) : (
              <span className="text-xs text-muted-foreground">No proof uploaded</span>
            )}
            {p.status === "pending" && (
              <>
                <button disabled={busy} className={btnPrimary} onClick={() => run(() => supabase.rpc("review_payment", { _id: p.id, _approve: true }))}>Approve</button>
                <button disabled={busy} className={btn} onClick={() => run(() => supabase.rpc("review_payment", { _id: p.id, _approve: false }))}>Reject</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const setSub = (userId: string, patch: Record<string, unknown>) =>
  supabase.from("subscriptions").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

const extend = (u: UserRow, months: number) => {
  const base = isActivePro(u) ? new Date(u.pro_expires_at!) : new Date();
  base.setMonth(base.getMonth() + months);
  return setSub(u.id, { plan: "pro", pro_expires_at: base.toISOString() });
};

function Users({ users, busy, run, selfId }: { users: UserRow[]; busy: boolean; run: Run; selfId: string }) {
  const [q, setQ] = useState("");
  const del = useServerFn(adminDeleteUser);
  const list = useMemo(() => users.filter((u) => u.email.toLowerCase().includes(q.toLowerCase())), [users, q]);
  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by email"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      {list.map((u) => (
        <div key={u.id} className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="font-medium">{u.email}</div>
          <div className="text-xs text-muted-foreground">
            {u.is_admin ? "Admin · " : ""}
            {isActivePro(u) ? `Pro until ${new Date(u.pro_expires_at!).toLocaleDateString()}` : "Free"}
            {u.suspended ? " · Suspended" : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isActivePro(u) ? (
              <button disabled={busy} className={btn} onClick={() => run(() => setSub(u.id, { plan: "free", pro_expires_at: null }))}>Remove Pro</button>
            ) : (
              <button disabled={busy} className={btnPrimary} onClick={() => run(() => extend(u, 1))}>Grant Pro (1 mo)</button>
            )}
            {!u.is_admin ? (
              <button disabled={busy} className={btn} onClick={() => run(() => supabase.from("user_roles").insert({ user_id: u.id, role: "admin" }))}>Make admin</button>
            ) : u.id !== selfId && u.email !== "gerswilledavids@gmail.com" ? (
              <button disabled={busy} className={btn} onClick={() => run(() => supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin"))}>Remove admin</button>
            ) : null}
            <button disabled={busy} className={btn} onClick={() => run(() => setSub(u.id, { suspended: !u.suspended }))}>
              {u.suspended ? "Unsuspend" : "Suspend"}
            </button>
            {u.id !== selfId && (
              <button
                disabled={busy}
                className={cn(btn, "text-destructive")}
                onClick={() => confirm(`Delete ${u.email} permanently?`) && run(() => del({ data: { userId: u.id } }).then(() => undefined))}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Subs({ users, busy, run }: { users: UserRow[]; busy: boolean; run: Run }) {
  const pro = users.filter((u) => u.plan === "pro");
  if (pro.length === 0) return <p className="text-sm text-muted-foreground">No subscriptions yet.</p>;
  return (
    <div className="space-y-2">
      {pro.map((u) => (
        <div key={u.id} className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="font-medium">{u.email}</div>
          <div className="text-xs text-muted-foreground">
            {isActivePro(u) ? "Active" : "Expired"} · expires {u.pro_expires_at ? new Date(u.pro_expires_at).toLocaleDateString() : "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 3, 12].map((m) => (
              <button key={m} disabled={busy} className={btn} onClick={() => run(() => extend(u, m))}>+{m} mo</button>
            ))}
            <button disabled={busy} className={cn(btn, "text-destructive")} onClick={() => run(() => setSub(u.id, { plan: "free", pro_expires_at: null }))}>Cancel</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Settings() {
  const [s, setS] = useState<Tables<"app_settings"> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data));
  }, []);
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const fields: [keyof Tables<"app_settings">, string, "number" | "text"][] = [
    ["price_1m", "Price — 1 month (R)", "number"],
    ["price_3m", "Price — 3 months (R)", "number"],
    ["price_12m", "Price — 12 months (R)", "number"],
    ["free_translations_per_day", "Free translations / day", "number"],
    ["free_photos_per_day", "Free photos / day", "number"],
    ["bank_account_holder", "Account holder", "text"],
    ["bank_name", "Bank", "text"],
    ["bank_account_number", "Account number", "text"],
    ["bank_branch_code", "Branch code", "text"],
    ["bank_account_type", "Account type", "text"],
    ["whatsapp_number", "WhatsApp number", "text"],
  ];
  const save = async () => {
    const { id: _id, updated_at: _u, ...rest } = s;
    const { error } = await supabase.from("app_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    setMsg(error ? error.message : "Saved");
  };
  return (
    <div className="max-w-md space-y-3">
      {fields.map(([k, label, type]) => (
        <label key={k} className="block text-xs text-muted-foreground">
          {label}
          <input
            type={type}
            value={String(s[k] ?? "")}
            onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
      ))}
      <button onClick={save} className={btnPrimary}>Save settings</button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

type StatsData = {
  total_users: number;
  pro_users: number;
  pending_payments: number;
  translations_today: number;
  photos_today: number;
  revenue_by_month: { month: string; total: number }[];
};

function Stats() {
  const [d, setD] = useState<StatsData | null>(null);
  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data }) => setD(data as unknown as StatsData));
  }, []);
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const cards = [
    ["Total users", d.total_users],
    ["Pro users", d.pro_users],
    ["Pending payments", d.pending_payments],
    ["Translations today", d.translations_today],
    ["Photos today", d.photos_today],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="mt-1 text-xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-3 text-sm">
        <h2 className="mb-2 font-semibold">Revenue by month</h2>
        {d.revenue_by_month.length === 0 ? (
          <p className="text-muted-foreground">No approved payments yet.</p>
        ) : (
          d.revenue_by_month.map((r) => (
            <div key={r.month} className="flex justify-between border-t border-border py-1.5 first:border-0">
              <span>{r.month}</span>
              <span className="font-medium">R{r.total}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
