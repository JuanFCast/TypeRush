// Ranking de la ronda en curso: visible dentro de Jugar, completo en /ranking,
// y SIN convertirse en una cuarta pestaña.
//
// Existe porque el ranking ya desapareció una vez: el refactor de tres rutas
// borró `RankingScreen` dejando `loadModeRanking()` sin usar, y nada falló.
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const out = [];
const check = (n, ok, d = "") => {
  out.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

/** Ronda simulada de 4 jugadores: la suite no puede depender de que haya
 *  partidas reales — al abrir una ronda nueva el ranking está legítimamente
 *  vacío — ni ensuciar la ronda en curso metiendo un jugador de prueba. */
const FAKE_ROUND = [
  { player_id: "lider-1", player_name: "Lider", score: 900, wpm: 60, accuracy: 0.98 },
  { player_id: "test-me", player_name: "YoMismo", score: 500, wpm: 40, accuracy: 0.95 },
  { player_id: "otro-3", player_name: "Tercero", score: 300, wpm: 30, accuracy: 0.9 },
  { player_id: "otro-4", player_name: "Cuarto", score: 100, wpm: 20, accuracy: 0.8 },
];

const mockRound = async (page, rows = FAKE_ROUND, flags = {}) => {
  await page.route("**/rest/v1/match_results*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    }),
  );
  await page.route("**/api/ranking/wallets", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ flags }),
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
    const page = await ctx.newPage();
    page.on("pageerror", (e) =>
      check("sin errores de página en Jugar", false, e.message.split("\n")[0]),
    );
    await mockRound(page);

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const ranking = page.locator("section:has-text('Ranking de hoy')").first();
    check("Jugar muestra el ranking de la ronda", await ranking.isVisible());

    // Cabeceras de la tabla: posición, jugador, PPM y puntaje.
    const text = (await ranking.innerText()).toLowerCase();
    check("la tabla trae jugador, PPM y puntaje",
      text.includes("jugador") && text.includes("ppm") && text.includes("puntaje"));

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
    const page = await ctx.newPage();
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
    const page = await ctx.newPage();
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

  /* ---------- Aviso de wallet y no filtrar direcciones ---------- */
  {
    // Ronda simulada: se intercepta la consulta a Supabase para no depender de
    // que haya partidas reales ni ensuciar la ronda en curso con un jugador de
    // prueba. Yo soy "test-me" y voy segundo; el líder es otro.
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem("typerush.player.id", "test-me");
      window.localStorage.setItem("typerush.player.name", "YoMismo");
    });

    // Nadie tiene wallet: el endpoint responde booleanos, nunca direcciones.
    await mockRound(page, FAKE_ROUND, { "lider-1": false, "test-me": false });

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
    check(
      "el aviso dice que hay que vincular la wallet para recibir el premio",
      text.includes("vincúlala desde perfil") && text.includes("recibirlo"),
    );
    // Dentro del ranking, no el enlace de la barra de navegación.
    const link = page
      .locator("section a[href='/perfil']")
      .filter({ hasText: "Perfil" })
      .first();
    check("y ofrece el enlace a Perfil", (await link.count()) > 0);
    if ((await link.count()) > 0) {
      const box = await link.boundingBox();
      check(
        "el enlace cumple el área táctil de 44 px",
        !!box && box.height >= 44,
        box ? `${Math.round(box.height)}px` : "sin caja",
      );
    }
    check("mi fila aparece marcada como Tú", text.includes("tú"));
    check(
      "ninguna respuesta trae una dirección completa",
      leaks.length === 0,
      leaks.join(", "),
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
