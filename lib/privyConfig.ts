/**
 * Configuración de Privy que necesitan tanto el cliente como el servidor.
 *
 * TypeRush arranca y funciona SIN Privy: sin `NEXT_PUBLIC_PRIVY_APP_ID` no se
 * monta el proveedor y la app queda con wallets externas y MiniPay, que no
 * necesitan Privy para nada. Eso permite compilar, probar y desplegar antes de
 * tener las credenciales, en vez de dejar el proyecto bloqueado esperándolas.
 */

export const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();

/** ¿Hay App ID de Privy? Si no, el login por correo simplemente no se ofrece. */
export function isPrivyConfigured(): boolean {
  return PRIVY_APP_ID.length > 0;
}
