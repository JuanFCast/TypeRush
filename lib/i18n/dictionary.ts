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
  "mode.es.description": "Motivación, noticias y crypto en español.",
  "mode.en.description": "Motivación e inglés cotidiano.",
  "challenge.motivacionEs.title": "Motivación",
  "challenge.motivacionEs.description": "Frases para darte impulso.",
  "challenge.noticiasEs.title": "Noticias",
  "challenge.noticiasEs.description": "Datos y avances del mundo.",
  "challenge.cryptoEs.title": "Crypto",
  "challenge.cryptoEs.description": "El mundo de las criptomonedas.",
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
  "home.prize.close": "Cierre diario 8:00 p. m. (Colombia)",
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
  "result.back_to_challenges": "Volver a retos",
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
  "funds.deposit": "Deposita en Celo Mainnet",
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

  /* ------------------------------ Historial ------------------------------ */
  "history.title": "Historial",
  "history.clear": "Limpiar",
  "history.clear_confirm": "¿Borrar todo tu historial local?",
  "history.tab.mine": "Tus partidas",
  "history.tab.winners": "Ganadores",
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
    "Todavía no hay rondas cerradas. La primera aparecerá tras el cierre de las 8:00 p. m. (Colombia).",
  "winners.more": "Ver {count} más",
  "winners.no_winner": "Sin ganador",
  "winners.rolled": "Nadie pudo cobrarlo: el pozo pasó al día siguiente.",
  "winners.tx": "Ver transacción",
  "winners.points": "{score} pts",

  /* -------------------------------- Perfil ------------------------------- */
  "profile.title": "Tú",
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
    "El gas lo paga tu wallet conectada. En Celo puede cobrarse en CELO o en una stable soportada por MiniPay, como USDT.",
  "dev.tx_sent": "Transacción enviada, confirmando…",
  "dev.sent": "Enviado",
  "dev.view_explorer": "Ver en el explorer",

  /* -------------------------------- Errores ------------------------------ */
  "error.attempt_validation":
    "No pudimos validar tu intento, revisa tu conexión e intenta de nuevo.",
  "error.alias_taken": "Ese alias ya está en uso. Prueba otro.",
  "error.alias_unverified":
    "No pudimos verificar disponibilidad ahora. Se guardó localmente.",
  "error.alias_too_short": "El alias necesita al menos {min} caracteres.",
  "error.alias_chars": "Usa solo letras, números, guion bajo o espacios.",
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
  "mode.es.description": "Motivation, news and crypto in Spanish.",
  "mode.en.description": "Motivation and everyday English.",
  "challenge.motivacionEs.title": "Motivation",
  "challenge.motivacionEs.description": "Sentences to give you a boost.",
  "challenge.noticiasEs.title": "News",
  "challenge.noticiasEs.description": "Facts and progress from around the world.",
  "challenge.cryptoEs.title": "Crypto",
  "challenge.cryptoEs.description": "The world of cryptocurrencies.",
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
  "home.prize.close": "Daily close at 8:00 p.m. (Colombia)",
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
  "result.back_to_challenges": "Back to challenges",
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
  "funds.deposit": "Deposit on Celo Mainnet",
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

  /* ------------------------------- History ------------------------------- */
  "history.title": "History",
  "history.clear": "Clear",
  "history.clear_confirm": "Delete all of your local history?",
  "history.tab.mine": "Your races",
  "history.tab.winners": "Winners",
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
    "No closed rounds yet. The first one will show up after the 8:00 p.m. (Colombia) close.",
  "winners.more": "Show {count} more",
  "winners.no_winner": "No winner",
  "winners.rolled": "Nobody claimed it: the pot rolled over to the next day.",
  "winners.tx": "View transaction",
  "winners.points": "{score} pts",

  /* ------------------------------- Profile ------------------------------- */
  "profile.title": "You",
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
    "Gas is paid by your connected wallet. On Celo it can be charged in CELO or in a stablecoin supported by MiniPay, such as USDT.",
  "dev.tx_sent": "Transaction sent, confirming…",
  "dev.sent": "Sent",
  "dev.view_explorer": "View on the explorer",

  /* -------------------------------- Errors ------------------------------- */
  "error.attempt_validation":
    "We couldn't validate your try. Check your connection and try again.",
  "error.alias_taken": "That alias is already taken. Try another one.",
  "error.alias_unverified":
    "We couldn't check availability right now. It was saved locally.",
  "error.alias_too_short": "The alias needs at least {min} characters.",
  "error.alias_chars": "Use only letters, numbers, underscore or spaces.",
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
