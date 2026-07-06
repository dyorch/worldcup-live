// Alarma "GOL -> cupón PedidosYa". El canje es en la APP del celular; la PC solo da el
// aviso inmediato e imposible de ignorar: sonido fuerte + notificación de escritorio +
// banner persistente + parpadeo del título de la pestaña. Funciona con la pestaña en
// segundo plano (mientras siga abierta).

let notifyGranted = false;
let armed = false;
export function alertsArmed(): boolean {
  return armed;
}

// ---- Alarma sonora con Web Audio (osciladores) ----
// Se programa en el reloj de audio: latencia ~0 (suena al instante, sin decodificar nada).
// El <audio> con WAV en data-URI tenía que decodificarse en cada disparo => retardo.
let actx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!actx && AC) actx = new AC();
    if (actx && actx.state === "suspended") void actx.resume(); // por si el navegador lo durmió en segundo plano
    return actx ?? null;
  } catch {
    return null;
  }
}

// Desbloqueo desde un gesto del usuario (clic en "Activar alarma").
function unlockAudio(): boolean {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001; // blip inaudible solo para desbloquear/arrancar el contexto
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
    return true;
  } catch {
    return false;
  }
}

// Sirena de dos tonos (~2.5 s). Programada de una sola vez => instantánea y sin clicks.
export function playAlarm(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const start = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const beeps = 14;
  const step = 0.18;
  for (let i = 0; i < beeps; i++) {
    const t = start + i * step;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = i % 2 === 0 ? 880 : 1320;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.012); // ataque rápido sin click
    g.gain.setValueAtTime(0.8, t + step - 0.03);
    g.gain.linearRampToValueAtTime(0, t + step - 0.005); // release sin click
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + step);
  }
}

// Debe llamarse desde un gesto del usuario (clic): desbloquea audio y pide permiso de notificación.
export async function enableAlerts(): Promise<{ audio: boolean; notif: string }> {
  const audio = unlockAudio();
  let notif = "unsupported";
  if ("Notification" in window) {
    notif = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    notifyGranted = notif === "granted";
  }
  armed = audio || notifyGranted;
  return { audio, notif };
}

// `renotify`/`requireInteraction` existen en el navegador pero faltan en algunos lib.dom de TS.
interface GoalNotifyOptions extends NotificationOptions {
  renotify?: boolean;
  requireInteraction?: boolean;
}

function notify(title: string, body: string): void {
  if (!notifyGranted || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const opts: GoalNotifyOptions = {
      body,
      tag: "wc-goal",
      renotify: true,
      requireInteraction: true,
      icon: "/favicon.svg",
    };
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* noop */
  }
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

let elapsedTimer: number | null = null;
let titleTimer: number | null = null;
const origTitle = document.title;

// Disparo principal de la alerta de cupón (gol detectado).
export function couponAlert(o: { matchLabel: string; scorer?: string }): void {
  playAlarm();
  notify(
    "⚽ ¡GOL! — hay cupón en PedidosYa",
    `${o.matchLabel}${o.scorer ? " · " + o.scorer : ""} · ¡abre la app en tu celular y canjea YA!`,
  );
  showBanner(o.matchLabel, o.scorer);
  flashTitle();
}

function showBanner(matchLabel: string, scorer?: string): void {
  const t0 = Date.now();
  document.getElementById("coupon-banner")?.remove();

  const b = document.createElement("div");
  b.id = "coupon-banner";
  b.className = "coupon-banner";
  b.innerHTML = `
    <span class="cb-emoji">⚽</span>
    <div class="cb-main">
      <div class="cb-title">¡GOL! → ABRE PEDIDOSYA EN TU CELULAR Y CANJEA YA</div>
      <div class="cb-sub">${esc(matchLabel)}${scorer ? " · " + esc(scorer) : ""} · <span id="cb-elapsed">hace 0 s</span></div>
    </div>
    <button class="cb-x" id="cb-dismiss" type="button" aria-label="cerrar">✕</button>`;
  document.body.appendChild(b);
  document.getElementById("cb-dismiss")?.addEventListener("click", dismissBanner);

  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = window.setInterval(() => {
    const el = document.getElementById("cb-elapsed");
    if (el) el.textContent = `hace ${Math.round((Date.now() - t0) / 1000)} s`;
  }, 1000);
}

function dismissBanner(): void {
  document.getElementById("coupon-banner")?.remove();
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  stopFlash();
}

function flashTitle(): void {
  stopFlash();
  let on = false;
  titleTimer = window.setInterval(() => {
    document.title = (on = !on) ? "⚽⚽ ¡GOL! CANJEA ⚽⚽" : origTitle;
  }, 700);
  window.addEventListener("focus", stopFlash, { once: true });
}

function stopFlash(): void {
  if (titleTimer) {
    clearInterval(titleTimer);
    titleTimer = null;
  }
  document.title = origTitle;
}
