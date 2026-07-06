// Cliente Web Push: registra el Service Worker, pide permiso, se suscribe y manda la
// suscripción al servidor. Pensado para el CELULAR (avisa aunque la web esté cerrada),
// aunque también funciona en escritorio.

const b64urlToUint8 = (s: string): Uint8Array<ArrayBuffer> => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

let swReg: ServiceWorkerRegistration | null = null;

export async function initPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
  } catch {
    /* sin SW: el push no estará disponible, pero la app sigue funcionando */
  }
}

export async function pushSubscribed(): Promise<boolean> {
  if (!swReg) return false;
  try {
    return !!(await swReg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "no-soportado" };
  if (!swReg) {
    try {
      swReg = await navigator.serviceWorker.register("/sw.js");
    } catch {
      return { ok: false, reason: "sw-error" };
    }
  }
  await navigator.serviceWorker.ready;

  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "permiso-denegado" };

  const key = (await (await fetch("/push/key")).text()).trim();
  if (!key) return { ok: false, reason: "sin-clave" };

  let sub = await swReg.pushManager.getSubscription();
  if (!sub) {
    sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToUint8(key),
    });
  }
  await fetch("/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub),
  });
  return { ok: true };
}

export async function unsubscribePush(): Promise<boolean> {
  if (!swReg) {
    try {
      swReg = (await navigator.serviceWorker.getRegistration()) ?? null;
    } catch {
      /* noop */
    }
  }
  if (!swReg) return false;
  try {
    const sub = await swReg.pushManager.getSubscription();
    if (!sub) return true;
    // Avisar al servidor para que la borre de su lista...
    try {
      await fetch("/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch {
      /* aunque falle el aviso, desuscribimos a nivel navegador */
    }
    // ...y desuscribir a nivel navegador / servicio push.
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

export async function testPush(): Promise<number> {
  try {
    const r = await fetch("/push/test", { method: "POST" });
    const j = (await r.json()) as { sent?: number };
    return j.sent ?? 0;
  } catch {
    return 0;
  }
}
