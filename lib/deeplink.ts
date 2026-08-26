/**
 * Cómo se abre un enlace que SALE de la app: ¿ventana nueva o el propio marco?
 *
 * Vive aparte y sin ningún `import` para poder probarse entera sin navegador
 * (`tests/deeplink.test.mjs`), igual que `lib/gasChoice.ts`. Cualquier import
 * relativo aquí rompería esas pruebas, que cargan este archivo directamente.
 *
 * ⚠️ **Dentro de MiniPay no se pide ventana nueva.** El WebView de Android sin
 * `setSupportMultipleWindows` no puede abrirla, y algunas versiones responden
 * pintando una página de error en vez de no hacer nada. No es teoría: a
 * Freaking Grammar (`nerdos.fun`, ya publicada en MiniPay) un revisor de
 * MiniPay le reportó exactamente eso con su enlace de soporte, y su
 * `NeedFundsModal` abre el deeplink `link.minipay.xyz/add_cash` sin `target`
 * mientras reserva `_blank` para los enlaces externos de fuera de MiniPay.
 *
 * Fuera de MiniPay se conserva el comportamiento de siempre: `_blank` con
 * `rel="noopener noreferrer"`, para no perder la partida a medio hacer al
 * saltar a otro sitio.
 */

/**
 * Deeplink de MiniPay para depositar saldo (USDT / USDC / USDm).
 * Docs: https://docs.minipay.xyz/technical-references/deeplinks.html
 *
 * Vive aquí, junto a la regla que decide cómo abrirlo, para que las pruebas
 * puedan comprobar las dos cosas a la vez sin cargar React ni wagmi.
 * `lib/minipay.ts` lo reexporta, así que los sitios que ya lo importaban de
 * allí siguen igual. Nunca lleva CELO: MiniPay se lo oculta al usuario.
 */
export const MINIPAY_ADD_CASH =
  "https://link.minipay.xyz/add_cash?tokens=USDT,USDC,USDm";

/** Atributos de `<a>` para un destino externo. Vacío = navega el propio marco. */
export interface OutboundLinkProps {
  target?: "_blank";
  rel?: string;
}

/**
 * Los atributos que le tocan a un enlace de salida.
 *
 * `inMiniPay` se pasa YA resuelto (`useIsMiniPay()`): esta función no mira
 * `window`, que es justo lo que la hace probable.
 */
export function outboundLinkProps(inMiniPay: boolean): OutboundLinkProps {
  if (inMiniPay) return {};
  return { target: "_blank", rel: "noopener noreferrer" };
}
