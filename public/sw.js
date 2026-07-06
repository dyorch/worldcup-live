// Service Worker de World Cup Live: recibe Web Push y muestra la notificación de gol,
// aunque la web esté cerrada. El canje se hace en la app de PedidosYa.

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "⚽ ¡GOL!", body: event.data && event.data.text ? event.data.text() : "" };
  }
  const title = data.title || "⚽ ¡GOL! — hay cupón";
  const options = {
    body: data.body || "Abre PedidosYa en tu celular y canjea ya",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "wc-goal",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 300],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
