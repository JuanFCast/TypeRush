import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { getServerLang, getServerT } from "@/lib/i18n/server";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: absoluteUrl("/"),
      images: [{ url: "/icon.png", width: 512, height: 512, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/icon.png"],
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
      className={`notranslate ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
