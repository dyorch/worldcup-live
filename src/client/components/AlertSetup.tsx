import { createSignal, onMount, type JSX } from "solid-js";
import { enableAlerts, couponAlert } from "../services/alerts";
import { initPush, subscribePush, unsubscribePush, testPush, pushSupported, pushSubscribed } from "../services/push";

const PUSH_ON_CLASS = "rounded-lg bg-sky-500 px-3 py-1.5 font-extrabold text-sky-950 transition hover:bg-sky-400";
const PUSH_OFF_CLASS =
  "rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-semibold text-rose-200 transition hover:bg-rose-500/20";

// Configuración de la ALARMA de gol + Web Push. Antes era wiring imperativo por id en main.ts;
// ahora es un componente con señales locales. La lógica (alerts.ts / push.ts) no cambia.
export function AlertSetup(): JSX.Element {
  // ---- Alarma ----
  const [alarmBtnLabel, setAlarmBtnLabel] = createSignal("Activar alarma");
  const [alarmActive, setAlarmActive] = createSignal(false);
  const [alarmBusy, setAlarmBusy] = createSignal(false);
  const [alarmStatus, setAlarmStatus] = createSignal('Sin activar — pulsa "Activar alarma".');
  const [alarmStatusClass, setAlarmStatusClass] = createSignal("text-slate-400");

  const onEnableAlarm = async () => {
    setAlarmBusy(true);
    const { audio, notif } = await enableAlerts();
    setAlarmBusy(false);
    const parts: string[] = [];
    parts.push(audio ? "🔊 sonido OK" : "🔇 sonido bloqueado");
    parts.push(
      notif === "granted"
        ? "🔔 notificaciones OK"
        : notif === "denied"
          ? "🔕 notificaciones bloqueadas (actívalas en el candado de la barra)"
          : "🔔 notificaciones no disponibles",
    );
    setAlarmStatus(parts.join(" · "));
    setAlarmStatusClass(audio ? "text-emerald-300" : "text-amber-300");
    if (audio || notif === "granted") {
      setAlarmActive(true);
      setAlarmBtnLabel("Alarma activa ✓");
    }
  };

  // ---- Push ----
  const [pushMsg, setPushMsg] = createSignal('Pulsa "Recibir en este dispositivo".');
  const [pushOk, setPushOk] = createSignal(false);
  const [pushOn, setPushOn] = createSignal(false);
  const [pushBusy, setPushBusy] = createSignal(false);
  const [pushAvailable, setPushAvailable] = createSignal(true);

  const refreshPushUI = async () => {
    if (await pushSubscribed()) {
      setPushOn(true);
      setPushMsg("✅ Este dispositivo recibe avisos de gol.");
      setPushOk(true);
    } else {
      setPushOn(false);
      setPushMsg('Pulsa "Recibir en este dispositivo".');
      setPushOk(false);
    }
  };

  onMount(async () => {
    if (!pushSupported()) {
      setPushAvailable(false);
      setPushMsg("Este navegador no soporta push.");
      return;
    }
    await initPush();
    await refreshPushUI();
  });

  const onTogglePush = async () => {
    setPushBusy(true);
    if (await pushSubscribed()) {
      setPushMsg("Desuscribiendo…");
      await unsubscribePush();
      setPushMsg("Suscripción eliminada en este dispositivo.");
      setPushOk(false);
    } else {
      setPushMsg("Suscribiendo…");
      const { ok, reason } = await subscribePush();
      if (!ok) {
        setPushMsg(
          reason === "permiso-denegado"
            ? "🔕 Permiso denegado. Actívalo en el candado de la barra de direcciones."
            : "No se pudo suscribir (" + (reason ?? "error") + ").",
        );
        setPushOk(false);
        setPushBusy(false);
        return;
      }
      setPushMsg("✅ Suscrito. Te llegará la notificación aunque cierres la web.");
      setPushOk(true);
    }
    setPushBusy(false);
    await refreshPushUI();
  };

  const onTestPush = async () => {
    setPushMsg("Enviando push de prueba…");
    const n = await testPush();
    setPushMsg(
      n > 0 ? `Push enviado a ${n} dispositivo(s).` : "No hay dispositivos suscritos (pulsa 'Recibir' primero).",
    );
    setPushOk(n > 0);
  };

  return (
    <section class="border-b border-emerald-400/20 bg-emerald-400/5">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <span class="font-bold text-emerald-200">🔔 Alarma de gol → cupón PedidosYa</span>
        <button
          type="button"
          disabled={alarmBusy()}
          onClick={onEnableAlarm}
          class={
            alarmActive()
              ? "rounded-lg bg-emerald-700 px-3 py-1.5 font-extrabold text-emerald-950 transition"
              : "rounded-lg bg-emerald-500 px-3 py-1.5 font-extrabold text-emerald-950 transition hover:bg-emerald-400"
          }
        >
          {alarmBtnLabel()}
        </button>
        <button
          type="button"
          onClick={() => couponAlert({ matchLabel: "PRUEBA 1 - 0 TEST", scorer: "Esto es una prueba" })}
          class="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Probar
        </button>
        <span class={`text-xs ${alarmStatusClass()}`}>{alarmStatus()}</span>
      </div>
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 border-t border-white/5 px-4 py-3 text-sm">
        <span class="font-bold text-sky-200">📲 Aviso al celular (push)</span>
        <button
          type="button"
          disabled={!pushAvailable() || pushBusy()}
          onClick={onTogglePush}
          class={pushOn() ? PUSH_OFF_CLASS : PUSH_ON_CLASS}
        >
          {pushOn() ? "Dejar de recibir" : "Recibir en este dispositivo"}
        </button>
        <button
          type="button"
          disabled={!pushAvailable()}
          onClick={onTestPush}
          class="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Probar push
        </button>
        <span class={`text-xs ${pushOk() ? "text-sky-300" : "text-slate-400"}`}>{pushMsg()}</span>
      </div>
      <div class="mx-auto max-w-7xl px-4 pb-2 text-xs leading-relaxed text-slate-500">
        <strong>En la PC:</strong> "Activar alarma" + deja la pestaña abierta.{" "}
        <strong>En el celular:</strong> abre este sitio y pulsa "Recibir en este dispositivo" — te llega la notificación
        aunque la web esté cerrada. El aviso salta ~2–3 s tras la publicación del gol en ESPN (que va unos segundos
        detrás de la TV en vivo). El canje se hace en la <strong>app de PedidosYa</strong>.
      </div>
    </section>
  );
}
