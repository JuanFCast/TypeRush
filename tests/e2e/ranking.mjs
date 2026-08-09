// Ranking de la ronda en curso: visible dentro de Jugar, completo en /ranking,
// y SIN convertirse en una cuarta pestaña.
//
// Existe porque el ranking ya desapareció una vez: el refactor de tres rutas
// borró `RankingScreen` dejando `loadModeRanking()` sin usar, y nada falló.
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const out = [];
// Página con el tutorial ya marcado como visto: se abre solo la primera vez y
// taparía el lobby. Su apertura automática se prueba aparte, en nav.mjs.
const newPage = async (ctx) => {
  await ctx.addInitScript(() => localStorage.setItem("typerush.howto.v1", "1"));
  return ctx.newPage();
};
const check = (n, ok, d = "") => {
  out.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

/** Ronda simulada de 4 jugadores: la suite no puede depender de que haya
 *  partidas reales — al abrir una ronda nueva el ranking está legítimamente
 *  vacío — ni ensuciar la ronda en curso metiendo un jugador de prueba.
 *
 *  ⚠️ La forma es la de `/api/ranking/round`, que desde el 2026-08-09 es la
 *  fuente del ranking en vivo: sale de `v3_results` por `onchain_day`, igual
 *  que la liquidación. Antes se simulaba `match_results` de Supabase, que era
 *  precisamente el problema — ahí escribía cualquiera desde internet.
 *
 *  Fíjate en lo que NO trae: direcciones. `playerId` es un id opaco y el
 *  "eres tú" viene resuelto del servidor. */
const FAKE_ROUND = [
  { rank: 1, playerId: "op-lider", name: "Lider", score: 900, wpm: 60, accuracy: 98, hasWallet: true, you: false },
  { rank: 2, playerId: "op-yo", name: "YoMismo", score: 500, wpm: 40, accuracy: 95, hasWallet: true, you: true },
  { rank: 3, playerId: "op-3", name: "Tercero", score: 300, wpm: 30, accuracy: 90, hasWallet: true, you: false },
  { rank: 4, playerId: "op-4", name: "Cuarto", score: 100, wpm: 20, accuracy: 80, hasWallet: true, you: false },
];

const mockRound = async (page, entries = FAKE_ROUND) => {
  await page.route("**/api/ranking/round", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        day: 20674,
        mode: "es",
        entries,
        me: entries.find((e) => e.you) ?? null,
      }),
    }),
  );
};

const run = async () => {
  const browser = await chromium.launch();

  /* ---------- El resumen vive en Jugar, en móvil ---------- */
  {
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 360, height: 740 },
    });
    const page = await newPage(ctx);
    page.on("pageerror", (e) =>
      check("sin errores de página en Jugar", false, e.message.split("\n")[0]),
    );
    await mockRound(page);

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const ranking = page.locator("section:has-text('Top 3 de hoy')").last();
    check("Jugar muestra el ranking de la ronda", await ranking.isVisible());

    // Cada fila: posición, alias y sus métricas (PPM y puntaje).
    const text = (await ranking.innerText()).toLowerCase();
    check("las filas traen alias, PPM y puntaje",
      text.includes("lider") && text.includes("ppm") && text.includes("puntaje"),
      text.slice(0, 80).replace(/\n/g, " | "));

    // Sin scroll horizontal en la pantalla más estrecha que soportamos.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check("360 px sin scroll horizontal", overflow <= 0, `overflow=${overflow}px`);

    // Cada navegación (la barra inferior de móvil y la del header de
    // escritorio) sigue teniendo TRES destinos, y ninguno es el ranking.
    const navs = page.locator("nav[aria-label]");
    const navCount = await navs.count();
    for (let i = 0; i < navCount; i += 1) {
      const links = await navs.nth(i).locator("a").count();
      check(`navegación ${i + 1} con 3 destinos`, links === 3, `${links} enlaces`);
    }
    check(
      "no hay pestaña de Ranking en ninguna navegación",
      !(await page.locator("nav[aria-label] a[href^='/ranking']").count()),
    );

    await ctx.close();
  }

  /* ---------- El enlace lleva al ranking completo ---------- */
  {
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 390, height: 844 },
    });
    const page = await newPage(ctx);
    await mockRound(page);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const link = page.locator("a[href^='/ranking']").first();
    const hasLink = (await link.count()) > 0;
    check("Jugar enlaza al ranking completo", hasLink);
    if (hasLink) {
      await link.click();
      await page.waitForURL(/\/ranking/, { timeout: 10_000 });
      await page.waitForTimeout(2000);
      const t = await body(page);
      check("/ranking abre con la clasificación", t.includes("ranking de hoy"));
      check("/ranking permite filtrar por modalidad", t.includes("modalidad"));
    }
    await ctx.close();
  }

  /* ---------- La modalidad de la URL manda sobre el idioma ---------- */
  {
    // App en español pero ?mode=en: debe listar la modalidad inglesa, que es
    // justo la separación idioma-de-app / idioma-que-se-teclea.
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 1280, height: 800 },
    });
    const page = await newPage(ctx);
    await page.goto(`${URL}/ranking?mode=en`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    // Solo el filtro de modalidad, no la pastilla de idioma del header.
    const pressed = await page
      .locator(
        "[role='group'][aria-labelledby='ranking-mode-filter'] button[aria-pressed='true']",
      )
      .first()
      .innerText();
    // Con la app en español la modalidad inglesa se lee "Inglés"; en inglés,
    // "English". Se aceptan las dos: lo que se comprueba es cuál quedó activa.
    const label = pressed.toLowerCase();
    check(
      "?mode=en selecciona la modalidad inglesa",
      label.includes("inglés") || label.includes("english"),
      pressed.replace(/\n/g, " "),
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check("/ranking sin scroll horizontal en escritorio", overflow <= 0, `overflow=${overflow}px`);
    await ctx.close();
  }

  /* ---------- Mi fila, y que no se filtren direcciones ---------- */
  {
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 390, height: 844 },
    });
    const page = await newPage(ctx);
    await mockRound(page);

    // Toda respuesta de nuestro origen se revisa: ninguna puede traer una
    // dirección completa de 40 hex hasta el navegador.
    const leaks = [];
    page.on("response", async (res) => {
      if (!res.url().startsWith("http://localhost:3000")) return;
      const type = res.headers()["content-type"] ?? "";
      if (!type.includes("json") && !type.includes("html")) return;
      try {
        const body = await res.text();
        if (/0x[0-9a-fA-F]{40}/.test(body)) leaks.push(res.url());
      } catch {
        /* respuesta no legible: nada que revisar */
      }
    });

    await page.goto(`${URL}/ranking?mode=es`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const text = await body(page);
    check("mi fila aparece marcada como Tú", text.includes("tú"));

    // El aviso de "vincula tu wallet" era de V2, donde se jugaba sin wallet y
    // el premio del #1 podía quedarse sin cobrar. En V3 aparecer en la lista
    // exige haber firmado la partida, así que ese aviso sería mentira.
    check(
      "ya no se avisa de wallet sin vincular",
      !text.includes("vincúlala desde perfil"),
      text.slice(0, 60).replace(/\n/g, " | "),
    );
    check(
      "ninguna respuesta trae una dirección completa",
      leaks.length === 0,
      leaks.join(", "),
    );

    await ctx.close();
  }

  /* ---------- El endpoint REAL tampoco devuelve direcciones ---------- */
  {
    // Sin simulacro: se llama a `/api/ranking/round` de verdad. Es la comprobación
    // que importa, porque ese endpoint lee wallets de `v3_results` y tiene que
    // convertirlas en ids opacos antes de responder.
    const ctx = await browser.newContext({ locale: "es-CO" });
    const page = await newPage(ctx);
    await page.goto(URL, { waitUntil: "domcontentloaded" });

    const res = await page.evaluate(async () => {
      const r = await fetch("/api/ranking/round", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "es",
          wallet: "0x1111111111111111111111111111111111111111",
        }),
      });
      return { status: r.status, body: await r.text() };
    });

    check(
      "/api/ranking/round responde",
      res.status === 200 || res.status === 503,
      `HTTP ${res.status}`,
    );
    check(
      "y su respuesta no contiene ninguna dirección",
      !/0x[0-9a-fA-F]{40}/.test(res.body),
      res.body.slice(0, 80),
    );

    await ctx.close();
  }

  await browser.close();

  const ok = out.filter((r) => r.ok).length;
  console.log(`\n=== ${ok}/${out.length} OK ===`);
  if (ok !== out.length) process.exit(1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
