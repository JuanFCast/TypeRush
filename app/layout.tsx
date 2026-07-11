import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "TypeRush — carrera de mecanografía",
  description:
    "Escribe contra el reloj durante 45 segundos. Mide tu WPM, precisión y supera tu récord.",
  other: {
    "talentapp:project_verification":
      "f96cc2cd84974edeb9d010bfc1f7c14656b39cb6ab4adf7ea4a321c8537fdb227ede9f37e600c86c57527f91d8fdca3ca97679088e0fdf1f08233f0beaf63e11",
  },
};

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
