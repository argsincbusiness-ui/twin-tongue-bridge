import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ConsentDetails = {
  authorization_id: string;
  client?: { name?: string; uri?: string; logo_uri?: string };
  redirect_uri?: string;
  scope?: string;
};

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>): { authorization_id?: string } => ({
    authorization_id:
      typeof search.authorization_id === "string" ? search.authorization_id : undefined,
  }),
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const { user, loading } = useAuth();
  const { authorization_id: authorizationId } = Route.useSearch();
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !authorizationId) return;
    let cancelled = false;
    (async () => {
      const { data, error: requestError } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (requestError) {
        setError(requestError.message);
        return;
      }
      if ("redirect_url" in data) {
        window.location.replace(data.redirect_url);
        return;
      }
      setDetails(data as ConsentDetails);
    })().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load authorization request.");
    });
    return () => {
      cancelled = true;
    };
  }, [user, authorizationId]);

  async function decide(allow: boolean) {
    if (!authorizationId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = allow
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (result.error) throw result.error;
      if (result.data?.redirect_url) {
        window.location.assign(result.data.redirect_url);
      } else {
        setError("The authorization server did not return a redirect URL. Please restart the connection.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process your decision.");
      setBusy(false);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</main>;
  if (!user) return <AuthScreen />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Twin Tongue Bridge</p>
          <h1 className="mt-2 text-2xl font-semibold">Authorize ChatGPT</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the application requesting access to your Twin Tongue Bridge account. You can deny access at any time.
          </p>
        </div>
        {!authorizationId && <p role="alert" className="text-sm text-destructive">Missing authorization request. Please restart the connection from ChatGPT.</p>}
        {authorizationId && !details && !error && <p className="text-sm text-muted-foreground">Loading authorization details…</p>}
        {details && (
          <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
            <div><span className="text-muted-foreground">Application</span><p className="font-semibold">{details.client?.name ?? "ChatGPT"}</p></div>
            <div><span className="text-muted-foreground">Requested permissions</span>
              <ul className="mt-1 list-inside list-disc">{(details.scope ?? "").split(" ").filter(Boolean).map((scope) => <li key={scope}>{scope}</li>)}</ul>
            </div>
            {details.redirect_uri && <p className="break-all text-xs text-muted-foreground">Redirect: {details.redirect_uri}</p>}
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={!details || busy} onClick={() => decide(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">Deny</button>
          <button type="button" disabled={!details || busy} onClick={() => decide(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Processing…" : "Allow access"}</button>
        </div>
      </section>
    </main>
  );
}
