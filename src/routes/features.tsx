import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/PublicWebsite";

export const Route = createFileRoute("/features")({
  head: () => ({ meta: [
    { title: "Features — Neural Duplex Lite" },
    { name: "description", content: "Explore voice and typed translation, photo translation, conference rooms, Learning Mode, AI songs and the instrument studio." },
    { property: "og:title", content: "Features — Neural Duplex Lite" },
    { property: "og:description", content: "Speak, type, translate photos, connect in rooms, learn languages and create music in one app." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <PublicWebsite view="features" />,
});