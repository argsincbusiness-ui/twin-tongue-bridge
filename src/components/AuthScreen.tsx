import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg("Account created. Check your email to verify, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
            }}
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold leading-tight">
              Neural Duplex <span className="text-muted-foreground">Lite</span>
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {mode === "signup" ? "Create account" : "Sign in"}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {err && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {err}
            </p>
          )}
          {msg && (
            <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Create an account
              </button>
              . Start with daily free translations.
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
        <div className="mt-5 text-center"><Button asChild variant="link" size="sm"><Link to="/" search={{}}>Back to website</Link></Button></div>
      </div>
    </main>
  );
}
