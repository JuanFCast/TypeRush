/**
 * ¿El dispositivo tiene pantalla táctil? Decide si hace falta pedir un toque
 * explícito para abrir el teclado antes del 3·2·1 (móvil/MiniPay) o si se
 * puede seguir como en escritorio.
 *
 * Deliberadamente NO usa `@media (hover: none)`: en MiniPay real esa media
 * feature no siempre coincide con lo esperado (el WebView puede reportar
 * `hover: hover` en un dispositivo táctil), así que una condición CSS-only
 * dejaba el aviso de respaldo sin mostrarse nunca. `ontouchstart`/
 * `maxTouchPoints` son señales del propio navegador sobre el hardware, no de
 * la hoja de estilos.
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
