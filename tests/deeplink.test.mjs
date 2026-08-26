// Cómo se abre un enlace de salida dentro y fuera de MiniPay.
//
//   npm test
//
// Importa la decisión REAL (`outboundLinkProps` de `lib/deeplink.ts`), la misma
// que usa el enlace de depósito de `components/PlayV3Button.tsx`.
//
// El caso que motiva estas pruebas: el WebView de Android de MiniPay, sin
// `setSupportMultipleWindows`, no puede abrir ventana nueva y hay versiones que
// pintan una PÁGINA DE ERROR en vez de no hacer nada. A Freaking Grammar
// (`nerdos.fun`, publicada en MiniPay) se lo reportó un revisor de MiniPay con
// su enlace de soporte; su `NeedFundsModal` abre el deeplink
// `link.minipay.xyz/add_cash` sin `target` y reserva `_blank` para los enlaces
// externos de fuera de MiniPay.
//
// En TypeRush ese enlace aparece justo cuando alguien NO puede jugar por saldo,
// así que llevarlo a una página de error es el peor final posible.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outboundLinkProps, MINIPAY_ADD_CASH } from "../lib/deeplink.ts";

// ── Dentro de MiniPay ─────────────────────────────────────────────────────

test("dentro de MiniPay no se pide ventana nueva", () => {
  const props = outboundLinkProps(true);
  assert.equal(props.target, undefined);
});

test("dentro de MiniPay tampoco se cuela un rel de ventana nueva", () => {
  const props = outboundLinkProps(true);
  assert.equal(props.rel, undefined);
});

test("dentro de MiniPay no se emite NINGÚN atributo", () => {
  // Que el objeto esté vacío importa: se esparce con {...} sobre el <a>, y una
  // clave con `undefined` seguiría siendo una clave — React no la pinta, pero
  // devolver {} deja explícito que aquí no hay nada que decidir.
  assert.deepEqual(outboundLinkProps(true), {});
});

// ── Fuera de MiniPay ──────────────────────────────────────────────────────

test("fuera de MiniPay se conserva la pestaña nueva de siempre", () => {
  const props = outboundLinkProps(false);
  assert.equal(props.target, "_blank");
});

test("fuera de MiniPay la pestaña nueva va con rel seguro", () => {
  // Sin `noopener` la página abierta puede manipular la nuestra vía
  // `window.opener`. Si se conserva `_blank`, se conserva su protección.
  const props = outboundLinkProps(false);
  assert.equal(props.rel, "noopener noreferrer");
});

// ── El destino ────────────────────────────────────────────────────────────

test("el destino sigue siendo el deeplink oficial de MiniPay", () => {
  // Si alguien cambia esta constante por una URL de web normal, el criterio de
  // arriba deja de tener sentido: lo que justifica no abrir ventana nueva es
  // que el destino lo entiende la propia MiniPay.
  assert.ok(
    MINIPAY_ADD_CASH.startsWith("https://link.minipay.xyz/add_cash"),
    `destino inesperado: ${MINIPAY_ADD_CASH}`,
  );
});

test("el deeplink pide solo stablecoins admitidas, nunca CELO", () => {
  // MiniPay oculta CELO al usuario y paga las comisiones por abstracción; pedir
  // CELO en la pantalla de depósito contradice sus propias reglas de listado.
  assert.ok(!/CELO/i.test(MINIPAY_ADD_CASH), MINIPAY_ADD_CASH);
});

// ── El cableado en el botón de jugar ──────────────────────────────────────
//
// Las pruebas de arriba comprueban la REGLA; esta comprueba que el botón la
// usa. Se lee el archivo en vez de renderizarlo porque montar `PlayV3Button`
// exige wagmi, Privy y un proveedor de i18n — toda esa maquinaria para mirar un
// atributo. Lo que hay que impedir es que alguien vuelva a escribir
// `target="_blank"` a mano ahí, que es exactamente lo que había antes.

const PLAY_BUTTON = readFileSync(
  new URL("../components/PlayV3Button.tsx", import.meta.url),
  "utf8",
);

test("el botón de jugar no fija target=_blank a mano", () => {
  assert.ok(
    !/target=["']_blank["']/.test(PLAY_BUTTON),
    "PlayV3Button volvió a fijar target=\"_blank\": dentro de MiniPay eso puede acabar en una página de error",
  );
});

test("el enlace de depósito decide con outboundLinkProps", () => {
  assert.ok(
    /\{\.\.\.outboundLinkProps\(inMiniPay\)\}/.test(PLAY_BUTTON),
    "el enlace de depósito ya no usa outboundLinkProps(inMiniPay)",
  );
});
