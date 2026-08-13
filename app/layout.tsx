import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { getServerLang, getServerT } from "@/lib/i18n/server";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

// Sora es la tipografía de identidad e interfaz (su geometría acompaña los
// ángulos del rayo). El 800 es el del wordmark; JetBrains Mono NO es tipografía
// de marca: se limita al pasaje de la carrera y a los datos numéricos.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    // `metadataBase` es lo que convierte cada ruta relativa (og:image,
    // canonical…) en absoluta sobre el dominio OFICIAL. Sin esto, Next las
    // resuelve contra el host que sirvió la petición y una visita por la URL
    // de Vercel generaría tarjetas apuntando a *.vercel.app.
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    // Sin `images:` aquí a propósito: `app/opengraph-image.tsx` (y su espejo
    // `twitter-image.tsx`) generan la tarjeta y Next los descubre solos por
    // convención de archivo. Declarar `images` a mano competía con eso y
    // dejaba la tarjeta en el icono pelado en vez de la tarjeta con marca.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: absoluteUrl("/"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    other: {
      "talentapp:project_verification":
        "f96cc2cd84974edeb9d010bfc1f7c14656b39cb6ab4adf7ea4a321c8537fdb227ede9f37e600c86c57527f91d8fdca3ca97679088e0fdf1f08233f0beaf63e11",
    },
  };
}

// Sin maximum-scale: el zoom del usuario queda permitido (accesibilidad). El
// zoom automático de iOS al enfocar inputs se evita con fuentes ≥16px en ellos.
// viewport-fit=cover: la app pinta detrás del notch/home-bar y las safe areas
// se manejan con env(safe-area-inset-*) en el header y la navegación.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f5f3",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El idioma se resuelve en el SERVIDOR (cookie del jugador o el del
  // dispositivo), así que el HTML ya sale traducido y `lang` dice la verdad.
  const lang = await getServerLang();

  return (
    <html
      lang={lang}
      // translate="no": la app ya viene en los dos idiomas de su público, y la
      // traducción automática del navegador aquí no es una mejora sino un fallo
      // grave. Reescribe cada nodo de texto envolviéndolo en <font>, y el
      // siguiente render de React intenta quitar nodos que ya no son suyos →
      // "This page couldn't load" (lo que reportó el usuario, 2026-08-03).
      // Además traduciría el PASAJE que hay que teclear letra a letra, que se
      // puntúa contra el texto canónico del servidor: la partida sería
      // imposible de ganar aunque no reventara.
      translate="no"
      className={`notranslate ${sora.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
