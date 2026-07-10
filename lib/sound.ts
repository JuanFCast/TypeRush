// Sonidos del juego, sintetizados con Web Audio API (sin assets ni red).
//
// iOS/Android bloquean el audio hasta un gesto del usuario: unlockAudio() debe
// llamarse DENTRO de un gesto (tap en Jugar/Empezar) para crear/reanudar el
// AudioContext. Después, los sonidos suenan sin latencia (osciladores baratos).
// La preferencia (on/off) persiste en localStorage; por defecto queda activada.

const PREF_KEY = "typerush.sound.v1";

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
let lastKeyAt = 0;

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function isSoundEnabled(): boolean {
  if (enabled === null) enabled = readPref();
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Sin localStorage: la preferencia vive solo en memoria.
  }
  if (on) unlockAudio();
}

/** Crea/reanuda el AudioContext. Llamar dentro de un gesto del usuario. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Un tono corto con envolvente suave (sin clicks al cortar). */
function tone(opts: {
  freq: number;
  /** Frecuencia final (glissando); por defecto la misma. */
  to?: number;
  duration: number; // segundos
  type?: OscillatorType;
  gain?: number;
  delay?: number; // segundos desde ahora
}): void {
  if (!ctx || ctx.state !== "running" || !isSoundEnabled()) return;
  const { freq, to = opts.freq, duration, type = "sine", gain = 0.05, delay = 0 } = opts;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    // Ataque rápido y caída exponencial: suena a "blip" suave, nunca a zumbido.
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    // Un fallo de audio jamás debe romper el juego.
  }
}

/** Tick de cada número del 3·2·1. */
export function playCountTick(): void {
  tone({ freq: 620, duration: 0.09, type: "triangle", gain: 0.06 });
}

/** "¡YA!": arranque de la carrera. */
export function playGo(): void {
  tone({ freq: 660, to: 990, duration: 0.18, type: "triangle", gain: 0.07 });
}

/** Tecla correcta: click cortísimo con leve variación de tono (no cansa). */
export function playKey(): void {
  const now = performance.now();
  if (now - lastKeyAt < 28) return; // sin ráfagas superpuestas al teclear rápido
  lastKeyAt = now;
  const jitter = 1 + (Math.random() - 0.5) * 0.12;
  tone({ freq: 2050 * jitter, duration: 0.03, type: "triangle", gain: 0.022 });
}

/** Error de tecleo: golpe grave y corto, más bajo que el click normal. */
export function playError(): void {
  const now = performance.now();
  if (now - lastKeyAt < 28) return;
  lastKeyAt = now;
  tone({ freq: 190, to: 150, duration: 0.09, type: "square", gain: 0.035 });
}

/** Fin de la carrera (dos notas descendentes, neutras). */
export function playFinish(): void {
  tone({ freq: 784, duration: 0.12, type: "triangle", gain: 0.06 });
  tone({ freq: 523, duration: 0.16, type: "triangle", gain: 0.06, delay: 0.12 });
}

/** Nuevo récord / victoria: arpegio ascendente alegre. */
export function playRecord(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) =>
    tone({ freq, duration: 0.14, type: "triangle", gain: 0.06, delay: i * 0.09 }),
  );
}
