import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/PublicWebsite";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Free & Pro Plans — Neural Duplex Lite" },
    { name: "description", content: "Compare daily free translations with Pro unlimited translation, conference rooms and Learning Mode. Upgrade by direct EFT." },
    { property: "og:title", content: "Free & Pro Plans — Neural Duplex Lite" },
    { property: "og:description", content: "Start free, or choose a 1, 3 or 12 month Pro plan with direct EFT payment." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <PublicWebsite view="pricing" />,
});