// Navegación de tres pestañas, estados vacíos, responsive y metadatos.
import { chromium } from "playwright";
const URL = "http://localhost:3000";
const out = [];
const check = (n, ok, d = "") => {
  out.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const body = async (p) => (await p.locator("body").innerText()).toLowerCase();

const VIEWPORTS = [
  { name: "móvil 360", width: 360, height: 740 },
  { name: "móvil 414", width: 414, height: 896 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "desktop 1280", width: 1280, height: 800 },
  { name: "desktop 1920", width: 1920, height: 1080 },
];

const run = async () => {
  const browser = await chromium.launch();

  /* ---------- Navegación de 3 pestañas ---------- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("sin errores de página", false, e.message.split("\n")[0]));

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const nav = page.locator("nav[aria-label]").last();
    const links = await nav.locator("a").allInnerTexts();
    check("la barra inferior tiene 3 destinos", links.length === 3, links.join(" | "));
    const joined = links.join(" ").toLowerCase();
    check("son Jugar / Historial / Perfil",
      joined.includes("jugar") && joined.includes("historial") && joined.includes("perfil"));
    check("no hay pestaña Ranking",
      !joined.includes("ranking"), joined);

    // Navegar a cada una
    await page.getByRole("link", { name: /Historial/i }).last().click();
    await page.waitForURL("**/historial", { timeout: 10000 });
    await page.waitForTimeout(2500);
    check("Historial carga", (await body(page)).includes("ganadores"));

    await page.getByRole("link", { name: /Perfil/i }).last().click();
    await page.waitForURL("**/perfil", { timeout: 10000 });
    await page.waitForTimeout(1500);
    check("Perfil carga (invitado ve el guard)",
      (await body(page)).includes("conecta tu wallet"));

    await page.getByRole("link", { name: /Jugar/i }).last().click();
    await page.waitForURL(URL + "/", { timeout: 10000 });
    await page.waitForTimeout(1500);
    check("vuelve a Jugar", (await body(page)).includes("escribe rápido"));
    check("Jugar muestra la tarjeta de sesión",
      (await body(page)).includes("invitado") || (await body(page)).includes("hola"));

    await ctx.close();
  }

  /* ---------- Historial: filtros y estado vacío ---------- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(URL + "/historial", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const txt = await body(page);
    check("hay filtros de modalidad y token",
      txt.includes("modalidad") && txt.includes("token"));

    // "Tus premios" sin wallet → estado vacío explicativo, no un error
    await page.getByRole("button", { name: /Tus premios/i }).click();
    await page.waitForTimeout(1200);
    const mine = await body(page);
    check("Tus premios sin wallet muestra estado vacío",
      mine.includes("conecta tu wallet"), mine.slice(0, 80));
    check("no revienta la pantalla", !mine.includes("this page couldn"));
    await ctx.close();
  }

  /* ---------- Responsive ---------- */
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: vp });
    const page = await ctx.newPage();
    for (const route of ["/", "/historial", "/perfil"]) {
      await page.goto(URL + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`[${vp.name}] ${route} sin scroll horizontal`, overflow <= 1, `overflow=${overflow}px`);
    }
    // La barra inferior solo en móvil/tablet (<768px de breakpoint md)
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const bottomVisible = await page
      .locator("nav.fixed")
      .isVisible()
      .catch(() => false);
    const expectBottom = vp.width < 768;
    check(
      `[${vp.name}] barra inferior ${expectBottom ? "visible" : "oculta"}`,
      bottomVisible === expectBottom,
      `visible=${bottomVisible}`,
    );
    await ctx.close();
  }

  /* ---------- typerush.fun: metadatos, sitemap, robots ---------- */
  {
    const ctx = await browser.newContext({ locale: "es-CO" });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const html = await page.content();
    check("canonical apunta a typerush.fun", html.includes("https://typerush.fun"), "");
    check("og:url en typerush.fun", /og:url"[^>]*typerush\.fun/.test(html) || html.includes('content="https://typerush.fun/"'));
    check("no hay canonical a vercel.app", !/rel="canonical"[^>]*vercel\.app/.test(html));

    const robots = await (await ctx.request.get(URL + "/robots.txt")).text();
    check("robots.txt con sitemap oficial", robots.includes("https://typerush.fun/sitemap.xml"), robots.split("\n")[0]);
    check("robots.txt bloquea /api", robots.includes("/api/"));

    const sitemap = await (await ctx.request.get(URL + "/sitemap.xml")).text();
    check("sitemap incluye las 3 rutas",
      sitemap.includes("typerush.fun/</loc>") || sitemap.includes("typerush.fun/<"),
      "");
    check("sitemap con /historial y /perfil",
      sitemap.includes("/historial") && sitemap.includes("/perfil"));

    const manifest = await (await ctx.request.get(URL + "/manifest.webmanifest")).json();
    check("manifest con nombre TypeRush", manifest.short_name === "TypeRush");
    await ctx.close();
  }

  /* ---------- Sin credenciales de Privy ---------- */
  {
    const ctx = await browser.newContext({ locale: "es-CO", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    check("sin PRIVY_APP_ID la app carga igual", (await body(page)).includes("escribe rápido"));
    check("y ofrece conectar wallet", (await body(page)).includes("conectar wallet"));
    check("sin errores de página", errors.length === 0, errors[0] ?? "");
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
