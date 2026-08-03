import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    // Jugar es la portada y cambia cada día (pozo y ronda); las otras dos
    // dependen de rondas que cierran una vez al día.
    changeFrequency: route === "/" ? "daily" : "daily",
    priority: route === "/" ? 1 : 0.7,
  }));
}
