/**
 * Todos los textos visibles de TypeRush, en español e inglés.
 *
 * El español es la base: `es` define las claves y `en` está obligado por el
 * tipo a traducirlas todas, así que una clave nueva sin traducir NO compila.
 *
 * Interpolación: `{nombre}` se reemplaza con lo que pase el llamador.
 *
 * Las claves `error.*` son especiales: las devuelven las funciones de `lib/`
 * (wallet, pagos, perfil) en vez de una frase hecha, para que el mensaje se
 * traduzca al idioma activo en el momento de pintarlo. Ver `isMessageKey`.
 */

export const es = {
  /* ------------------------------- Comunes ------------------------------- */
  "common.loading": "Cargando…",
  "common.cancel": "Cancelar",
  "common.checking": "Verificando…",
  "common.calculating": "Calculando…",

  /* ------------------------------ Metadata ------------------------------- */
  "meta.title": "TypeRush — carrera de mecanografía",
  "meta.description":
    "Escribe contra el reloj durante 45 segundos. Mide tu WPM, precisión y supera tu récord.",

  /* ------------------------------- Idioma -------------------------------- */
  "lang.aria": "Idioma de la aplicación",
  "lang.label": "Idioma",

  /* ------------------------- Cabecera / navegación ----------------------- */
  "header.tagline": "carrera de 45s",
  "nav.home": "Inicio",
  "nav.ranking": "Ranking",
  "nav.history": "Historial",
  "nav.you": "Tú",
  "sound.mute": "Silenciar sonidos",
  "sound.unmute": "Activar sonidos",

  /* ------------------------ Modalidades y retos -------------------------- */
  // Nombre del idioma que se TECLEA en cada modalidad (no el de la interfaz).
  "mode.es": "Español",
  "mode.en": "Inglés",
  "mode.es.description": "Motivación, noticias y stablecoins en español.",
  "mode.en.description": "Motivación e inglés cotidiano.",
  "challenge.motivacionEs.title": "Motivación",
  "challenge.motivacionEs.description": "Frases para darte impulso.",
  "challenge.noticiasEs.title": "Noticias",
  "challenge.noticiasEs.description": "Datos y avances del mundo.",
  "challenge.cryptoEs.title": "Stablecoins",
  "challenge.cryptoEs.description": "El mundo de las monedas digitales.",
  "challenge.motivationEn.title": "Motivación",
  "challenge.motivationEn.description": "Frases para no rendirte.",
  "challenge.dailyEn.title": "Inglés diario",
  "challenge.dailyEn.description": "Inglés de todos los días.",

  /* ------------------------------- Monedas ------------------------------- */
  "currency.usdt.sub": "dólares",
  "currency.copm.sub": "pesos",

  /* ------------------------------- Portada ------------------------------- */
  "home.badge.mainnet": "Celo Mainnet",
  "home.badge.minipay": "MiniPay",
  "home.badge.prizes": "Premios diarios",
  "home.title.line1": "Escribe rápido.",
  "home.title.line2": "Sube al ranking.",
  "home.title.line3": "Gana en Celo.",
  "home.sub.loading": "Carreras de {seconds} segundos",
  "home.sub.paid": "Carreras de {seconds} segundos · entrada 0,10 USDT",
  "home.sub.free": "Carreras de {seconds} segundos · primer intento gratis",
  "home.prize.title": "Premio real de hoy · el #1 se lo lleva todo",
  "home.prize.close": "Cierre diario 7:00 p. m. (Colombia)",
  "home.prize.remaining": "quedan {time}",
  "home.free_used": "Intento gratis utilizado",
  "home.cta.free": "Jugar gratis",
  "home.cta.paid": "Jugar por 0,10 USDT",
  "home.note.free_used":
    "Tu intento gratis ya fue utilizado. Las siguientes carreras cuestan 0,10 USDT.",
  "home.note.default":
    "Sin registro: eliges alias y corres. Luego, entradas desde 0,10 USDT.",

  /* -------------------- Vista previa animada (RaceDemo) ------------------ */
  "demo.sentence":
    "La velocidad se entrena: una carrera a la vez y cada error corregido suma.",
  "demo.reduced": "Vista previa estática (movimiento reducido activado)",

  /* --------------------------- Pantalla de carrera ----------------------- */
  "race.time": "Tiempo",
  "race.wpm": "WPM",
  "race.accuracy": "Precisión",
  "race.errors": "Errores",
  "race.corrections_short": "Correc.",
  "race.input_label": "Campo de escritura",
  "race.tap_to_type": "Toca el texto para empezar a escribir",

  /* ------------------------------- Lobby --------------------------------- */
  "lobby.back": "Volver a los modos",
  "lobby.prize": "Premio para el #1",
  "lobby.win_both": "gana los dos",
  "lobby.play_free": "Jugar gratis",
  "lobby.next_free": "Próximo gratis en {time}",
  "lobby.paying": "Procesando pago…",
  "lobby.free_used": "Usaste tu tiro gratis. Elige moneda:",
  "lobby.pay": "Pagar {amount} {symbol}",
  "lobby.and_play": "y jugar",
  "card.selected": "Elegido",
  "card.your_best": "Tu mejor puntaje",
  "card.no_score": "Aún no tienes puntaje",

  /* ------------------- Tarjeta del reto diario (Jugar) ------------------- */
  "play.tag": "Reto diario",
  "play.title": "Carrera de {seconds} segundos",
  "play.support":
    "Escribe el texto exacto antes de que se acabe el tiempo. El puntaje más alto al cierre se lleva el pozo.",
  "play.prize.preparing": "Preparando el premio de hoy…",
  "play.prize.error": "No pudimos leer el premio de hoy.",
  "play.prize.retry": "Reintentar",
  "play.closes_in": "Cierra en {time}",
  "play.mode.label": "Idioma del texto",
  "play.challenge.label": "Reto",
  "play.entry.checking": "Comprobando tu entrada…",
  "play.entry.free": "Tienes tu intento gratis de hoy",
  "play.entry.paid": "Intento gratis usado · entrada {amount}",
  "play.entry.practice": "Partida de práctica, sin premio",
  "play.cta.paid": "Jugar por {amount}",
  "play.howto": "Cómo jugar",
  "entry.title": "¿Con qué quieres pagar?",
  "entry.sub": "Tu entrada entra al pozo de hoy. El #1 al cierre se lo lleva.",
  "entry.choose": "Pagar y jugar",
  "top3.title": "Top 3 de hoy",
  "top3.full": "Ver ranking completo",
  "top3.empty": "Todavía no ha jugado nadie esta ronda. Sé el primero.",

  /* --------------------------- Cómo jugar -------------------------------- */
  "howto.title": "Cómo jugar",
  "howto.close": "Cerrar",
  "howto.got_it": "Entendido",
  "howto.step1": "Elige el idioma del texto y el reto.",
  "howto.step2": "Tienes {seconds} segundos.",
  "howto.step3": "Escribe exactamente el texto que ves.",
  "howto.step4":
    "Los aciertos, los errores y las correcciones se distinguen por color.",
  "howto.step5": "Tu WPM, tu precisión y tu progreso se calculan en vivo.",
  "howto.step6": "Tu mejor resultado válido entra al ranking del día.",

  /* -------------------- Toca para empezar (solo móvil) ------------------- */
  "tapstart.cta": "Toca para empezar",
  "tapstart.hint": "Así se abre el teclado antes de la cuenta regresiva.",

  /* ---------------------------- Cuenta regresiva ------------------------- */
  "countdown.warmup": "Calienta los dedos",
  "countdown.go": "¡YA!",
  "countdown.hint": "Escribe rápido, corrige errores y completa el texto.",
  "countdown.cancel": "Cancelar carrera",

  /* ------------------------------ Resultado ------------------------------ */
  "result.new_best": "¡Nuevo récord!",
  "result.finished": "Carrera terminada",
  "result.wpm_caption": "palabras por minuto",
  "result.corrections": "Correcciones",
  "result.score": "Puntaje",
  "result.best_label": "Mejor puntaje:",
  "result.no_best": "Aún no tienes récord",
  "result.wait": "Mira tu puntaje un momento…",
  "result.back_to_challenges": "Volver al reto",
  "result.play_again": "Jugar otra vez",
  "result.entry_free": "Te queda tu intento gratis de hoy.",
  "result.entry_paid": "La siguiente carrera cuesta {amount}.",
  "result.see_ranking": "Ver el ranking de la ronda",
  "result.back_home": "Volver al inicio",

  /* ------------------------------- Pago ---------------------------------- */
  "paid.confirmed": "¡Pago confirmado!",
  "paid.hint": "Estás en la ronda por el premio. Toca para empezar.",
  "paid.start": "¡Empezar!",
  "pay.step.preparing": "Preparando",
  "pay.step.confirm_wallet": "Confirma en tu wallet",
  "pay.step.confirming_network": "Confirmando en red",
  "pay.title.preparing": "Preparando el pago…",
  "pay.title.approving": "Autoriza el token en tu wallet",
  "pay.title.signing": "Esperando tu confirmación…",
  "pay.title.confirming": "Confirmando la transacción…",
  "pay.hint.wallet": "Aprueba la solicitud en MiniPay.",
  "pay.hint.wait": "Esto tarda solo unos segundos.",

  /* -------------------------- Fondos insuficientes ----------------------- */
  "funds.title": "Necesitas más {symbol}",
  "funds.body": "Para pagar la entrada necesitas {needed} {symbol}.",
  "funds.deposit": "Depositar saldo",
  "funds.send": "Envía {symbol} a tu wallet:",
  "funds.copied": "Copiado",
  "funds.copy": "Copiar",
  "funds.ok": "Entendido",

  /* ------------------------------- Alias --------------------------------- */
  "alias.title": "Elige tu alias",
  "alias.subtitle": "Necesitas un alias para jugar. Así apareces en los rankings.",
  "alias.placeholder": "Tu alias",
  "alias.rules": "Entre 2 y 16 caracteres: letras, números, guion bajo o espacios.",
  "alias.save_and_play": "Guardar y jugar",
  "alias.continue_and_play": "Continuar y jugar",

  /* ------------------------------ Reclamo -------------------------------- */
  "claim.title": "¡Ganaste! Reclama tu premio",
  "claim.claiming": "Reclamando…",
  "claim.claimed": "Premio reclamado",
  "claim.claim": "Reclamar premio",

  /* ------------------------------ Ranking -------------------------------- */
  "ranking.title": "Ranking",
  "ranking.loading": "Cargando ranking…",
  "ranking.error": "No pudimos cargar el ranking ahora.",
  "ranking.top5": "Top 5 · {mode}",
  "ranking.empty": "Aún no hay partidas en este modo en el periodo de hoy.",
  "ranking.period": "Periodo actual (hora Colombia)",
  "ranking.your_position": "Tu posición",
  "ranking.no_score_mode":
    "Aún no tienes puntaje en {mode}. Juega una partida para aparecer aquí.",
  "ranking.you": "Tú",
  "ranking.live": "Ranking de hoy",
  "ranking.live_sub": "Quién va ganando la ronda que cierra esta noche.",
  "ranking.top_n": "Top {count} · {mode}",
  "ranking.see_full": "Ver ranking completo",
  "ranking.retry": "Reintentar",
  "ranking.players": "{count} jugando",
  "ranking.players_one": "1 jugando",
  "ranking.col_player": "Jugador",
  "ranking.anonymous": "Jugador",
  "ranking.col_wpm": "PPM",
  "ranking.col_score": "Puntaje",
  "ranking.mode_filter": "Modalidad",
  "ranking.wallet_missing_leader":
    "Va primero sin wallet vinculada: si la ronda cierra así, el premio se acumula para la siguiente.",
  "ranking.wallet_missing_me":
    "No tienes wallet vinculada. Si ganas, el premio no se te puede pagar: vincúlala desde Perfil para poder recibirlo.",
  "ranking.wallet_link": "Vincular wallet en Perfil",
  "ranking.wallet_missing_badge": "sin wallet",
  "ranking.wallet_ok_badge": "wallet lista",
  "ranking.back_to_play": "Volver a Jugar",

  /* ------------------------------ Historial ------------------------------ */
  "history.title": "Historial",
  "history.lead":
    "Rondas ya cerradas: quién ganó cada día y si el premio se pagó, con su transacción en Celo.",
  "history.clear": "Limpiar",
  "history.clear_confirm": "¿Borrar todo tu historial local?",
  "history.empty": "Aún no tienes partidas. Juega una carrera para ver tu historial.",
  "history.challenge_fallback": "Reto",
  "history.record": "Récord",
  "history.accuracy_short": "Prec.",

  /* ------------------------------ Ganadores ------------------------------ */
  "winners.payout.claimed": "Cobrado",
  "winners.payout.registered": "Por cobrar",
  "winners.payout.rollover": "Pozo acumulado",
  "winners.payout.pending": "Cerrando",
  "winners.error":
    "No pudimos cargar el historial de ganadores ahora. Inténtalo de nuevo en un momento.",
  "winners.empty":
    "Todavía no hay rondas cerradas. La primera aparecerá tras el cierre de las 7:00 p. m. (Colombia).",
  "winners.more": "Ver {count} más",
  "winners.no_winner": "Sin ganador",
  "winners.rolled": "Nadie pudo cobrarlo: el pozo pasó al día siguiente.",
  "winners.tx": "Ver transacción",
  "winners.points": "{score} pts",

  /* -------------------------------- Perfil ------------------------------- */
  "profile.title": "Tu perfil",
  "profile.name_label": "Nombre del jugador",
  "profile.name_hint": "Así aparecerás en los rankings de cada reto.",
  "profile.name_too_short": "El nombre necesita al menos {min} caracteres.",
  "profile.saved": "Guardado",
  "profile.save": "Guardar",
  "profile.local_profile": "Perfil local",
  "profile.language": "Idioma de la app",
  "profile.language_hint":
    "Cambia el idioma de toda la interfaz. Se conserva al navegar y al recargar.",
  "profile.wallet_title": "Wallet para premios",
  "profile.wallet_desc":
    "Es la wallet donde recibes tu premio (USDT y COPm) si quedas #1 del día. En MiniPay es tu misma wallet: la vinculas una vez y listo.",
  "profile.wallet_need_name":
    "Primero guarda tu nombre de jugador arriba. La wallet se vincula a tu perfil en el servidor.",
  "profile.wallet_loading": "Cargando wallet…",
  "profile.address_label": "Tu dirección (cópiala para recibir fondos)",
  "profile.copied": "Copiada",
  "profile.copy_address": "Copiar dirección",
  "profile.balance": "Tu saldo",
  "profile.updating": "Actualizando…",
  "profile.refresh": "Actualizar",
  "profile.wallet_linked": "Vinculada para premios",
  "profile.change": "Cambiar",
  "profile.wallet_mismatch":
    "La wallet conectada no coincide con la guardada para premios.",
  "profile.detected": "Detectada:",
  "profile.linking": "Vinculando…",
  "profile.wallet_update": "Actualizar a la wallet conectada",
  "profile.wallet_link_minipay": "Vincular wallet para premios",
  "profile.wallet_connect": "Conectar y vincular wallet",
  "profile.no_provider":
    "Abre TypeRush dentro de MiniPay (o usa una extensión web3) para vincular tu wallet y recibir premios.",
  "profile.wallet_saved": "Wallet vinculada",

  /* --------------------- Herramienta de DEV (transferir) ----------------- */
  "dev.badge": "Dev",
  "dev.title": "Transferencia manual",
  "dev.description":
    "Envía COPm o USDT desde tu wallet conectada a cualquier dirección (Celo Mainnet). Confirmas en MiniPay. Herramienta de testing.",
  "dev.to_label": "Dirección destino",
  "dev.to_invalid": "Dirección 0x inválida.",
  "dev.amount_label": "Monto ({symbol})",
  "dev.balance_loading": "saldo…",
  "dev.balance": "saldo: {amount} {symbol}",
  "dev.decimal_hint": "Usa punto o coma para decimales (0.01 = 0,01).",
  "dev.amount_invalid": "El monto debe ser mayor a 0.",
  "dev.review_send": "Enviar",
  "dev.review_to": "a",
  "dev.confirm": "Confirmar",
  "dev.sending": "Enviando…",
  "dev.confirming": "Confirmando…",
  "dev.send": "Enviar",
  "dev.gas_hint":
    "La comisión de red la paga tu wallet conectada. En MiniPay se cobra en una stablecoin como USDT.",
  "dev.tx_sent": "Transacción enviada, confirmando…",
  "dev.sent": "Enviado",
  "dev.view_explorer": "Ver en el explorer",

  /* --------------------- Navegación de tres secciones --------------------- */
  "nav.play": "Jugar",
  "nav.profile": "Perfil",
  "nav.aria": "Navegación principal",

  /* ------------------------- Sesión y conexión ---------------------------- */
  "session.guest": "Jugador",
  "session.hello": "Hola, {name}",
  "session.login": "Entrar",
  "session.login_hint": "Entra con tu correo y te creamos una wallet, o conecta la tuya.",
  "session.connect": "Conectar wallet",
  "session.logout": "Cerrar sesión",
  "session.disconnect": "Desconectar wallet",
  "session.no_privy":
    "El acceso con correo aún no está configurado en este despliegue. Puedes conectar una wallet.",
  "session.gas.working": "Preparando tu wallet para jugar…",
  "session.gas.error":
    "No pudimos preparar tu wallet para pagar las comisiones de red.",
  "session.gas.retry": "Reintentar",

  /* ------------------------ Historial (secciones) ------------------------- */
  "history.tab.winners": "Ganadores",
  "history.tab.mine": "Tus premios",
  "history.filter.mode": "Modalidad",
  "history.filter.token": "Token",
  "history.filter.all": "Todas",
  "history.filter.all_tokens": "Todos",
  "history.payout.paid": "Pagado",
  "history.payout.pending": "Por pagar",
  "history.payout.failed": "Falló",
  "history.payout.rollover": "Pozo acumulado",
  "history.payout.closing": "Cerrando",
  "history.mine_empty":
    "Todavía no has ganado ninguna ronda. Cuando ganes, el premio llega solo a tu wallet.",
  "history.mine_guest": "Entra o conecta tu wallet para ver tus premios.",
  "history.round": "Ronda {day}",
  "history.retry": "Reintentar",
  "history.error": "No pudimos cargar el historial. Inténtalo de nuevo.",

  /* -------------------------- Perfil (bloques) ---------------------------- */
  "profile.stats.games": "Partidas",
  "profile.stats.wins": "Victorias",
  "profile.stats.best_wpm": "Mejor WPM",
  "profile.stats.best_accuracy": "Mejor precisión",
  "profile.stats.total_won": "Total ganado",
  "profile.recent": "Actividad reciente",
  "profile.recent_empty": "Aún no has jugado ninguna partida.",
  "profile.prizes": "Tus premios",
  "profile.prizes_note":
    "Los premios se envían solos a tu wallet al cerrar la ronda. No hay que reclamar nada.",
  "profile.prizes_more": "Ver historial completo",
  "profile.guard":
    "Entra o conecta tu wallet para ver tu perfil, tus marcas y tus premios.",
  "profile.wallet_kind": "Tipo de wallet",

  /* Cartera y saldos — solo lectura (CELO/USDT/COPm). Namespace propio,
     separado de profile.wallet_* (esas son del flujo VIEJO de vincular
     wallet para premios de V2, un concepto distinto). */
  "profile.balances.title": "Cartera y saldos",
  "profile.balances.hint":
    "Solo lectura: lo que hay en tu wallet activa, sin ninguna acción de enviar.",
  "profile.balances.celo": "CELO (gas)",
  "profile.balances.error": "No se pudieron leer los saldos.",
  "profile.balances.retry": "Reintentar",

  /* ------------------------- Jugada on-chain (V3) ------------------------- */
  // La entrada es gratis, pero la transacción NO: la comisión de red la paga el jugador.
  "v3.dev.cta": "Jugar (práctica)",
  "v3.dev.notice": "Modo desarrollo · no cobra · no entra al ranking",
  "v3.entry.free": "Sin costo de entrada · solo comisión de red",
  "v3.stage.switching": "Cambiando a Celo…",
  "v3.stage.checking": "Comprobando tu jugada…",
  "v3.stage.approving": "Autoriza el token en tu wallet",
  "v3.stage.signing": "Firma la jugada en tu wallet",
  "v3.stage.confirming": "Confirmando en la red…",
  "v3.stage.registering": "Preparando tu texto…",
  "v3.error.no_wallet": "Conecta una wallet para jugar.",
  "v3.error.not_configured": "El juego on-chain aún no está activo.",
  "v3.error.no_gas":
    "Tu wallet no tiene saldo para pagar la comisión de red. Deposita USDT e inténtalo de nuevo.",
  "v3.error.rejected": "Cancelaste la firma.",
  "v3.error.insufficient": "No te alcanza el saldo para la entrada.",
  "v3.error.register_failed":
    "Tu jugada se firmó, pero no pudimos registrarla. No se te cobrará de nuevo: vuelve a intentarlo.",
  "v3.error.failed": "No se pudo iniciar la partida.",

  /* ------------------------------- Wallet -------------------------------- */
  "wallet.kind.privy": "Wallet de TypeRush",
  "wallet.kind.minipay": "MiniPay",
  "wallet.kind.external": "Wallet externa",
  "wallet.kind.none": "Sin wallet",

  /* -------------------------------- Errores ------------------------------ */
  "error.attempt_validation":
    "No pudimos validar tu intento, revisa tu conexión e intenta de nuevo.",
  "error.alias_taken": "Ese alias ya está en uso. Prueba otro.",
  "error.alias_unverified":
    "No pudimos verificar disponibilidad ahora. Se guardó localmente.",
  "error.alias_too_short": "El alias necesita al menos {min} caracteres.",
  "error.alias_chars": "Usa solo letras, números, guion bajo o espacios.",
  "error.alias_no_wallet": "Conecta tu wallet para poder elegir alias.",
  "error.alias_needs_play":
    "Juega una partida y podrás ponerte alias: tu jugada es lo que confirma que la wallet es tuya.",
  "error.alias_save_failed": "No se pudo guardar el alias. Inténtalo otra vez.",
  "error.alias_reserved": "Elige un alias distinto de «{name}».",
  "error.alias_taken_wallet":
    "El alias «{name}» ya lo usa otro jugador. Elige otro nombre, guárdalo arriba, y luego asocia tu wallet.",
  "error.name_first":
    "Primero elige un nombre de jugador válido arriba y pulsa Guardar.",
  "error.wallet_invalid": "Dirección de wallet inválida.",
  "error.wallet_save_failed": "No se pudo guardar la wallet.",
  "error.no_connection": "No hay conexión con el servidor. Intenta más tarde.",
  "error.no_wallet":
    "No encontramos una wallet. Abre la app en MiniPay o usa un navegador con extensión compatible.",
  "error.minipay_wallet_read": "No pudimos leer tu wallet de MiniPay.",
  "error.connection_cancelled": "Conexión cancelada o sin cuentas disponibles.",
  "error.address_invalid": "La dirección recibida no es válida.",
  "error.wallet_connect_failed": "No se pudo conectar la wallet.",
  "error.pay_not_configured": "Los pagos aún no están configurados.",
  "error.currency_unsupported": "Moneda no soportada.",
  "error.open_in_minipay_pay": "Abre la app en MiniPay para pagar la entrada.",
  "error.token_disabled": "{symbol} no está habilitado.",
  "error.wallet_read": "No pudimos leer tu wallet.",
  "error.insufficient": "No tienes suficiente {symbol}.",
  "error.pay_unconfirmed": "El pago no se confirmó. Intenta de nuevo.",
  "error.pay_cancelled": "Cancelaste el pago.",
  "error.pay_failed": "No se pudo completar el pago.",
  "error.contract_not_configured": "El contrato no está configurado.",
  "error.open_in_minipay_claim": "Abre la app en MiniPay para cobrar tu premio.",
  "error.claim_unconfirmed": "El cobro no se confirmó. Intenta de nuevo.",
  "error.claim_cancelled": "Cancelaste el cobro.",
  "error.claim_failed": "No se pudo cobrar el premio.",
  "error.dest_invalid": "La dirección destino no es válida.",
  "error.amount_invalid": "El monto no es válido.",
  "error.transfer_reverted": "La transferencia revirtió on-chain.",
  "error.transfer_failed": "No se pudo enviar la transferencia.",
  "error.transfer_cancelled": "Cancelaste la transferencia.",
  "error.open_in_minipay_send": "Abre la app en MiniPay para enviar fondos.",
} as const;

export type MessageKey = keyof typeof es;

export const en: Record<MessageKey, string> = {
  /* ------------------------------- Common -------------------------------- */
  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.checking": "Checking…",
  "common.calculating": "Calculating…",

  /* ------------------------------ Metadata ------------------------------- */
  "meta.title": "TypeRush — typing race",
  "meta.description":
    "Type against the clock for 45 seconds. Track your WPM and accuracy, and beat your record.",

  /* ------------------------------ Language ------------------------------- */
  "lang.aria": "App language",
  "lang.label": "Language",

  /* -------------------------- Header / navigation ------------------------ */
  "header.tagline": "45s race",
  "nav.home": "Home",
  "nav.ranking": "Ranking",
  "nav.history": "History",
  "nav.you": "You",
  "sound.mute": "Mute sounds",
  "sound.unmute": "Turn sounds on",

  /* ------------------------- Modes and challenges ------------------------ */
  "mode.es": "Spanish",
  "mode.en": "English",
  "mode.es.description": "Motivation, news and stablecoins in Spanish.",
  "mode.en.description": "Motivation and everyday English.",
  "challenge.motivacionEs.title": "Motivation",
  "challenge.motivacionEs.description": "Sentences to give you a boost.",
  "challenge.noticiasEs.title": "News",
  "challenge.noticiasEs.description": "Facts and progress from around the world.",
  "challenge.cryptoEs.title": "Stablecoins",
  "challenge.cryptoEs.description": "The world of digital dollars.",
  "challenge.motivationEn.title": "Motivation",
  "challenge.motivationEn.description": "Sentences to keep you going.",
  "challenge.dailyEn.title": "Daily English",
  "challenge.dailyEn.description": "Everyday English practice.",

  /* ----------------------------- Currencies ------------------------------ */
  "currency.usdt.sub": "dollars",
  "currency.copm.sub": "pesos",

  /* ------------------------------- Home ---------------------------------- */
  "home.badge.mainnet": "Celo Mainnet",
  "home.badge.minipay": "MiniPay",
  "home.badge.prizes": "Daily prizes",
  "home.title.line1": "Type fast.",
  "home.title.line2": "Climb the ranking.",
  "home.title.line3": "Win on Celo.",
  "home.sub.loading": "{seconds}-second races",
  "home.sub.paid": "{seconds}-second races · 0.10 USDT entry",
  "home.sub.free": "{seconds}-second races · first try free",
  "home.prize.title": "Today's real prize · #1 takes it all",
  "home.prize.close": "Daily close at 7:00 p.m. (Colombia)",
  "home.prize.remaining": "{time} left",
  "home.free_used": "Free try already used",
  "home.cta.free": "Play free",
  "home.cta.paid": "Play for 0.10 USDT",
  "home.note.free_used":
    "You already used your free try. Further races cost 0.10 USDT.",
  "home.note.default":
    "No sign-up: pick an alias and race. After that, entries from 0.10 USDT.",

  /* ------------------------ Animated preview (RaceDemo) ------------------ */
  "demo.sentence":
    "Speed is a skill you build: one race at a time and every fix counts.",
  "demo.reduced": "Static preview (reduced motion is on)",

  /* ----------------------------- Race screen ----------------------------- */
  "race.time": "Time",
  "race.wpm": "WPM",
  "race.accuracy": "Accuracy",
  "race.errors": "Errors",
  "race.corrections_short": "Fixes",
  "race.input_label": "Typing field",
  "race.tap_to_type": "Tap the text to start typing",

  /* -------------------------------- Lobby -------------------------------- */
  "lobby.back": "Back to modes",
  "lobby.prize": "Prize for #1",
  "lobby.win_both": "win both",
  "lobby.play_free": "Play free",
  "lobby.next_free": "Next free try in {time}",
  "lobby.paying": "Processing payment…",
  "lobby.free_used": "You used your free try. Pick a currency:",
  "lobby.pay": "Pay {amount} {symbol}",
  "lobby.and_play": "and play",
  "card.selected": "Selected",
  "card.your_best": "Your best score",
  "card.no_score": "No score yet",

  /* ------------------- Daily challenge card (Play) ----------------------- */
  "play.tag": "Daily challenge",
  "play.title": "{seconds}-second race",
  "play.support":
    "Type the exact text before time runs out. The highest score at closing time takes the pot.",
  "play.prize.preparing": "Getting today's prize ready…",
  "play.prize.error": "We couldn't read today's prize.",
  "play.prize.retry": "Try again",
  "play.closes_in": "Closes in {time}",
  "play.mode.label": "Text language",
  "play.challenge.label": "Challenge",
  "play.entry.checking": "Checking your entry…",
  "play.entry.free": "You still have today's free attempt",
  "play.entry.paid": "Free attempt used · entry {amount}",
  "play.entry.practice": "Practice race, no prize",
  "play.cta.paid": "Play for {amount}",
  "play.howto": "How to play",
  "entry.title": "How do you want to pay?",
  "entry.sub": "Your entry goes into today's pot. The #1 at closing takes it.",
  "entry.choose": "Pay and play",
  "top3.title": "Today's top 3",
  "top3.full": "See full ranking",
  "top3.empty": "Nobody has played this round yet. Be the first.",

  /* ----------------------------- How to play ----------------------------- */
  "howto.title": "How to play",
  "howto.close": "Close",
  "howto.got_it": "Got it",
  "howto.step1": "Pick the text language and the challenge.",
  "howto.step2": "You get {seconds} seconds.",
  "howto.step3": "Type exactly the text you see.",
  "howto.step4": "Hits, mistakes and corrections each have their own colour.",
  "howto.step5": "Your WPM, accuracy and progress are computed live.",
  "howto.step6": "Your best valid result goes into the daily ranking.",

  /* --------------------------- Tap to start (mobile) ---------------------- */
  "tapstart.cta": "Tap to start",
  "tapstart.hint": "This opens the keyboard before the countdown.",

  /* ------------------------------ Countdown ------------------------------ */
  "countdown.warmup": "Warm up your fingers",
  "countdown.go": "GO!",
  "countdown.hint": "Type fast, fix your mistakes and finish the text.",
  "countdown.cancel": "Cancel race",

  /* ------------------------------- Result -------------------------------- */
  "result.new_best": "New record!",
  "result.finished": "Race finished",
  "result.wpm_caption": "words per minute",
  "result.corrections": "Corrections",
  "result.score": "Score",
  "result.best_label": "Best score:",
  "result.no_best": "No record yet",
  "result.wait": "Take a moment to look at your score…",
  "result.back_to_challenges": "Back to the challenge",
  "result.play_again": "Play again",
  "result.entry_free": "You still have today's free attempt.",
  "result.entry_paid": "The next race costs {amount}.",
  "result.see_ranking": "See the round ranking",
  "result.back_home": "Back to home",

  /* ------------------------------- Payment ------------------------------- */
  "paid.confirmed": "Payment confirmed!",
  "paid.hint": "You're in the round for the prize. Tap to start.",
  "paid.start": "Start!",
  "pay.step.preparing": "Preparing",
  "pay.step.confirm_wallet": "Confirm in your wallet",
  "pay.step.confirming_network": "Confirming on-chain",
  "pay.title.preparing": "Preparing the payment…",
  "pay.title.approving": "Approve the token in your wallet",
  "pay.title.signing": "Waiting for your confirmation…",
  "pay.title.confirming": "Confirming the transaction…",
  "pay.hint.wallet": "Approve the request in MiniPay.",
  "pay.hint.wait": "This only takes a few seconds.",

  /* --------------------------- Insufficient funds ------------------------ */
  "funds.title": "You need more {symbol}",
  "funds.body": "You need {needed} {symbol} to pay the entry.",
  "funds.deposit": "Deposit funds",
  "funds.send": "Send {symbol} to your wallet:",
  "funds.copied": "Copied",
  "funds.copy": "Copy",
  "funds.ok": "Got it",

  /* -------------------------------- Alias -------------------------------- */
  "alias.title": "Choose your alias",
  "alias.subtitle":
    "You need an alias to play. It's how you show up in the rankings.",
  "alias.placeholder": "Your alias",
  "alias.rules":
    "Between 2 and 16 characters: letters, numbers, underscore or spaces.",
  "alias.save_and_play": "Save and play",
  "alias.continue_and_play": "Continue and play",

  /* -------------------------------- Claim -------------------------------- */
  "claim.title": "You won! Claim your prize",
  "claim.claiming": "Claiming…",
  "claim.claimed": "Prize claimed",
  "claim.claim": "Claim prize",

  /* ------------------------------- Ranking ------------------------------- */
  "ranking.title": "Ranking",
  "ranking.loading": "Loading ranking…",
  "ranking.error": "We couldn't load the ranking right now.",
  "ranking.top5": "Top 5 · {mode}",
  "ranking.empty": "No races in this mode yet in today's period.",
  "ranking.period": "Current period (Colombia time)",
  "ranking.your_position": "Your position",
  "ranking.no_score_mode":
    "You don't have a score in {mode} yet. Play a race to show up here.",
  "ranking.you": "You",
  "ranking.live": "Today's ranking",
  "ranking.live_sub": "Who's winning the round that closes tonight.",
  "ranking.top_n": "Top {count} · {mode}",
  "ranking.see_full": "See full ranking",
  "ranking.retry": "Retry",
  "ranking.players": "{count} playing",
  "ranking.players_one": "1 playing",
  "ranking.col_player": "Player",
  "ranking.anonymous": "Player",
  "ranking.col_wpm": "WPM",
  "ranking.col_score": "Score",
  "ranking.mode_filter": "Mode",
  "ranking.wallet_missing_leader":
    "Leading with no linked wallet: if the round closes like this, the prize rolls over to the next one.",
  "ranking.wallet_missing_me":
    "You have no linked wallet. If you win, the prize can't be paid to you: link one from Profile to be able to receive it.",
  "ranking.wallet_link": "Link a wallet in Profile",
  "ranking.wallet_missing_badge": "no wallet",
  "ranking.wallet_ok_badge": "wallet ready",
  "ranking.back_to_play": "Back to Play",

  /* ------------------------------- History ------------------------------- */
  "history.title": "History",
  "history.lead":
    "Closed rounds: who won each day and whether the prize was paid, with its transaction on Celo.",
  "history.clear": "Clear",
  "history.clear_confirm": "Delete all of your local history?",
  "history.empty": "No races yet. Play one to see your history.",
  "history.challenge_fallback": "Challenge",
  "history.record": "Record",
  "history.accuracy_short": "Acc.",

  /* ------------------------------- Winners ------------------------------- */
  "winners.payout.claimed": "Claimed",
  "winners.payout.registered": "To claim",
  "winners.payout.rollover": "Rolled over",
  "winners.payout.pending": "Closing",
  "winners.error":
    "We couldn't load the winners history right now. Please try again in a moment.",
  "winners.empty":
    "No closed rounds yet. The first one will show up after the 7:00 p.m. (Colombia) close.",
  "winners.more": "Show {count} more",
  "winners.no_winner": "No winner",
  "winners.rolled": "Nobody claimed it: the pot rolled over to the next day.",
  "winners.tx": "View transaction",
  "winners.points": "{score} pts",

  /* ------------------------------- Profile ------------------------------- */
  "profile.title": "Your profile",
  "profile.name_label": "Player name",
  "profile.name_hint": "This is how you'll appear in each challenge's ranking.",
  "profile.name_too_short": "The name needs at least {min} characters.",
  "profile.saved": "Saved",
  "profile.save": "Save",
  "profile.local_profile": "Local profile",
  "profile.language": "App language",
  "profile.language_hint":
    "Changes the language of the whole interface. It sticks as you navigate and reload.",
  "profile.wallet_title": "Prize wallet",
  "profile.wallet_desc":
    "This is the wallet where you get your prize (USDT and COPm) if you finish #1 of the day. In MiniPay it's your same wallet: link it once and you're done.",
  "profile.wallet_need_name":
    "Save your player name above first. The wallet is linked to your profile on the server.",
  "profile.wallet_loading": "Loading wallet…",
  "profile.address_label": "Your address (copy it to receive funds)",
  "profile.copied": "Copied",
  "profile.copy_address": "Copy address",
  "profile.balance": "Your balance",
  "profile.updating": "Refreshing…",
  "profile.refresh": "Refresh",
  "profile.wallet_linked": "Linked for prizes",
  "profile.change": "Change",
  "profile.wallet_mismatch":
    "The connected wallet doesn't match the one saved for prizes.",
  "profile.detected": "Detected:",
  "profile.linking": "Linking…",
  "profile.wallet_update": "Switch to the connected wallet",
  "profile.wallet_link_minipay": "Link wallet for prizes",
  "profile.wallet_connect": "Connect and link wallet",
  "profile.no_provider":
    "Open TypeRush inside MiniPay (or use a web3 extension) to link your wallet and receive prizes.",
  "profile.wallet_saved": "Wallet linked",

  /* ----------------------- DEV tool (manual transfer) -------------------- */
  "dev.badge": "Dev",
  "dev.title": "Manual transfer",
  "dev.description":
    "Send COPm or USDT from your connected wallet to any address (Celo Mainnet). You confirm in MiniPay. Testing tool.",
  "dev.to_label": "Destination address",
  "dev.to_invalid": "Invalid 0x address.",
  "dev.amount_label": "Amount ({symbol})",
  "dev.balance_loading": "balance…",
  "dev.balance": "balance: {amount} {symbol}",
  "dev.decimal_hint": "Use a dot or a comma for decimals (0.01 = 0,01).",
  "dev.amount_invalid": "The amount must be greater than 0.",
  "dev.review_send": "Send",
  "dev.review_to": "to",
  "dev.confirm": "Confirm",
  "dev.sending": "Sending…",
  "dev.confirming": "Confirming…",
  "dev.send": "Send",
  "dev.gas_hint":
    "Network fees are paid by your connected wallet. In MiniPay they are charged in a stablecoin such as USDT.",
  "dev.tx_sent": "Transaction sent, confirming…",
  "dev.sent": "Sent",
  "dev.view_explorer": "View on the explorer",

  /* ---------------------- Three-section navigation ------------------------ */
  "nav.play": "Play",
  "nav.profile": "Profile",
  "nav.aria": "Main navigation",

  /* ------------------------ Session and connection ------------------------ */
  "session.guest": "Player",
  "session.hello": "Hi, {name}",
  "session.login": "Sign in",
  "session.login_hint":
    "Sign in with your email and we'll create a wallet for you, or connect your own.",
  "session.connect": "Connect wallet",
  "session.logout": "Sign out",
  "session.disconnect": "Disconnect wallet",
  "session.no_privy":
    "Email sign-in isn't configured on this deployment yet. You can connect a wallet.",
  "session.gas.working": "Getting your wallet ready to play…",
  "session.gas.error": "We couldn't get your wallet ready to pay network fees.",
  "session.gas.retry": "Try again",

  /* -------------------------- History (sections) -------------------------- */
  "history.tab.winners": "Winners",
  "history.tab.mine": "Your prizes",
  "history.filter.mode": "Mode",
  "history.filter.token": "Token",
  "history.filter.all": "All",
  "history.filter.all_tokens": "All",
  "history.payout.paid": "Paid",
  "history.payout.pending": "To be paid",
  "history.payout.failed": "Failed",
  "history.payout.rollover": "Rolled over",
  "history.payout.closing": "Closing",
  "history.mine_empty":
    "You haven't won a round yet. When you do, the prize arrives in your wallet on its own.",
  "history.mine_guest": "Sign in or connect your wallet to see your prizes.",
  "history.round": "Round {day}",
  "history.retry": "Try again",
  "history.error": "We couldn't load the history. Please try again.",

  /* --------------------------- Profile (blocks) --------------------------- */
  "profile.stats.games": "Races",
  "profile.stats.wins": "Wins",
  "profile.stats.best_wpm": "Best WPM",
  "profile.stats.best_accuracy": "Best accuracy",
  "profile.stats.total_won": "Total won",
  "profile.recent": "Recent activity",
  "profile.recent_empty": "You haven't played any races yet.",
  "profile.prizes": "Your prizes",
  "profile.prizes_note":
    "Prizes are sent to your wallet automatically when the round closes. Nothing to claim.",
  "profile.prizes_more": "See full history",
  "profile.guard":
    "Sign in or connect your wallet to see your profile, your records and your prizes.",
  "profile.wallet_kind": "Wallet type",

  /* Wallet and balances — read-only (CELO/USDT/COPm). Its own namespace,
     separate from profile.wallet_* (that's the OLD V2 prize-wallet-linking
     flow, a different concept). */
  "profile.balances.title": "Wallet and balances",
  "profile.balances.hint":
    "Read-only: what's in your active wallet, with no send action.",
  "profile.balances.celo": "CELO (gas)",
  "profile.balances.error": "Couldn't read the balances.",
  "profile.balances.retry": "Retry",

  /* --------------------------- On-chain play (V3) ------------------------- */
  "v3.dev.cta": "Play (practice)",
  "v3.dev.notice": "Development mode · no charge · not ranked",
  "v3.entry.free": "No entry fee · network fee only",
  "v3.stage.switching": "Switching to Celo…",
  "v3.stage.checking": "Checking your play…",
  "v3.stage.approving": "Approve the token in your wallet",
  "v3.stage.signing": "Sign the play in your wallet",
  "v3.stage.confirming": "Confirming on-chain…",
  "v3.stage.registering": "Getting your text ready…",
  "v3.error.no_wallet": "Connect a wallet to play.",
  "v3.error.not_configured": "On-chain play isn't live yet.",
  "v3.error.no_gas":
    "Your wallet has no balance to pay the network fee. Deposit USDT and try again.",
  "v3.error.rejected": "You cancelled the signature.",
  "v3.error.insufficient": "Not enough balance for the entry.",
  "v3.error.register_failed":
    "Your play was signed but we couldn't register it. You won't be charged again: please retry.",
  "v3.error.failed": "We couldn't start the race.",

  /* ------------------------------- Wallet -------------------------------- */
  "wallet.kind.privy": "TypeRush wallet",
  "wallet.kind.minipay": "MiniPay",
  "wallet.kind.external": "External wallet",
  "wallet.kind.none": "No wallet",

  /* -------------------------------- Errors ------------------------------- */
  "error.attempt_validation":
    "We couldn't validate your try. Check your connection and try again.",
  "error.alias_taken": "That alias is already taken. Try another one.",
  "error.alias_unverified":
    "We couldn't check availability right now. It was saved locally.",
  "error.alias_too_short": "The alias needs at least {min} characters.",
  "error.alias_chars": "Use only letters, numbers, underscore or spaces.",
  "error.alias_no_wallet": "Connect your wallet to choose an alias.",
  "error.alias_needs_play":
    "Play a race and you'll be able to set an alias: your play is what proves the wallet is yours.",
  "error.alias_save_failed": "Couldn't save the alias. Try again.",
  "error.alias_reserved": "Choose an alias other than “{name}”.",
  "error.alias_taken_wallet":
    "The alias “{name}” is already used by another player. Choose another name, save it above, and then link your wallet.",
  "error.name_first": "First choose a valid player name above and tap Save.",
  "error.wallet_invalid": "Invalid wallet address.",
  "error.wallet_save_failed": "We couldn't save the wallet.",
  "error.no_connection": "No connection to the server. Try again later.",
  "error.no_wallet":
    "We couldn't find a wallet. Open the app in MiniPay or use a browser with a compatible extension.",
  "error.minipay_wallet_read": "We couldn't read your MiniPay wallet.",
  "error.connection_cancelled": "Connection cancelled or no accounts available.",
  "error.address_invalid": "The address received is not valid.",
  "error.wallet_connect_failed": "We couldn't connect the wallet.",
  "error.pay_not_configured": "Payments aren't configured yet.",
  "error.currency_unsupported": "Currency not supported.",
  "error.open_in_minipay_pay": "Open the app in MiniPay to pay the entry.",
  "error.token_disabled": "{symbol} is not enabled.",
  "error.wallet_read": "We couldn't read your wallet.",
  "error.insufficient": "You don't have enough {symbol}.",
  "error.pay_unconfirmed": "The payment wasn't confirmed. Try again.",
  "error.pay_cancelled": "You cancelled the payment.",
  "error.pay_failed": "We couldn't complete the payment.",
  "error.contract_not_configured": "The contract isn't configured.",
  "error.open_in_minipay_claim": "Open the app in MiniPay to claim your prize.",
  "error.claim_unconfirmed": "The claim wasn't confirmed. Try again.",
  "error.claim_cancelled": "You cancelled the claim.",
  "error.claim_failed": "We couldn't claim the prize.",
  "error.dest_invalid": "The destination address is not valid.",
  "error.amount_invalid": "The amount is not valid.",
  "error.transfer_reverted": "The transfer reverted on-chain.",
  "error.transfer_failed": "We couldn't send the transfer.",
  "error.transfer_cancelled": "You cancelled the transfer.",
  "error.open_in_minipay_send": "Open the app in MiniPay to send funds.",
};
