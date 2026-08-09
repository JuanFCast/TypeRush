// Pruebas E2E de idioma: navegador normal y simulación de MiniPay, es + en.
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// Simula el arranque de MiniPay: webview con window.ethereum.isMiniPay y, en el
// peor caso, sin cookies (que es lo que rompía la persistencia del idioma).
const MINIPAY_INIT = `
  // Proveedor EIP-1193 COMPLETO. Los conectores de wagmi se suscriben a eventos
  // nada más conectarse, así que un mock sin \`on\`/\`removeListener\` lanza
  // "walletProvider?.on is not a function" — un fallo de la simulación, no de la
  // app: MiniPay real sí los implementa, porque el estándar los exige.
  const listeners = {};
  const provider = {
    isMiniPay: true,
    request: async ({ method }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return ["0x1111111111111111111111111111111111111111"];
      }
      if (method === "eth_chainId") return "0xa4ec"; // 42220 (Celo)
      return null;
    },
    on: (event, handler) => {
      (listeners[event] ||= []).push(handler);
      return provider;
    },
    removeListener: (event, handler) => {
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler);
      return provider;
    },
  };
  Object.defineProperty(window, "ethereum", { value: provider, configurable: true });
`;
const BLOCK_COOKIES = `
  Object.defineProperty(document, "cookie", {
    get: () => "",
    set: () => {},
    configurable: true,
  });
`;

async function newPage(browser, { locale, minipay = false, blockCookies = false }) {
  const ctx = await browser.newContext({ locale, viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  if (minipay) await page.addInitScript(MINIPAY_INIT);
  if (blockCookies) await page.addInitScript(BLOCK_COOKIES);
  // El tutorial se abre solo la primera vez y taparía el lobby: se marca como
  // visto antes de cargar. Su apertura automática se prueba en nav.mjs.
  await page.addInitScript(() =>
    localStorage.setItem("typerush.howto.v1", "1"),
  );
  page.on("pageerror", (e) => check("sin errores de página", false, e.message.split("\n")[0]));
  return { ctx, page };
}

const htmlLang = (page) => page.evaluate(() => document.documentElement.lang);
// innerText devuelve el texto YA transformado por CSS (muchas etiquetas van en
// uppercase), asi que las comprobaciones se hacen en minusculas.
const bodyText = async (page) => (await page.locator("body").innerText()).toLowerCase();

async function seedAlias(page) {
  await page.evaluate(() => {
    localStorage.setItem("typerush.player.name", "T" + Math.floor(Math.random() * 999999));
  });
}

const run = async () => {
  const browser = await chromium.launch();

  /* ---------- 1. Detección por idioma del dispositivo ---------- */
  for (const [locale, expected, marker] of [
    ["es-CO", "es", "reto diario"],
    ["en-US", "en", "daily challenge"],
  ]) {
    const { ctx, page } = await newPage(browser, { locale });
    await page.goto(URL, { waitUntil: "networkidle" });
    const lang = await htmlLang(page);
    const text = await bodyText(page);
    check(`[${locale}] html lang = ${expected}`, lang === expected, `fue "${lang}"`);
    check(`[${locale}] portada en ${expected}`, text.includes(marker));
    check(
      `[${locale}] translate="no" en <html>`,
      (await page.evaluate(() => document.documentElement.getAttribute("translate"))) === "no",
    );
    await ctx.close();
  }

  /* ---------- 2. El selector cambia el idioma y persiste ---------- */
  {
    const { ctx, page } = await newPage(browser, { locale: "es-CO" });
    await page.goto(URL, { waitUntil: "networkidle" });
    await seedAlias(page);
    await page.reload({ waitUntil: "networkidle" });

    check("arranca en español", (await bodyText(page)).includes("reto diario"));

    // Pastilla EN de la cabecera
    await page.getByRole("radio", { name: "English" }).first().click();
    await page.waitForTimeout(400);
    check("tras pulsar English: UI en inglés", (await bodyText(page)).includes("daily challenge"));
    check("tras pulsar English: html lang = en", (await htmlLang(page)) === "en");

    // Persiste al RECARGAR (esto es lo que prueba que el servidor lee la cookie)
    await page.reload({ waitUntil: "networkidle" });
    check("persiste tras recargar", (await bodyText(page)).includes("daily challenge"));
    check("html lang tras recargar = en", (await htmlLang(page)) === "en");
    const ssrHtml = await page.content();
    check(
      "el HTML del servidor ya viene en inglés (sin parpadeo)",
      ssrHtml.includes("Daily challenge"),
    );

    // Persiste al NAVEGAR entre las tres secciones (ahora son rutas, no pestañas)
    await page.getByRole("link", { name: /History/i }).last().click();
    await page.waitForURL("**/historial", { timeout: 15000 });
    await page.waitForTimeout(2500);
    const histText = await bodyText(page);
    check("Historial en inglés", histText.includes("winners"), histText.slice(0, 60));
    check("nav en inglés", histText.includes("play") && histText.includes("profile"));

    await page.getByRole("link", { name: /Profile/i }).last().click();
    await page.waitForURL("**/perfil", { timeout: 15000 });
    await page.waitForTimeout(1500);
    check("Perfil en inglés", (await bodyText(page)).includes("connect your wallet"));

    await page.getByRole("link", { name: /Play/i }).last().click();
    await page.waitForURL(URL + "/", { timeout: 15000 });
    await page.waitForTimeout(1500);
    check("vuelve a Jugar en inglés", (await bodyText(page)).includes("daily challenge"));
    await ctx.close();
  }

  /* ---------- 3. Lobby en inglés (UI + modo) ---------- */
  //
  // ⚠️ Esta suite jugaba una carrera entera. Ya no puede: desde el 2026-08-09
  // toda partida es una transacción firmada contra GameV3, incluida la gratis,
  // y este navegador no tiene wallet. La cobertura de countdown/carrera/
  // resultado se pierde hasta que haya una wallet de pruebas — no se disimula
  // con un camino alternativo, que era justo el agujero que se cerró.
  //
  // Lo que sí se comprueba, y es lo que motivó esta suite: la app no se rompe
  // al cambiar de idioma, y el CTA no promete nada que no pueda cumplir.
  {
    const { ctx, page } = await newPage(browser, { locale: "en-US" });
    await page.goto(URL, { waitUntil: "networkidle" });
    await seedAlias(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const lobby = await bodyText(page);
    check("lobby en inglés", lobby.includes("daily challenge"), lobby.slice(0, 90));
    check("modalidad inglesa", lobby.includes("english") && lobby.includes("daily english"));

    // Sin wallet el botón dice qué falta; nunca "Play free", porque quien
    // decide si hay partida gratis es el contrato y aquí no hay a quién
    // preguntarle.
    check(
      "el CTA en inglés no promete gratis sin wallet",
      !lobby.includes("play free"),
      lobby.slice(0, 90),
    );
    check("html lang sigue en en", (await htmlLang(page)) === "en");
    await ctx.close();
  }

  /* ---------- 4. MiniPay: con cookies y SIN cookies ---------- */
  for (const blockCookies of [false, true]) {
    const label = blockCookies ? "MiniPay sin cookies" : "MiniPay";
    const { ctx, page } = await newPage(browser, {
      locale: "es-CO",
      minipay: true,
      blockCookies,
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    check(`[${label}] detecta MiniPay`, await page.evaluate(() => window.ethereum?.isMiniPay === true));
    check(`[${label}] arranca en español`, (await bodyText(page)).includes("reto diario"));

    await page.getByRole("radio", { name: "English" }).first().click();
    await page.waitForTimeout(400);
    check(`[${label}] cambia a inglés`, (await bodyText(page)).includes("daily challenge"));
    check(`[${label}] html lang = en`, (await htmlLang(page)) === "en");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check(
      `[${label}] sigue en inglés tras recargar`,
      (await bodyText(page)).includes("daily challenge"),
    );
    check(`[${label}] html lang = en tras recargar`, (await htmlLang(page)) === "en");

    // …y de vuelta a español
    await page.getByRole("radio", { name: "Español" }).first().click();
    await page.waitForTimeout(400);
    check(`[${label}] vuelve a español`, (await bodyText(page)).includes("reto diario"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check(
      `[${label}] español persiste tras recargar`,
      (await bodyText(page)).includes("reto diario"),
    );
    await ctx.close();
  }

  /* ---------- 5. Regresión: el fallo reportado ya no ocurre ---------- */
  // El caso original: dispositivo en inglés → la página llegaba en español →
  // el navegador la traducía → React reventaba con removeChild → la webview
  // mostraba "This page couldn't load".
  {
    const { ctx, page } = await newPage(browser, { locale: "en-US" });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    // (a) Ya no hay nada que traducir: el HTML llega en el idioma del aparato.
    check(
      "[regresión] la página llega en el idioma del dispositivo",
      (await bodyText(page)).includes("daily challenge"),
    );

    // (b) Y aunque algo forzara la traducción, <html translate="no"> se lo
    //     prohíbe explícitamente al navegador.
    const guarded = await page.evaluate(() => ({
      html: document.documentElement.getAttribute("translate"),
      cls: document.documentElement.className.includes("notranslate"),
      passage: document
        .querySelectorAll('[translate="no"]').length,
    }));
    check("[regresión] <html translate=no>", guarded.html === "no");
    check("[regresión] <html class=notranslate>", guarded.cls);

    // (c) Y el flujo exacto que reventaba —cambiar de idioma y seguir tocando
    //     la pantalla— ahora funciona sin un solo error de página.
    //
    //     El repro original terminaba pulsando "Play free". Ese botón ya no
    //     existe sin wallet (toda partida es una transacción firmada), así que
    //     se sustituye por las otras interacciones que vuelven a pintar el
    //     árbol: los selectores de modalidad y de reto, y el tutorial. Lo que
    //     provocaba el `removeChild` era el re-render tras traducir, no el
    //     hecho de jugar.
    const before = results.filter((r) => !r.ok).length;
    await page.getByRole("radio", { name: "Español" }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole("radio", { name: "English" }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole("radio", { name: /Spanish|Español/ }).last().click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /Cómo jugar|How to play/i }).first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    const after = await bodyText(page);
    check(
      "[regresión] no aparece \"This page couldn't load\"",
      !after.includes("couldn't load") && !after.includes("could not load"),
    );
    check(
      "[regresión] el flujo idioma → jugar no lanza errores",
      results.filter((r) => !r.ok).length === before,
    );
    await ctx.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} OK ===`);
  if (failed.length) {
    console.log("FALLOS:");
    for (const f of failed) console.log(" -", f.name, f.detail);
    process.exit(1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
