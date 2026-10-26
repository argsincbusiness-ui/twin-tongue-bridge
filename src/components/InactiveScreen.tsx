import { Link } from "@tanstack/react-router";
import { signOut, type AccessInfo } from "@/hooks/useAuth";

export function InactiveScreen({
  email,
  access,
}: {
  email: string;
  access: AccessInfo;
}) {
  const trialExpired =
    access.status === "trial" &&
    access.trialEndsAt &&
    new Date(access.trialEndsAt) <= new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="font-display text-lg font-semibold">
          {trialExpired ? "Your free trial has ended" : "Subscription required"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access to Neural Duplex is <strong>R100 / month</strong>. Once your payment
          is received, an administrator will activate your account.
        </p>

        <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-left text-xs text-muted-foreground">
          <div>
            Signed in as <span className="text-foreground">{email}</span>
          </div>
          <div className="mt-1">
            Status:{" "}
            <span className="text-foreground">{access.status ?? "unknown"}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          To arrange payment, please contact the administrator at{" "}
          <a
            href="mailto:Gerswilledavids@gmail.com"
            className="text-foreground underline"
          >
            Gerswilledavids@gmail.com
          </a>
          .
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            Sign out
          </button>
          <Link
            to="/"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Refresh
          </Link>
        </div>
      </div>
    </main>
  );
}
