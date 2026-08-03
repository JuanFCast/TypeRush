import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — carreras de mecanografía con premios en Celo`,
    short_name: SITE_NAME,
    description:
      "Escribe contra el reloj 45 segundos. El #1 del día se lleva el pozo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f3",
    theme_color: "#00d18f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
