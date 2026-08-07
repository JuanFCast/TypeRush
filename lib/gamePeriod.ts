// Ventana diaria de TypeRush en hora Colombia (America/Bogota, UTC−5).
// Cada "día" del juego va de 7:00 p.m. a 7:00 p.m. del día siguiente.
// Coincide con el reinicio del tiro gratis y el ranking visible.

export const GAME_TIMEZONE = "America/Bogota";
/**
 * Hora de cierre en Colombia. Debe coincidir con TRES cosas o el ranking y el
 * premio dejan de hablar del mismo día:
 *   - `DAY_OFFSET` en contracts/src/TypeRushGameV3.sol (0 = medianoche UTC = 7 p.m. Col),
 *   - `reset_hour_bogota` en supabase/daily_reset.sql y daily_prizes.sql,
 *   - la hora del cron en vercel.json (en UTC: 19 + 5 = 00:00).
 * Cambió de 20 a 19 el 2026-08-06, con el contrato V3 nuevo.
 */
export const PERIOD_RESET_HOUR = 19;

type BogotaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

function getBogotaParts(date: Date): BogotaParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: GAME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
  };
}

/** Fecha/hora local en Bogotá → instante UTC (Colombia fija UTC−5). */
function bogotaLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const iso =
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` +
    `T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`;
  return new Date(iso);
}

function shiftBogotaDate(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): BogotaParts {
  const anchor = bogotaLocalToUtc(year, month, day, 12, 0);
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return getBogotaParts(anchor);
}

export type GamePeriod = {
  start: Date;
  end: Date;
  label: string;
};

/**
 * Periodo activo: desde las 7 p.m. de ayer/hoy hasta las 7 p.m. siguientes.
 * `locale` solo afecta a `label` (el texto para mostrar), nunca a las fechas.
 */
export function getCurrentGamePeriod(
  now = new Date(),
  locale = "es-CO",
): GamePeriod {
  const p = getBogotaParts(now);
  let startYear = p.year;
  let startMonth = p.month;
  let startDay = p.day;

  if (p.hour < PERIOD_RESET_HOUR) {
    const prev = shiftBogotaDate(p.year, p.month, p.day, -1);
    startYear = prev.year;
    startMonth = prev.month;
    startDay = prev.day;
  }

  const start = bogotaLocalToUtc(startYear, startMonth, startDay, PERIOD_RESET_HOUR);
  const endDay = shiftBogotaDate(startYear, startMonth, startDay, 1);
  const end = bogotaLocalToUtc(endDay.year, endDay.month, endDay.day, PERIOD_RESET_HOUR);

  return {
    start,
    end,
    label: formatGamePeriodLabel(start, end, locale),
  };
}

/** Milisegundos hasta el próximo reinicio (7 p.m. Colombia = fin del periodo). */
export function getMsUntilNextReset(now = new Date()): number {
  const end = getCurrentGamePeriod(now).end;
  return Math.max(0, end.getTime() - now.getTime());
}

/** Cuenta regresiva HH:MM:SS hasta el próximo tiro gratis. */
export function formatResetCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * "3 ago, 7:00 p. m. – 4 ago, 7:00 p. m.". El periodo SIEMPRE se expresa en
 * hora Colombia (es cuando cierra la ronda), pero se escribe en el idioma de la
 * interfaz, así que el locale se pasa desde fuera.
 */
export function formatGamePeriodLabel(
  start: Date,
  end: Date,
  locale = "es-CO",
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: GAME_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** ¿El instante cae antes del inicio del periodo actual? (p. ej. tiro consumido ayer). */
export function isBeforeCurrentPeriod(instant: Date, now = new Date()): boolean {
  return instant < getCurrentGamePeriod(now).start;
}
