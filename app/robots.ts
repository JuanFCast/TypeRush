import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * `/api` fuera del índice: son endpoints, no páginas, y varios responden
 * distinto según la sesión. El sitemap apunta al dominio oficial, no al de
 * Vercel, aunque la app se sirva desde los dos durante la migración.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
