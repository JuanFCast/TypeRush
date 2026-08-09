// Los importes (pozo, entrada, saldos) deben seguir el idioma de la interfaz.
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
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
  const page = await newPage(ctx);
  page.on("pageerror", (e) => check("sin errores", false, e.message.split("\n")[0]));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const es = await page.locator("body").innerText();
  const esUsdt = es.match(/([\d.,]+)\s*\n?USDT/i)?.[1] ?? "";
  console.log("   ES →", { esUsdt });
  check("ES: USDT con coma decimal", /^\d+,\d{2}$/.test(esUsdt), esUsdt);

  await page.getByRole("radio", { name: "English" }).first().click();
  await page.waitForTimeout(2500);
  const en = await page.locator("body").innerText();
  const enUsdt = en.match(/([\d.,]+)\s*\n?USDT/i)?.[1] ?? "";
  console.log("   EN →", { enUsdt });
  check("EN: USDT con punto decimal", /^\d+\.\d{2}$/.test(enUsdt), enUsdt);

  // El separador de MILES se comprueba en Historial y no en el pozo del día:
  // desde que la siembra automática está apagada, una ronda recién abierta
  // empieza legítimamente en 0 y un cero no prueba ningún formato. Los premios
  // ya pagados sí traen miles de verdad (1.500 COPm / 1,500 COPm).
  for (const [lang, label, re] of [
    ["es", "ES", /^\d{1,3}(\.\d{3})+$/],
    ["en", "EN", /^\d{1,3}(,\d{3})+$/],
  ]) {
    await page.goto(URL + "/historial", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page
      .getByRole("radio", { name: lang === "es" ? "Español" : "English" })
      .first()
      .click();
    await page.waitForTimeout(2000);
    const txt = await page.locator("body").innerText();
    const copm = txt.match(/([\d.,]+)\s*\n?COPm/i)?.[1] ?? "";
    console.log(`   ${label} historial →`, { copm });
    check(
      `${label}: COPm con separador de miles propio del idioma`,
      re.test(copm),
      copm,
    );
  }

  // El CTA ya no promete precio ni "gratis" sin wallet conectada: quien decide
  // eso es el contrato (`hasFreePlay`), y sin wallet no hay a quién preguntarle.
  // Sin navegador con wallet, lo que se comprueba es que NO invente una cifra.
  check(
    "EN: sin wallet el CTA no promete precio ni gratis",
    en.includes("Connect a wallet to play") ||
      en.includes("Checking") ||
      en.includes("isn't live yet"),
    en.slice(0, 80).replace(/\n/g, " | "),
  );

  await browser.close();
  const bad = out.filter((o) => !o).length;
  console.log(`\n=== ${out.length - bad}/${out.length} OK ===`);
  if (bad) process.exit(1);
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
