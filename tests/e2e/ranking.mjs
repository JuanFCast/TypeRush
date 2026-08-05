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

  await browser.close();

  const ok = out.filter((r) => r.ok).length;
  console.log(`\n=== ${ok}/${out.length} OK ===`);
  if (ok !== out.length) process.exit(1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
