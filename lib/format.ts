/**
 * Formato compartido de montos guardados como BigInt-en-texto (unidades
 * crudas del token, nunca un float). Antes vivía sin exportar dentro de
 * `app/perfil/page.tsx`; se movió aquí porque ahora lo comparten varios
 * componentes de `components/profile/` — una sola regla de formato para toda
 * la página, no una copia por archivo.
 */
export function fmtUnits(units: string, decimals: number, locale: string): string {
  try {
    const value = Number(BigInt(units)) / 10 ** decimals;
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals === 6 ? 2 : 0,
      maximumFractionDigits: decimals === 6 ? 2 : 0,
    });
  } catch {
    return "0";
  }
}
