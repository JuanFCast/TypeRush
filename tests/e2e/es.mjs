// Carrera completa en español + caso mixto (app en inglés, texto en español).
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

const run = async () => {
  const browser = await chromium.launch();

  /* ---- Carrera completa en ESPAÑOL ---- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("sin errores", false, e.message.split("\n")[0]));
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.setItem("typerush.player.name", "E" + Math.floor(Math.random() * 999999)),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    check("portada ES", (await body(page)).includes("escribe rápido."));
    await page.getByRole("button", { name: /Jugar gratis|Jugar por/ }).first().click();
    await page.waitForTimeout(1800);
    const lobby = await body(page);
    check("lobby ES", lobby.includes("tu mejor puntaje") && lobby.includes("motivación"));
    check("modalidad española", lobby.includes("español") && lobby.includes("noticias"));

    await page.getByRole("button", { name: /Jugar gratis/ }).first().click();
    await page.waitForTimeout(1200);
    check("countdown ES", (await body(page)).includes("calienta los dedos"));
    await page.waitForTimeout(3500);
    const race = await body(page);
    check("carrera ES", race.includes("tiempo") && race.includes("precisión"));
    const passage = await page.evaluate(
      () => document.querySelector("#typeInput")?.closest("div")?.querySelector("p")?.innerText ?? "",
    );
    check("pasaje en español", /que|los|una|de /i.test(passage), passage.slice(0, 55));
    await page.locator("#typeInput").type(passage.slice(0, 50), { delay: 12 });
    await page.waitForTimeout(800);
    check("sigue viva tras teclear", (await body(page)).includes("tiempo"));

    console.log("   (esperando el cierre, 45 s)…");
    await page.waitForTimeout(46000);
    const res = await body(page);
    check(
      "resultado ES",
      res.includes("palabras por minuto") && res.includes("volver a retos"),
      res.slice(0, 90).replace(/\n/g, " | "),
    );
    await ctx.close();
  }

  /* ---- Mixto: se entra al lobby ESPAÑOL y se pasa la app a inglés ---- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("sin errores (mixto)", false, e.message.split("\n")[0]));
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.setItem("typerush.player.name", "M" + Math.floor(Math.random() * 999999)),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /Jugar gratis|Jugar por/ }).first().click();
    await page.waitForTimeout(1800);
    check("entra al lobby español", (await body(page)).includes("noticias"));

    // Cambia la app a inglés SIN salir del lobby.
    await page.getByRole("radio", { name: "English" }).first().click();
    await page.waitForTimeout(800);
    const mixed = await body(page);
    check("app en inglés dentro del lobby", mixed.includes("your best score"));
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
