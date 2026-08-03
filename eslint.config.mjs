import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno Edge Function (npm: imports + Deno global): no es del proyecto Next.
    "supabase/functions/**",
    // Foundry: dependencias y artefactos de compilación de los contratos. No es
    // código nuestro ni del proyecto Next (OpenZeppelin trae JS que dispara
    // cientos de errores ajenos). El .sol no lo mira ESLint de todos modos.
    "contracts/lib/**",
    "contracts/out/**",
    "contracts/cache/**",
    "contracts/broadcast/**",
  ]),
]);

export default eslintConfig;
