import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy (POPIA) — Neural Duplex Lite" },
      { name: "description", content: "How Neural Duplex Lite handles your voice, photos and personal information under POPIA." },
      { property: "og:title", content: "Privacy (POPIA) — Neural Duplex Lite" },
      { property: "og:description", content: "How we process voice and photos to translate, and what we keep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-foreground/85">
        <Link to="/" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="font-display text-2xl font-semibold text-foreground">Privacy notice (POPIA)</h1>
        <p>Neural Duplex Lite respects your privacy and processes personal information in line with the Protection of Personal Information Act (POPIA).</p>
        <h2 className="font-semibold text-foreground">Voice and photos</h2>
        <p>Your voice and photos are processed only to transcribe and translate them. They are sent securely to our AI translation provider and are not stored by us beyond what is needed to deliver the translation.</p>
        <h2 className="font-semibold text-foreground">What we keep</h2>
        <p>Your email and name, your plan and expiry date, daily usage counts, payment requests and any proof of payment you upload. Conference room messages are stored so participants can see them. Proof of payment is private: only you and our admins can view it.</p>
        <h2 className="font-semibold text-foreground">Your rights</h2>
        <p>You may ask to see, correct or delete your personal information at any time. Contact us via the WhatsApp number on the Upgrade page.</p>
      </article>
    </main>
  );
}
