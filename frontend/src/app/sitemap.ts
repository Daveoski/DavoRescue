import type { MetadataRoute } from "next";

import { checkedOn } from "@/domains/agencies/data";
import { site, states } from "@/shared/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const directoryUpdated = new Date(checkedOn);
  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/report", priority: 0.9, changeFrequency: "monthly" },
    { path: "/live", priority: 0.8, changeFrequency: "always" },
    { path: "/roads", priority: 0.8, changeFrequency: "daily" },
    { path: "/checkin", priority: 0.7, changeFrequency: "monthly" },
    { path: "/trip", priority: 0.6, changeFrequency: "monthly" },
    { path: "/directory", priority: 0.9, changeFrequency: "weekly" },
    { path: "/safety", priority: 0.7, changeFrequency: "monthly" },
    { path: "/download", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/signup", priority: 0.4, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];

  return [
    ...pages.map((p) => ({ url: `${site.url}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...states.map((s) => ({
      url: `${site.url}/directory/${s.slug}`,
      lastModified: directoryUpdated,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
