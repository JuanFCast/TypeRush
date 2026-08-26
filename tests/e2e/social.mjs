// La tarjeta de enlace (Open Graph / X) NO depende del idioma del visitante.
//
//   npm run test:e2e     (necesita `npm run start` en localhost:3000)
//
// El fallo que motiva esta suite: `generateMetadata` sacaba el título y la
// descripción de `getServerT()`. El rastreador de X no manda cookie ni
// `Accept-Language`, así que `getServerLang()` caía en el idioma por defecto
// —español— y la tarjeta salía en español para todo el mundo, incluida la gente
// que llegaba en inglés.
//
// Se prueba el COMPORTAMIENTO, no las constantes: se pide la home en los dos
// idiomas, por cabecera y por cookie, y se comprueba que las etiquetas sociales
// salen idénticas. Y a la vez que el <title> SÍ sigue cambiando, porque fijar
// la tarjeta no podía llevarse por delante el idioma de la app.

import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

/** Lee una etiqueta <meta> por `property` o por `name`. */
const meta = (page, key) =>
  page.evaluate((k) => {
    const el =
      document.querySelector(`meta[property="${k}"]`) ??
      document.querySelector(`meta[name="${k}"]`);
    return el ? el.getAttribute("content") : null;
  }, key);

const SOCIAL_KEYS = [
  "og:title",
  "og:description",
  "twitter:title",
  "twitter:description",
];

/** Carga la home con un idioma dado y devuelve todo lo que hay que comparar. */
const load = async (browser, { locale, cookieLang }) => {
  const ctx = await browser.newContext({ locale });
  if (cookieLang) {
    await ctx.addCookies([
      {
        name: "typerush_lang",
        value: cookieLang,
        domain: "localhost",
        path: "/",
      },
    ]);
  }
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  const social = {};
  for (const k of SOCIAL_KEYS) social[k] = await meta(page, k);

  const out = {
    social,
    card: await meta(page, "twitter:card"),
    ogImage: await meta(page, "og:image"),
    twImage: await meta(page, "twitter:image"),
    width: await meta(page, "og:image:width"),
    height: await meta(page, "og:image:height"),
    title: await page.title(),
    description: await meta(page, "description"),
    htmlLang: await page.getAttribute("html", "lang"),
  };
  await ctx.close();
  return out;
};

const run = async () => {
  const browser = await chromium.launch();

  const es = await load(browser, { locale: "es-CO" });
  const en = await load(browser, { locale: "en-US" });
  // El rastreador real no manda ninguna de las dos señales. Playwright siempre
  // manda `Accept-Language`, así que este caso se cubre por el lado opuesto: una
  // cookie en español, que es la señal MÁS fuerte que hay. Si ni siquiera esa
  // mueve la tarjeta, un bot sin señal ninguna tampoco.
  const cookieEs = await load(browser, { locale: "en-US", cookieLang: "es" });

  /* ---- La tarjeta es la misma en los tres casos ---- */
  for (const k of SOCIAL_KEYS) {
    check(
      `${k} no cambia entre ES y EN`,
      es.social[k] === en.social[k] && es.social[k] === cookieEs.social[k],
      `es=${JSON.stringify(es.social[k])} en=${JSON.stringify(en.social[k])} cookie=${JSON.stringify(cookieEs.social[k])}`,
    );
    check(`${k} no está vacío`, Boolean(es.social[k]));
  }

  /* ---- Y está en inglés, no en español ---- */
  check(
    "og:title es el título social en inglés",
    es.social["og:title"] === "TypeRush — Fast Typing. Daily Rewards.",
    es.social["og:title"] ?? "(ausente)",
  );
  check(
    "og:description menciona las carreras y los premios en USDT",
    /45-second/.test(es.social["og:description"] ?? "") &&
      /USDT/.test(es.social["og:description"] ?? ""),
    es.social["og:description"] ?? "(ausente)",
  );
  check(
    "la tarjeta NO cae al español ni pidiéndola en español",
    !/mecanograf|Escribe contra el reloj/i.test(
      `${es.social["og:title"]} ${es.social["og:description"]}`,
    ),
  );

  /* ---- Lo que la tarjeta necesita para pintarse grande ---- */
  check("twitter:card es summary_large_image", es.card === "summary_large_image", String(es.card));
  check("og:image existe y es absoluta", /^https?:\/\//.test(es.ogImage ?? ""), String(es.ogImage));
  check("twitter:image existe y es absoluta", /^https?:\/\//.test(es.twImage ?? ""), String(es.twImage));
  check("og:image mide 1200x630", es.width === "1200" && es.height === "630", `${es.width}x${es.height}`);

  /* ---- Las dos imágenes se sirven de verdad, EN ESTE build ---- */
  // ⚠️ `og:image` es absoluta sobre `metadataBase` (typerush.fun), así que hay
  // que reapuntarla a localhost o la prueba comprobaría producción y daría
  // verde aunque este build estuviera roto. Se comprueban las DOS rutas:
  // `twitter-image` reexporta a `opengraph-image`, y ese reexport podría
  // romperse sin que `opengraph-image` se entere.
  for (const [name, absolute] of [
    ["og:image", es.ogImage],
    ["twitter:image", es.twImage],
  ]) {
    const local = new URL(absolute);
    const res = await fetch(`${BASE}${local.pathname}${local.search}`, {
      redirect: "manual",
    });
    const bytes = (await res.arrayBuffer()).byteLength;
    check(`${name}: responde 200 en este build`, res.status === 200, `http=${res.status}`);
    check(
      `${name}: es PNG`,
      (res.headers.get("content-type") ?? "").includes("image/png"),
      String(res.headers.get("content-type")),
    );
    check(`${name}: no viene vacía`, bytes > 10_000, `${bytes} bytes`);
  }

  /* ---- Fijar la tarjeta NO se llevó por delante el idioma de la app ---- */
  check(
    "el <title> SIGUE dependiendo del idioma",
    es.title !== en.title,
    `es=${JSON.stringify(es.title)} en=${JSON.stringify(en.title)}`,
  );
  check(
    "la meta description SIGUE dependiendo del idioma",
    es.description !== en.description,
  );
  check("html lang=es con Accept-Language español", es.htmlLang === "es", String(es.htmlLang));
  check("html lang=en con Accept-Language inglés", en.htmlLang === "en", String(en.htmlLang));
  check(
    "la cookie sigue mandando sobre la cabecera",
    cookieEs.htmlLang === "es",
    String(cookieEs.htmlLang),
  );

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - bad.length}/${results.length} OK ===`);
  if (bad.length) process.exit(1);
};

run();
