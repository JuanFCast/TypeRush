// Carrera completa en español + caso mixto (app en inglés, texto en español).
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

// El tutorial se abre solo la primera vez y taparía el lobby: se marca como
// visto ANTES de cargar. Su apertura automática se prueba aparte, en nav.mjs.
const skipHowTo = (page) =>
  page.addInitScript(() => localStorage.setItem("typerush.howto.v1", "1"));

const run = async () => {
  const browser = await chromium.launch();

  /* ---- Carrera completa en ESPAÑOL ---- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("sin errores", false, e.message.split("\n")[0]));
    await skipHowTo(page);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.setItem("typerush.player.name", "E" + Math.floor(Math.random() * 999999)),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // La app abre directamente en el reto del día: sin portada ni pantalla de
    // modos intermedia, el CTA de jugar ya está en la primera pantalla.
    const lobby = await body(page);
    check("lobby ES", lobby.includes("reto diario") && lobby.includes("carrera de 45 segundos"));
    check("modalidad española", lobby.includes("español") && lobby.includes("noticias"));

    // ⚠️ Aquí se jugaba una carrera entera. Ya no se puede: desde el 2026-08-09
    // toda partida es una transacción firmada contra GameV3 —también la
    // gratis— y este navegador no tiene wallet. La cobertura de la carrera se
    // pierde hasta que haya una wallet de pruebas; no se sustituye por un
    // camino sin firma, que era exactamente el agujero que se cerró.
    check(
      "el CTA no promete gratis sin wallet",
      !lobby.includes("jugar gratis"),
      lobby.slice(0, 90).replace(/\n/g, " | "),
    );
    check(
      "y dice qué falta para poder jugar",
      lobby.includes("conecta una wallet") || lobby.includes("aún no está activo"),
      lobby.slice(0, 120).replace(/\n/g, " | "),
    );
    await ctx.close();
  }

  /* ---- Mixto: se entra al lobby ESPAÑOL y se pasa la app a inglés ---- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("sin errores (mixto)", false, e.message.split("\n")[0]));
    await skipHowTo(page);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.setItem("typerush.player.name", "M" + Math.floor(Math.random() * 999999)),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    check("entra al lobby español", (await body(page)).includes("noticias"));

    // Cambia la app a inglés con la pastilla de la CABECERA: esa solo toca la
    // interfaz, así que la modalidad (el texto que se teclea) no se mueve.
    await page.getByRole("radio", { name: "English" }).first().click();
    await page.waitForTimeout(800);
    const mixed = await body(page);
    check("app en inglés dentro del lobby", mixed.includes("daily challenge"));
    check(
      "la modalidad sigue siendo la española (retos en español)",
      mixed.includes("spanish") && mixed.includes("news") && mixed.includes("crypto"),
      mixed.slice(0, 120).replace(/\n/g, " | "),
    );
    await ctx.close();
  }

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - bad.length}/${results.length} OK ===`);
  if (bad.length) process.exit(1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
