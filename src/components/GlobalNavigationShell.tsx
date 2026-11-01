import type { ReactNode } from "react";
import { Home, MessageCircle, PlaySquare, Sparkles, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stage 1 global navigation shell.
 * Only "Home" is a working destination; the other items are placeholders for
 * later stages and are rendered disabled — they never navigate anywhere.
 */
type NavItem = { key: string; label: string; icon: LucideIcon; available: boolean };

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home, available: true },
  { key: "videos", label: "Videos", icon: PlaySquare, available: false },
  { key: "messages", label: "Messages", icon: MessageCircle, available: false },
  { key: "communities", label: "Communities", icon: Users, available: false },
  { key: "profile", label: "Profile", icon: UserRound, available: false },
];

function onHome() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function GlobalNavigationShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop: persistent left side navigation */}
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card/60 backdrop-blur md:flex"
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
            }}
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-sm font-semibold leading-tight">
            Neural Duplex <span className="text-muted-foreground">Lite</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.available;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.available ? onHome : undefined}
                disabled={!item.available}
                aria-current={active ? "page" : undefined}
                title={item.available ? item.label : `${item.label} — coming in a later stage`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "cursor-not-allowed text-muted-foreground opacity-70",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {!item.available && (
                  <span className="rounded-full border border-accent/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <p className="px-4 pb-4 text-[11px] leading-snug text-muted-foreground">
          Videos, Messages, Communities and Profile are coming in later updates.
        </p>
      </aside>

      {/* Content: offset for side nav on desktop, bottom tab bar on mobile */}
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-56">{children}</div>

      {/* Mobile: fixed bottom tab bar */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.available;
            return (
              <li key={item.key} className="flex">
                <button
                  type="button"
                  onClick={item.available ? onHome : undefined}
                  disabled={!item.available}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.available ? item.label : `${item.label}, coming soon`}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-medium tracking-tight",
                    active ? "text-primary" : "cursor-not-allowed text-muted-foreground opacity-70",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="min-w-0 max-w-full truncate px-0 text-[9px] leading-none">{item.label}</span>
                  {!item.available && (
                    <span className="text-[8px] font-semibold uppercase leading-none tracking-wide text-accent">
                      Soon
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
