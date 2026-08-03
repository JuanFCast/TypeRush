// Los importes (pozo, entrada, saldos) deben seguir el idioma de la interfaz.
import { chromium } from "playwright";
const URL = "http://localhost:3000";
const out = [];
const check = (n, ok, d = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => check("sin errores", false, e.message.split("\n")[0]));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const es = await page.locator("body").innerText();
  // El pozo COPm ronda el millar: en español lleva PUNTO de miles.
  const esCopm = es.match(/([\d.,]+)\s*\n?COPm/i)?.[1] ?? "";
  const esUsdt = es.match(/([\d.,]+)\s*\n?USDT/i)?.[1] ?? "";
  console.log("   ES →", { esUsdt, esCopm });
  check("ES: USDT con coma decimal", /^\d+,\d{2}$/.test(esUsdt), esUsdt);
  check("ES: COPm con punto de miles", /^\d{1,3}(\.\d{3})+$/.test(esCopm), esCopm);

  await page.getByRole("radio", { name: "English" }).first().click();
  await page.waitForTimeout(2500);
  const en = await page.locator("body").innerText();
  const enCopm = en.match(/([\d.,]+)\s*\n?COPm/i)?.[1] ?? "";
  const enUsdt = en.match(/([\d.,]+)\s*\n?USDT/i)?.[1] ?? "";
  console.log("   EN →", { enUsdt, enCopm });
  check("EN: USDT con punto decimal", /^\d+\.\d{2}$/.test(enUsdt), enUsdt);
  check("EN: COPm con coma de miles", /^\d{1,3}(,\d{3})+$/.test(enCopm), enCopm);

  // Botón de pago (entryLabel) — solo aparece si ya no hay tiro gratis; se
  // comprueba el texto del CTA de la portada, que sí está siempre.
  check("EN: CTA con 0.10 USDT", en.includes("0.10 USDT") || en.includes("Play free"), "");

  await browser.close();
  const bad = out.filter((o) => !o).length;
  console.log(`\n=== ${out.length - bad}/${out.length} OK ===`);
  if (bad) process.exit(1);
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
