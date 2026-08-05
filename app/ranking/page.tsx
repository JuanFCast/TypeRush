import type { Metadata } from "next";
import FullRanking from "@/components/FullRanking";
import type { ModeId } from "@/lib/passages";

export const metadata: Metadata = {
  title: "Ranking · TypeRush",
};

/**
 * Ranking completo de la ronda en curso.
 *
 * La modalidad llega por la URL (`/ranking?mode=es`) y se lee aquí, en el
 * servidor, en vez de con `useSearchParams`: así no hace falta envolver la
 * página en un Suspense solo para leer un parámetro.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode: ModeId | null =
    mode === "es" || mode === "en" ? mode : null;

  return <FullRanking initialMode={initialMode} />;
}
