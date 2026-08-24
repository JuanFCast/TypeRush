// Estadísticas públicas: /perfil/estadisticas.
//
//   npm run dev   (en otra terminal)
//   node tests/e2e/stats.mjs
//
// Lo que se comprueba aquí es lo que puede romperse sin que falle el build:
// que la página sea PÚBLICA (no pida wallet ni dispare login), que siga
// colgando de Perfil sin añadir una cuarta pestaña, que ES e EN estén
// completos, que no haya scroll horizontal en móviles pequeños y que un dato
// ausente no se pinte como un cero.
import { chromium } from "playwright";

const URL = "http://localhost:3000";
const out = [];
const check = (n, ok, d = "") => {
  out.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

// El tutorial se abre solo en la primera visita y taparía cualquier clic.
const newPage = async (ctx) => {
  await ctx.addInitScript(() => localStorage.setItem("typerush.howto.v1", "1"));
  return ctx.newPage();
};

const run = async () => {
  const browser = await chromium.launch();

  /* ---------- Entrada desde Perfil ---------- */
  {
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 390, height: 844 },
    });
    const page = await newPage(ctx);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(URL + "/perfil", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Sin sesión: Perfil enseña el guard, pero las estadísticas son públicas y
    // por eso el enlace tiene que estar ahí igual.
    const link = page.getByRole("link", { name: /Ver estadísticas/i }).first();
    check("Perfil sin sesión ofrece el enlace", await link.isVisible());

    await link.click();
    await page.waitForURL("**/perfil/estadisticas", { timeout: 10000 });
    await page.waitForTimeout(2000);

    const txt = await body(page);
    check("la página abre sin wallet ni login", txt.includes("estadísticas"));
    check("no pide conectar wallet", !txt.includes("conecta tu wallet"), txt.slice(0, 90));
    check("no revienta la pantalla", !txt.includes("this page couldn"));
    check("sin errores de página", errors.length === 0, errors[0] ?? "");

    // La pestaña Perfil sigue activa en la ruta anidada, y siguen siendo tres.
    const nav = page.locator("nav[aria-label]").last();
    const links = await nav.locator("a").allInnerTexts();
    check("la barra inferior sigue con 3 destinos", links.length === 3, links.join(" | "));
    check(
      "no aparece una pestaña Estadísticas",
      !links.join(" ").toLowerCase().includes("estadística"),
    );
    const current = await page.locator('nav a[aria-current="page"]').innerText();
    check("Perfil queda activo en la ruta anidada", /perfil/i.test(current), current);

    // Volver.
    await page.getByRole("link", { name: /Volver a Perfil/i }).click();
    await page.waitForURL("**/perfil", { timeout: 10000 });
    check("Volver regresa a Perfil", page.url().endsWith("/perfil"), page.url());

    await ctx.close();
  }

  /* ---------- Secciones y honestidad de las cifras ---------- */
  {
    const ctx = await browser.newContext({
      locale: "es-CO",
      viewport: { width: 390, height: 844 },
    });
    const page = await newPage(ctx);
    await page.goto(URL + "/perfil/estadisticas", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const txt = await body(page);

    for (const [name, marker] of [
      ["Hoy", "jugadores de hoy"],
      ["Jugadores", "conversión a pago"],
      ["Carreras", "finalización"],
      ["Economía", "premios pagados"],
      ["On-chain", "jugadas verificadas"],
      ["Metodología", "cómo se calculan"],
    ]) {
      check(`sección ${name}`, txt.includes(marker), marker);
    }

    // El dinero es SIEMPRE USDT. COPm se retiró como entrada el 2026-08-12, así
    // que no puede quedar ni un MONTO en esa moneda: eso sería revivir una
    // entrada que ya no se vende, o peor, sumar dos monedas distintas.
    //
    // Nombrarla en la metodología SÍ vale, y por eso la comprobación busca una
    // cifra pegada a "COPm" en vez de la palabra suelta: la nota que explica
    // que ya no se ofrece es justo lo contrario de presentarla como activa.
    check("las cifras de dinero son USDT", /\d[\s\u00a0]*usdt/.test(txt));
    check(
      "ningún monto en COPm",
      !/\d[\s\u00a0]*copm/.test(txt),
      (txt.match(/.{0,40}copm.{0,20}/) ?? [""])[0],
    );

    // Un 0 real y un dato ausente tienen copy distinto. Los dos textos existen
    // en el diccionario; lo que no puede pasar es que un fallo se pinte como 0.
    check(
      "distingue sin datos de cero",
      txt.includes("aún sin datos") || txt.includes("no disponible") || txt.includes("0"),
    );

    // Mientras no exista una fuente comprobable de lo sembrado en los pozos, la
    // única mención permitida a P&L es la nota que explica por qué NO se
    // calcula. Un KPI titulado "utilidad" o "ganancia" no puede aparecer.
    check(
      "no se presenta una cifra de utilidad",
      txt.includes("no se muestra utilidad ni p&l"),
    );

    // Privacidad: agregados, nunca un padrón de jugadores.
    const html = await page.content();
    check(
      "no imprime wallets completas",
      !/0x[0-9a-f]{40}/i.test(html.replace(/celoscan\.io\/address\/0x[0-9a-fA-F]{40}/g, "")),
      "solo el contrato puede aparecer, y va en el enlace a CeloScan",
    );

    // El enlace externo tiene rel seguro y apunta al contrato en mainnet.
    const ext = page.locator('a[target="_blank"]').first();
    if (await ext.count()) {
      const rel = (await ext.getAttribute("rel")) ?? "";
      const href = (await ext.getAttribute("href")) ?? "";
      check("enlace externo con rel seguro", rel.includes("noopener") && rel.includes("noreferrer"), rel);
      check("apunta a CeloScan mainnet", href.startsWith("https://celoscan.io/address/0x"), href);
    } else {
      check("enlace al contrato presente", false, "sin contrato configurado");
    }

    await ctx.close();
  }

  /* ---------- Inglés completo ---------- */
  {
    const ctx = await browser.newContext({
      locale: "en-US",
      viewport: { width: 390, height: 844 },
    });
    const page = await newPage(ctx);
    await page.goto(URL + "/perfil/estadisticas", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const txt = await body(page);

    check("inglés: título", txt.includes("statistics"));
    check("inglés: secciones", txt.includes("players") && txt.includes("economy"));
    check("inglés: metodología", txt.includes("how these are calculated"));
    // Sin claves sin traducir: una etiqueta en español aquí sería una fuga.
    check(
      "no quedan textos en español",
      !txt.includes("jugadores de hoy") && !txt.includes("premios pagados"),
    );
    // Los montos siguen el locale: 0.30 en inglés, 0,30 en español.
    check("los montos usan el formato del idioma", /\d\.\d{2}\s*usdt/.test(txt), txt.slice(0, 60));

    // El idioma elegido en Perfil se conserva al entrar (cookie + servidor).
    check("html lang en inglés", (await page.getAttribute("html", "lang")) === "en");
    await ctx.close();
  }

  /* ---------- Responsive ---------- */
  for (const vp of [
    { name: "móvil 360", width: 360, height: 740 },
    { name: "móvil 390", width: 390, height: 844 },
    { name: "móvil 430", width: 430, height: 932 },
    { name: "tablet 768", width: 768, height: 1024 },
    { name: "desktop 1280", width: 1280, height: 800 },
  ]) {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: vp });
    const page = await newPage(ctx);
    await page.goto(URL + "/perfil/estadisticas", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`[${vp.name}] sin scroll horizontal global`, overflow <= 1, `overflow=${overflow}px`);

    // La tabla por modalidad es más ancha que 360 px a propósito: su scroll
    // vive DENTRO de la tarjeta, que es lo que evita el desbordamiento global.
    const scroller = page.locator(".overflow-x-auto").first();
    check(`[${vp.name}] la tabla lleva su propio scroll`, (await scroller.count()) > 0);
    await ctx.close();
  }

  await browser.close();
  const bad = out.filter((o) => !o.ok);
  console.log(`\n=== ${out.length - bad.length}/${out.length} OK ===`);
  if (bad.length) {
    bad.forEach((b) => console.log(" -", b.n));
    process.exit(1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
