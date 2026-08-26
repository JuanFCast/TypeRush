import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/site";

/** Términos y privacidad no cambian a diario: decir que sí sería mentirle al
 *  rastreador y gastarle visitas en dos páginas que llevan meses iguales. */
const LEGAL_ROUTES: readonly string[] = ["/terminos", "/privacidad"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => {
    const legal = LEGAL_ROUTES.includes(route);
    return {
      url: absoluteUrl(route),
      lastModified: now,
      // Jugar es la portada y cambia cada día (pozo y ronda); historial y
      // perfil dependen de rondas que cierran una vez al día.
      changeFrequency: legal ? "yearly" : "daily",
      priority: route === "/" ? 1 : legal ? 0.3 : 0.7,
    };
  });
}
