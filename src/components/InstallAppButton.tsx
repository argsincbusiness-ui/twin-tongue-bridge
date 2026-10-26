import { useEffect, useState } from "react";
import { Download, Share, Plus, MoreVertical, X, QrCode } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type Platform = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (ua.includes("mac") && "ontouchend" in document)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installUrl, setInstallUrl] = useState("");

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setInstallUrl(typeof window !== "undefined" ? window.location.origin : "");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const nativeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (deferredPrompt ? nativeInstall() : setOpen(true))}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform active:scale-95",
        )}
        style={{
          background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
        }}
        aria-label="Install app on your phone"
      >
        <Download className="h-3.5 w-3.5" />
        Install App
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel-surface w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Install Neural Duplex</h2>
                <p className="text-xs text-muted-foreground">
                  {platform === "ios"
                    ? "iPhone / iPad — Safari"
                    : platform === "android"
                      ? "Android — Chrome"
                      : "Desktop browser"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-secondary/60 hover:bg-secondary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex flex-col items-center gap-2.5 rounded-xl bg-secondary/30 p-4">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG
                  value={installUrl || "https://voice-nexus-lite.lovable.app"}
                  size={172}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0b0f1a"
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground/90">
                  Scan with your phone camera
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Opens the app so you can install it
                </p>
              </div>
              {installUrl && (
                <p className="max-w-full break-all rounded-md bg-background/60 px-2 py-1 text-center font-mono text-[10px] text-muted-foreground/70">
                  {installUrl}
                </p>
              )}
            </div>

            {platform === "ios" && (
              <ol className="space-y-3 text-sm">
                <Step n={1}>
                  Tap the <Share className="mx-1 inline h-4 w-4" /> <b>Share</b> button in Safari's
                  toolbar.
                </Step>
                <Step n={2}>
                  Scroll and tap <Plus className="mx-1 inline h-4 w-4" />{" "}
                  <b>Add to Home Screen</b>.
                </Step>
                <Step n={3}>
                  Tap <b>Add</b> — the app appears on your home screen.
                </Step>
              </ol>
            )}

            {platform === "android" && (
              <ol className="space-y-3 text-sm">
                <Step n={1}>
                  Tap the <MoreVertical className="mx-1 inline h-4 w-4" /> menu (top right in
                  Chrome).
                </Step>
                <Step n={2}>
                  Tap <b>Install app</b> or <b>Add to Home screen</b>.
                </Step>
                <Step n={3}>
                  Confirm <b>Install</b> — launches full-screen like a native app.
                </Step>
              </ol>
            )}

            {platform === "desktop" && (
              <ol className="space-y-3 text-sm">
                <Step n={1}>
                  Open this site on your phone: use the browser's share menu or scan a QR of this
                  URL.
                </Step>
                <Step n={2}>
                  On iPhone use Safari → Share → Add to Home Screen. On Android use Chrome → menu →
                  Install app.
                </Step>
              </ol>
            )}

            <p className="mt-4 rounded-lg bg-secondary/40 p-2.5 text-[11px] text-muted-foreground">
              Works offline-friendly, full-screen, and appears with its own icon.
            </p>
            <Link
              to="/install"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary"
            >
              <QrCode className="h-3.5 w-3.5" />
              Open full-page QR
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-primary-foreground"
        style={{
          background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
        }}
      >
        {n}
      </span>
      <span className="pt-0.5 text-foreground/90">{children}</span>
    </li>
  );
}
