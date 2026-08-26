/**
 * Textos legales: términos de servicio y política de privacidad.
 *
 * Viven aquí y no en `lib/i18n/dictionary.ts` por tamaño: son párrafos largos
 * y el diccionario es una tabla de rótulos cortos. El idioma se resuelve igual
 * que en el resto de la app (`getServerLang()`), y la paridad es/en la
 * garantiza el compilador exactamente igual que allí: `Record<Lang, LegalDoc>`
 * no compila si falta un idioma, y las secciones se comprueban una a una.
 *
 * ⚠️ Todo lo que se afirma aquí está tomado del código, no de una plantilla:
 * los 45 segundos de `lib/game.ts`, la entrada y el reparto del contrato
 * (`protocolBps` = 2000 → 20 % protocolo / 80 % pozo), el cierre a las 7 p. m.
 * de `lib/gamePeriod.ts`, las claves de `localStorage` que de verdad se
 * escriben y las columnas que de verdad se insertan en Supabase. Si el juego
 * cambia, estos textos cambian con él.
 */

import type { Lang } from "./i18n";
import { GAMEV3_ADDRESS } from "./contractsV3";

/** Correo oficial de contacto de Casgo Studio. Aparece en los dos documentos y
 *  es el soporte de respaldo mientras no haya grupo de Telegram. */
export const SUPPORT_EMAIL = "hi@casgostudio.com";

/**
 * ⚠️ PENDIENTE: enlace de invitación al grupo privado de Telegram de soporte.
 *
 * El canal principal de soporte va a ser Telegram, no el correo. Mientras esta
 * constante esté vacía, Perfil enseña el correo — así la app nunca se queda sin
 * el enlace de soporte que MiniPay exige, y nadie ve un enlace roto.
 *
 * Para activarlo basta con pegar aquí el enlace `https://t.me/+…`: la fila de
 * Telegram aparece sola y el correo pasa a segundo plano. No poner una URL
 * inventada — un enlace de soporte que no lleva a ninguna parte es peor que no
 * tenerlo, y es justo lo que un revisor de MiniPay comprueba.
 *
 * ⚠️ Al activarlo hay trabajo pendiente además de pegar la URL: dentro del
 * WebView de MiniPay el enlace NO puede pedir ventana nueva (`target="_blank"`
 * / `window.open`), porque Android sin `setSupportMultipleWindows` responde con
 * una página de error — a Freaking Grammar se lo reportó un revisor de MiniPay
 * con este mismo enlace de Telegram. Hay que navegar el propio marco y dejar el
 * enlace copiable como respaldo.
 */
export const SUPPORT_TELEGRAM_URL = "";

/** ¿Hay grupo de Telegram configurado? Un solo sitio decide, para que Perfil y
 *  cualquier futuro modal no puedan discrepar. */
export function hasTelegramSupport(): boolean {
  return SUPPORT_TELEGRAM_URL.startsWith("https://t.me/");
}

/** Quién opera el servicio. No es MiniPay, ni Opera, ni Celo. */
export const OPERATOR_NAME = "Casgo Studio";

/** Última revisión de los dos documentos. Se muestra al pie de cada uno. */
export const LEGAL_UPDATED = "2026-08-25";

export interface LegalSection {
  heading: string;
  /** Párrafos. Se pintan en orden, uno por `<p>`. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  /** Frase de entrada, antes de la primera sección. */
  lead: string;
  sections: LegalSection[];
}

/** Dirección del contrato con el que se juega, para citarla en los términos. */
const CONTRACT = GAMEV3_ADDRESS || "0xD8287809e0D68E7e50D0D962f11Eb72150F48d39";

export const TERMS: Record<Lang, LegalDoc> = {
  es: {
    title: "Términos de servicio",
    lead: `Estas condiciones rigen el uso de TypeRush. Al jugar una carrera las aceptas. Están escritas para que se entiendan: si algo no queda claro, escríbenos a ${SUPPORT_EMAIL}.`,
    sections: [
      {
        heading: "1. Quién opera TypeRush",
        body: [
          `TypeRush lo desarrolla y opera ${OPERATOR_NAME}. Es un servicio independiente: no lo operan MiniPay, Opera, Celo ni ninguna otra empresa, aunque la app se pueda abrir desde la billetera MiniPay y funcione sobre la red Celo.`,
          `Puedes contactarnos en ${SUPPORT_EMAIL}. Nos comprometemos a corregir las incidencias críticas reportadas dentro de las 24 horas siguientes a su reporte.`,
        ],
      },
      {
        heading: "2. Qué es TypeRush",
        body: [
          "TypeRush es un juego de habilidad. Escribes un texto contra un reloj de 45 segundos y se mide tu velocidad (palabras por minuto), tu precisión, tus errores y tu avance en el pasaje. De esos cuatro valores sale un puntaje.",
          "No es un juego de azar: no hay sorteo ni intervención de la suerte en el resultado. Gana quien teclea mejor.",
          "El texto que tecleas lo entrega nuestro servidor y el puntaje lo recalcula el servidor contra ese mismo texto. El puntaje que cuenta para la clasificación es el del servidor, no el que muestre tu teléfono.",
        ],
      },
      {
        heading: "3. Modalidades, retos y ronda diaria",
        body: [
          "Hay dos modalidades según el idioma del texto que se teclea: español e inglés. Cada una lleva su propia clasificación y su propio premio, y son independientes del idioma en el que leas la app.",
          "La ronda diaria abre y cierra a las 7:00 p. m., hora de Colombia. La ronda a la que pertenece cada carrera la decide el contrato, no el reloj de tu teléfono.",
        ],
      },
      {
        heading: "4. Qué cuesta jugar",
        body: [
          "Cada carrera es una transacción que firmas tú en la red Celo. Sin esa firma no hay carrera.",
          "La primera carrera del día en cada modalidad la marca el contrato como sin costo de entrada. Aun así, como toda transacción, paga una comisión de red: dentro de MiniPay esa comisión se cobra en USDT, no en CELO.",
          "Cuando ya usaste la carrera sin costo del día, la entrada de la siguiente es de 0,10 USDT. El precio lo fija el contrato; la app solo lo muestra.",
          "De cada entrada pagada, el 80 % entra al pozo del día de esa modalidad y el 20 % queda como comisión del protocolo. Ese reparto está escrito en el contrato y no lo decide la app.",
          "Para poder cobrar la entrada, tu billetera te pedirá autorizar el token. La autorización que solicitamos está acotada al equivalente de diez entradas: nunca pedimos una autorización ilimitada.",
        ],
      },
      {
        heading: "5. El premio",
        body: [
          "Al cerrar la ronda, quien tenga el puntaje más alto de cada modalidad gana el pozo completo de esa modalidad.",
          "El pago lo hace el propio contrato enviando el premio a la billetera ganadora. No hay que reclamarlo ni hacer ningún trámite. El contrato solo puede pagar a una billetera que efectivamente jugó esa ronda.",
          "Si en una ronda no jugó nadie, el pozo no se reparte: pasa intacto a la ronda siguiente.",
          "Los premios se pagan en USDT sobre la red Celo. No pagamos en efectivo ni por transferencia bancaria, y no convertimos el premio a ninguna otra moneda.",
        ],
      },
      {
        heading: "6. Tu billetera y tus fondos",
        body: [
          "Nunca custodiamos tus fondos ni tenemos acceso a tus claves privadas. Todo movimiento sale de una transacción que firmas tú.",
          "Eres responsable de tu billetera y de mantener el acceso a ella. Si pierdes el acceso, no podemos recuperar tus fondos ni tus premios, porque nunca los tuvimos.",
          "Las transacciones en Celo son irreversibles. Una entrada que ya se cobró en la cadena no se puede deshacer, tampoco por nosotros.",
        ],
      },
      {
        heading: "7. Cancelar la cuenta atrás no devuelve la entrada",
        body: [
          "La entrada se cobra cuando firmas, no cuando terminas de escribir. Si sales de la app, cierras la pantalla o cancelas durante la cuenta atrás, la cadena ya cobró esa carrera y no hay devolución.",
          "Lo mismo aplica si tu carrera no llega a producir un resultado por un fallo de red o del dispositivo. Preferimos decírtelo antes que dejarte creer que hay un reintento gratis.",
        ],
      },
      {
        heading: "8. Uso correcto",
        body: [
          "TypeRush es para personas escribiendo. No está permitido usar programas, scripts, macros ni ningún tipo de automatización para jugar o para producir resultados.",
          "Tampoco está permitido intentar manipular la clasificación, los premios o el contrato por medios distintos a jugar.",
          "Podemos anular resultados obtenidos así y dejar de atender a quien lo haga. No podemos, en cambio, revertir lo que ya ocurrió en la cadena.",
        ],
      },
      {
        heading: "9. Requisitos para jugar",
        body: [
          "Para usar TypeRush debes tener al menos 18 años o haber alcanzado la mayoría de edad conforme a las leyes de tu país de residencia.",
          "Juegas en tu propio nombre, con una billetera que controles tú.",
          "Es tu responsabilidad comprobar que participar en TypeRush es legal donde vives.",
        ],
      },
      {
        heading: "10. Disponibilidad y límites",
        body: [
          "TypeRush depende de la red Celo, del contrato, de nodos públicos de la red y de servicios de terceros para funcionar. Cualquiera de ellos puede fallar o dejar de estar disponible, y entonces la app no funcionará.",
          "Ofrecemos el juego tal como está. No garantizamos que esté disponible sin interrupciones ni que esté libre de errores.",
          "Hasta donde lo permita la ley, no respondemos por pérdidas derivadas de fallos de la red, de tu billetera, de tu dispositivo o de servicios de terceros. Lo que sí hacemos es corregir lo que esté en nuestra mano y contarlo.",
        ],
      },
      {
        heading: "11. Cambios",
        body: [
          "Podemos cambiar el juego, los precios de entrada, el horario de cierre o estos términos. Cuando el cambio afecte lo que pagas o lo que ganas, lo reflejaremos en la app.",
          `El contrato con el que se juega hoy es ${CONTRACT}, en la red Celo, y su código es público y verificado. Un cambio en las reglas de dinero exige desplegar otro contrato, que también sería público.`,
        ],
      },
      {
        heading: "12. Contacto",
        body: [
          `Para dudas, reclamos o incidencias: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    lead: `These terms govern your use of TypeRush. By playing a race you accept them. They are written to be understood: if anything is unclear, write to us at ${SUPPORT_EMAIL}.`,
    sections: [
      {
        heading: "1. Who runs TypeRush",
        body: [
          `TypeRush is built and operated by ${OPERATOR_NAME}. It is an independent service: it is not operated by MiniPay, Opera, Celo or anyone else, even though the app can be opened from the MiniPay wallet and runs on the Celo network.`,
          `You can reach us at ${SUPPORT_EMAIL}. We are committed to fixing reported critical issues within 24 hours of the report.`,
        ],
      },
      {
        heading: "2. What TypeRush is",
        body: [
          "TypeRush is a game of skill. You type a passage against a 45-second clock, and we measure your speed (words per minute), your accuracy, your mistakes and how far you got through the passage. Those four values produce a score.",
          "It is not a game of chance: there is no draw and luck plays no part in the result. Whoever types best wins.",
          "The passage you type is issued by our server, and your score is recomputed by the server against that same passage. The score that counts for the ranking is the server's, not the one your phone displays.",
        ],
      },
      {
        heading: "3. Modes, challenges and the daily round",
        body: [
          "There are two modes, by the language of the text you type: Spanish and English. Each has its own ranking and its own prize, and both are independent of the language you read the app in.",
          "The daily round opens and closes at 7:00 p.m., Colombia time. Which round a race belongs to is decided by the contract, never by your phone's clock.",
        ],
      },
      {
        heading: "4. What it costs to play",
        body: [
          "Every race is a transaction that you sign on the Celo network. Without that signature there is no race.",
          "The first race of the day in each mode is marked by the contract as having no entry fee. It still pays a network fee, like any transaction: inside MiniPay that fee is charged in USDT, not in CELO.",
          "Once you have used the day's free race, the entry for the next one is 0.10 USDT. The price is set by the contract; the app only displays it.",
          "Of every paid entry, 80% goes into that mode's prize pool for the day and 20% is kept as a protocol fee. That split is written into the contract and is not decided by the app.",
          "To be able to charge the entry, your wallet will ask you to approve the token. The approval we request is capped at the equivalent of ten entries: we never ask for an unlimited approval.",
        ],
      },
      {
        heading: "5. The prize",
        body: [
          "When the round closes, whoever has the highest score in each mode wins that mode's entire pool.",
          "The contract itself sends the prize to the winning wallet. There is nothing to claim and no paperwork. The contract can only pay a wallet that actually played that round.",
          "If nobody played a round, the pool is not paid out: it rolls forward untouched into the next round.",
          "Prizes are paid in USDT on the Celo network. We do not pay in cash or by bank transfer, and we do not convert the prize into any other currency.",
        ],
      },
      {
        heading: "6. Your wallet and your funds",
        body: [
          "We never hold your funds and we never have access to your private keys. Every movement comes from a transaction you sign.",
          "You are responsible for your wallet and for keeping access to it. If you lose access we cannot recover your funds or your prizes, because we never held them.",
          "Transactions on Celo are irreversible. An entry already charged on-chain cannot be undone, not even by us.",
        ],
      },
      {
        heading: "7. Cancelling the countdown does not refund the entry",
        body: [
          "The entry is charged when you sign, not when you finish typing. If you leave the app, close the screen or cancel during the countdown, the chain has already charged that race and there is no refund.",
          "The same applies if your race never produces a result because of a network or device failure. We would rather tell you up front than let you believe there is a free retry.",
        ],
      },
      {
        heading: "8. Fair use",
        body: [
          "TypeRush is for people typing. Using programs, scripts, macros or any kind of automation to play or to produce results is not allowed.",
          "Nor is attempting to manipulate the ranking, the prizes or the contract by any means other than playing.",
          "We can void results obtained that way and stop serving whoever does it. What we cannot do is reverse what already happened on-chain.",
        ],
      },
      {
        heading: "9. Who can play",
        body: [
          "To use TypeRush you must be at least 18 years old, or have reached the age of majority under the laws of your country of residence.",
          "You play as yourself, with a wallet you control.",
          "It is your responsibility to check that taking part in TypeRush is legal where you live.",
        ],
      },
      {
        heading: "10. Availability and limits",
        body: [
          "TypeRush depends on the Celo network, on the contract, on public network nodes and on third-party services to work. Any of them can fail or become unavailable, and then the app will not work.",
          "We offer the game as it is. We do not guarantee uninterrupted availability or that it is free of errors.",
          "To the extent the law allows, we are not liable for losses caused by failures of the network, your wallet, your device or third-party services. What we do is fix what is within our reach and say so.",
        ],
      },
      {
        heading: "11. Changes",
        body: [
          "We may change the game, the entry prices, the closing time or these terms. When a change affects what you pay or what you win, it will be reflected in the app.",
          `The contract the game runs on today is ${CONTRACT}, on the Celo network, and its source code is public and verified. Changing the money rules requires deploying another contract, which would also be public.`,
        ],
      },
      {
        heading: "12. Contact",
        body: [`For questions, complaints or incidents: ${SUPPORT_EMAIL}.`],
      },
    ],
  },
};

export const PRIVACY: Record<Lang, LegalDoc> = {
  es: {
    title: "Política de privacidad",
    lead: "Esta página dice exactamente qué guarda TypeRush, dónde lo guarda y qué es público. No hay publicidad, no hay analítica de terceros y no vendemos nada de esto.",
    sections: [
      {
        heading: "1. Quién trata tus datos",
        body: [
          `${OPERATOR_NAME} es responsable del tratamiento de los datos descritos aquí. Contacto: ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: "2. Lo que se guarda en tu dispositivo",
        body: [
          "TypeRush usa el almacenamiento local de tu navegador y una sola cookie. Nada de esto sale de tu aparato salvo la cookie de idioma, que se envía a nuestro servidor para que la primera pantalla ya venga traducida.",
          "Cookie «typerush_lang»: el idioma en el que lees la app.",
          "«typerush.lang.v1»: copia del idioma, porque la vista web de MiniPay no siempre conserva las cookies.",
          "«typerush.player.id» y «typerush.player.name»: un identificador local y el alias que elegiste.",
          "«typerush.best.v3.<reto>»: tu mejor puntaje en cada reto.",
          "«typerush.history.v1»: tus últimas partidas, para el historial de este aparato.",
          "«typerush.howto.v1»: si ya viste el tutorial, para no volver a abrirlo solo.",
          "«typerush.sound.v1»: si tienes el sonido activado.",
          "«typerush.wallet.session.v1»: el testigo de sesión de tu billetera y su fecha de caducidad.",
          "Puedes borrar todo esto vaciando los datos del sitio en tu navegador. Perderás tu historial local y tus marcas; lo que esté en la cadena o en nuestros servidores no se borra con eso.",
        ],
      },
      {
        heading: "3. Lo que se guarda en nuestros servidores",
        body: [
          "Usamos Supabase como base de datos. Lo que guardamos es esto y nada más:",
          "Perfil: un identificador aleatorio, tu alias, la dirección de tu billetera y, si entraste con correo, el identificador que nos da Privy.",
          "Partidas: el hash de la transacción, tu billetera, la ronda, la modalidad, si fue gratis o pagada, el token de la entrada y el texto que te entregamos para teclear.",
          "Resultados: el hash de la transacción, tu billetera, la ronda, la modalidad, el reto, tus palabras por minuto, tu precisión, tus errores y tu puntaje.",
          "Liquidaciones: qué billetera ganó cada ronda, con qué puntaje, cuánto se pagó y el hash del pago.",
          "Si entras con correo y te creamos una billetera, guardamos además el registro del envío inicial para la comisión de red: la dirección, el identificador de Privy, tu correo, el importe, el hash y un resumen criptográfico (hash) de tu dirección IP. La dirección IP en claro nunca se guarda; el hash solo sirve para impedir que una misma conexión reclame ese envío muchas veces.",
        ],
      },
      {
        heading: "4. Lo que es público",
        body: [
          "Todo lo que ocurre en la red Celo es público por naturaleza: tu billetera, tus transacciones, las entradas que pagaste y los premios que cobraste son visibles para cualquiera en un explorador de bloques. Eso no lo publicamos nosotros y tampoco lo podemos ocultar.",
          "Dentro de la app, la clasificación muestra tu alias. Si no pusiste alias, se muestra tu dirección abreviada (por ejemplo 0x1234…abcd).",
          "La página de estadísticas del juego solo publica cifras agregadas. No publica billeteras, ni alias, ni listas de jugadores, ni filas individuales.",
        ],
      },
      {
        heading: "5. Con quién se comparte",
        body: [
          "No vendemos ni cedemos tus datos. Solo intervienen los servicios necesarios para que la app funcione:",
          "Vercel, que aloja la app y sirve las páginas.",
          "Supabase, que aloja la base de datos descrita arriba.",
          "Privy, solo si entras con correo o usas la billetera que crea: gestiona ese acceso.",
          "Nodos públicos de la red Celo, a los que la app consulta el estado del contrato.",
          "WalletConnect y RainbowKit, solo cuando conectas una billetera externa fuera de MiniPay.",
          "Celoscan y Blockscout, únicamente como destino de los enlaces «ver en el explorador».",
          "No usamos herramientas de analítica, de publicidad ni de seguimiento entre sitios.",
        ],
      },
      {
        heading: "6. Cuánto tiempo se conserva",
        body: [
          "Los resultados y las liquidaciones se conservan mientras el juego exista: son lo que sostiene la clasificación, el historial de ganadores y la comprobación de los pagos.",
          "Lo que está escrito en la red Celo es permanente y nadie puede borrarlo, ni tú ni nosotros.",
        ],
      },
      {
        heading: "7. Tus opciones",
        body: [
          "Puedes jugar sin poner alias: en ese caso aparecerás con tu dirección abreviada.",
          "Puedes borrar en cualquier momento lo que TypeRush guarda en tu dispositivo, vaciando los datos del sitio.",
          `Puedes pedirnos que borremos tu alias y tu perfil escribiendo a ${SUPPORT_EMAIL}. Conservaremos los resultados y las liquidaciones asociados a tu billetera, porque sin ellos la clasificación y los premios ya pagados dejarían de cuadrar, y porque en la cadena siguen estando de todos modos.`,
        ],
      },
      {
        heading: "8. Menores",
        body: [
          "TypeRush no está dirigido a menores de 18 años, ni a quienes no hayan alcanzado la mayoría de edad conforme a las leyes de su país de residencia, y no recogemos datos a sabiendas de ellos.",
        ],
      },
      {
        heading: "9. Cambios y contacto",
        body: [
          "Si cambiamos lo que guardamos, actualizaremos esta página y su fecha de revisión.",
          `Para cualquier asunto sobre tus datos: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    lead: "This page says exactly what TypeRush stores, where it stores it and what is public. There are no ads, no third-party analytics, and we sell none of it.",
    sections: [
      {
        heading: "1. Who handles your data",
        body: [
          `${OPERATOR_NAME} is responsible for the data described here. Contact: ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: "2. What is stored on your device",
        body: [
          "TypeRush uses your browser's local storage and a single cookie. None of it leaves your device except the language cookie, which is sent to our server so the first screen already arrives translated.",
          "Cookie “typerush_lang”: the language you read the app in.",
          "“typerush.lang.v1”: a copy of the language, because the MiniPay web view does not always keep cookies.",
          "“typerush.player.id” and “typerush.player.name”: a local identifier and the alias you chose.",
          "“typerush.best.v3.<challenge>”: your best score on each challenge.",
          "“typerush.history.v1”: your recent races, for this device's history.",
          "“typerush.howto.v1”: whether you have seen the tutorial, so it does not open again on its own.",
          "“typerush.sound.v1”: whether sound is on.",
          "“typerush.wallet.session.v1”: your wallet session token and its expiry.",
          "You can delete all of this by clearing site data in your browser. You will lose your local history and your personal bests; what is on-chain or on our servers is not deleted by that.",
        ],
      },
      {
        heading: "3. What is stored on our servers",
        body: [
          "We use Supabase as our database. What we store is this and nothing else:",
          "Profile: a random identifier, your alias, your wallet address and, if you signed in with email, the identifier Privy gives us.",
          "Plays: the transaction hash, your wallet, the round, the mode, whether it was free or paid, the entry token and the passage we issued you to type.",
          "Results: the transaction hash, your wallet, the round, the mode, the challenge, your words per minute, your accuracy, your mistakes and your score.",
          "Settlements: which wallet won each round, with what score, how much was paid and the payment hash.",
          "If you sign in with email and we create a wallet for you, we also store the record of the initial network-fee transfer: the address, the Privy identifier, your email, the amount, the hash and a cryptographic digest (hash) of your IP address. The raw IP address is never stored; the hash only exists to stop one connection from claiming that transfer many times.",
        ],
      },
      {
        heading: "4. What is public",
        body: [
          "Everything that happens on the Celo network is public by nature: your wallet, your transactions, the entries you paid and the prizes you received are visible to anyone in a block explorer. We do not publish that and we cannot hide it either.",
          "Inside the app, the ranking shows your alias. If you did not set one, it shows your shortened address (for example 0x1234…abcd).",
          "The game's statistics page publishes aggregate figures only. It publishes no wallets, no aliases, no player lists and no individual rows.",
        ],
      },
      {
        heading: "5. Who it is shared with",
        body: [
          "We do not sell or hand over your data. Only the services needed for the app to work are involved:",
          "Vercel, which hosts the app and serves the pages.",
          "Supabase, which hosts the database described above.",
          "Privy, only if you sign in with email or use the wallet it creates: it manages that access.",
          "Public Celo network nodes, which the app queries for the contract's state.",
          "WalletConnect and RainbowKit, only when you connect an external wallet outside MiniPay.",
          "Celoscan and Blockscout, purely as the destination of the “view on the explorer” links.",
          "We use no analytics, advertising or cross-site tracking tools.",
        ],
      },
      {
        heading: "6. How long it is kept",
        body: [
          "Results and settlements are kept for as long as the game exists: they are what holds up the ranking, the winners' history and the verification of payments.",
          "What is written on the Celo network is permanent and nobody can delete it, neither you nor us.",
        ],
      },
      {
        heading: "7. Your choices",
        body: [
          "You can play without setting an alias: you will then appear as your shortened address.",
          "You can delete what TypeRush stores on your device at any time by clearing site data.",
          `You can ask us to delete your alias and your profile by writing to ${SUPPORT_EMAIL}. We will keep the results and settlements tied to your wallet, because without them the ranking and the prizes already paid would stop adding up, and because they remain on-chain regardless.`,
        ],
      },
      {
        heading: "8. Minors",
        body: [
          "TypeRush is not aimed at anyone under 18, or at anyone who has not reached the age of majority under the laws of their country of residence, and we do not knowingly collect data from them.",
        ],
      },
      {
        heading: "9. Changes and contact",
        body: [
          "If we change what we store, we will update this page and its revision date.",
          `For anything about your data: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
};
