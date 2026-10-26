import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/PublicWebsite";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "Questions & Answers — Neural Duplex Lite" },
    { name: "description", content: "Answers about supported languages, voice and text translation, sharing audio, AI music, EFT payments, privacy and device compatibility." },
    { property: "og:title", content: "Questions & Answers — Neural Duplex Lite" },
    { property: "og:description", content: "Learn how Neural Duplex Lite works, what you can share, and how to upgrade." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <PublicWebsite view="faq" />,
});