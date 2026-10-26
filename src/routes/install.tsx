import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const PUBLISHED_URL = "https://voice-nexus-lite.lovable.app";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install Neural Duplex AI Lite — Scan to install" },
      {
        name: "description",
        content:
          "Scan the QR code with your phone camera to open and install Neural Duplex AI Lite.",
      },
      { property: "og:title", content: "Install Neural Duplex AI Lite" },
      {
        property: "og:description",
        content: "Scan the QR code to install Neural Duplex on your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallPage,
});

function InstallPage() {
  const [installUrl, setInstallUrl] = useState(PUBLISHED_URL);

  useEffect(() => {
    if (typeof window !== "undefined") setInstallUrl(window.location.origin);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, var(--color-speaker-a), var(--color-speaker-b))",
            }}
          >
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">
              Neural Duplex <span className="text-muted-foreground">Lite</span>
            </h1>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              Install on your phone
            </p>
          </div>
        </div>

        <div className="panel-surface flex flex-col items-center gap-4 p-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={installUrl}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#0b0f1a"
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/90">
              Scan with your phone camera
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Point your camera at the code to open the app, then choose
              “Add to Home Screen” or “Install app”.
            </p>
          </div>
          <p className="max-w-full break-all rounded-md bg-secondary/40 px-2.5 py-1.5 text-center font-mono text-[10px] text-muted-foreground/70">
            {installUrl}
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            search={{ open: true }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
