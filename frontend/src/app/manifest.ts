import type { MetadataRoute } from "next";

import { site } from "@/shared/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DavoRescue — Emergency reporting",
    short_name: "DavoRescue",
    description: site.tagline,
    start_url: "/report?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf7",
    theme_color: "#16181d",
    lang: "en-NG",
    categories: ["utilities", "navigation", "news"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Report an emergency", short_name: "Report", url: "/report", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Live incident map", short_name: "Live map", url: "/live", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
