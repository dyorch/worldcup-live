import type { Env } from "./index";
import { fetchSnapshot, fetchStandings } from "./espn";
import { sendPush, type PushSub } from "./push";
import type { Snapshot, Match, MatchEvent, ServerMsg, GroupStanding } from "./types";

// Una sola instancia global ("global"): todos los navegadores comparten un único
// sondeo a ESPN. Usa la API de hibernación de WebSockets para no gastar duración.
export class MatchHub {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // --- Upgrade WebSocket ---
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]); // hibernación
      await this.ensureFresh(true); // si el snapshot está viejo, sondea YA antes de entregarlo
      const snap = await this.getSnapshot();
      if (snap) {
        try {
          pair[1].send(JSON.stringify({ type: "snapshot", data: snap } satisfies ServerMsg));
        } catch {}
      }
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/api/state") {
      await this.ensureFresh(true); // fuerza refresco si está viejo (autorreparación del polling)
      const snap = (await this.getSnapshot()) ?? { generatedAt: Date.now(), stage: "", matches: [] };
      return Response.json(snap, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/events") {
      const log = (await this.state.storage.get<MatchEvent[]>("eventLog")) ?? [];
      return Response.json(log, { headers: { "cache-control": "no-store" } });
    }

    // Webhook de entrada (futuro): un proveedor con push real puede postear aquí.
    if (url.pathname === "/ingest") {
      const ev = await req.json<MatchEvent>();
      ev.serverDetectedAt = Date.now();
      const match = await this.matchById(ev.matchId);
      if (match) this.broadcast({ type: "event", data: ev, match });
      await this.appendLog(ev);
      return new Response("ok");
    }

    if (url.pathname === "/internal/tick") {
      await this.ensureFresh(false); // cron 1/min: revive/desatasca el polling si quedó viejo o sin alarm
      return new Response("ok");
    }

    // ---- Web Push: suscripciones del navegador (para avisar al celular) ----
    if (url.pathname === "/push/subscribe") {
      const sub = await req.json<PushSub>();
      if (sub?.endpoint) {
        const subs = (await this.state.storage.get<PushSub[]>("pushSubs")) ?? [];
        if (!subs.some((s) => s.endpoint === sub.endpoint)) {
          subs.push(sub);
          await this.state.storage.put("pushSubs", subs);
        }
        await this.ensureFresh(false);
      }
      return Response.json({ ok: true });
    }
    if (url.pathname === "/push/unsubscribe") {
      const sub = await req.json<{ endpoint: string }>();
      let subs = (await this.state.storage.get<PushSub[]>("pushSubs")) ?? [];
      subs = subs.filter((s) => s.endpoint !== sub.endpoint);
      await this.state.storage.put("pushSubs", subs);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/push/test") {
      const n = await this.pushAll(
        "⚽ Prueba de alerta",
        "Si ves esto, las notificaciones de gol funcionan. ¡Listo para cazar cupones!",
      );
      return Response.json({ ok: true, sent: n });
    }

    return new Response("not found", { status: 404 });
  }

  // El alarm es el "reloj" del polling. Delega en poll(), que SIEMPRE reprograma el próximo
  // ciclo (aunque algo falle) para que el bucle no pueda morir y dejar el snapshot congelado.
  async alarm(): Promise<void> {
    await this.poll();
  }

  // Un ciclo de sondeo. Blindado: cualquier fallo intermedio no impide reprogramar el siguiente
  // alarm (finally), y el snapshot se persiste antes de los pasos "de adorno" (broadcast/log/push).
  async poll(): Promise<void> {
    let nextMs = 30_000; // fallback si algo raro pasa
    try {
      const prev = await this.getSnapshot();

      let next: Snapshot;
      try {
        next = await fetchSnapshot(this.env);
      } catch {
        nextMs = 10_000; // ESPN falló: backoff corto, conservar el último snapshot bueno
        return; // el finally reprograma con nextMs
      }

      // Refresco de standings con menor cadencia (~60 s) para no golpear ESPN cada ciclo.
      next.standings = await this.refreshStandings(prev?.standings);

      const now = Date.now();
      // Detectar goles/rojas nuevos (diff por id estable). En el primer ciclo solo sembramos.
      const fresh: { ev: MatchEvent; match: Match }[] = [];
      if (prev) {
        for (const m of next.matches) {
          for (const ev of this.newEvents(prev, m)) {
            ev.serverDetectedAt = now; // muta la referencia dentro de next (queda persistido)
            fresh.push({ ev, match: m });
          }
        }
      }

      // CRÍTICO: persistir el snapshot fresco antes que nada, para que el "en vivo" avance
      // aunque un broadcast/push posterior falle.
      await this.state.storage.put("snapshot", next);
      const live = next.matches.some((m) => m.status === "in");
      nextMs = Number(live ? (this.env.POLL_INTERVAL_LIVE ?? 2) : (this.env.POLL_INTERVAL_IDLE ?? 60)) * 1000;

      // Pasos de entrega: cada uno aislado para que un fallo no aborte el ciclo ni el reschedule.
      try {
        for (const { ev, match } of fresh) {
          this.broadcast({ type: "event", data: ev, match });
          await this.appendLog(ev);
        }
        for (const m of next.matches) {
          this.broadcast({
            type: "score",
            matchId: m.id,
            home: m.home.score,
            away: m.away.score,
            statusDetail: m.statusDetail,
            displayClock: m.displayClock,
            status: m.status,
          });
        }
        this.broadcast({ type: "snapshot", data: next });
      } catch {
        /* entrega parcial: el snapshot ya quedó guardado; seguimos */
      }

      // Web Push al detectar gol (por aumento de marcador): avisa al celular aunque la web esté cerrada.
      if (prev) {
        for (const m of next.matches) {
          const pm = prev.matches.find((x) => x.id === m.id);
          if (!pm) continue;
          if (m.home.score + m.away.score > pm.home.score + pm.away.score) {
            const scorer = fresh.find((f) => f.match.id === m.id && f.ev.kind === "goal")?.ev.player;
            try {
              await this.pushAll(
                "⚽ ¡GOL! — hay cupón en PedidosYa",
                `${m.home.abbr} ${m.home.score}-${m.away.score} ${m.away.abbr}${scorer ? " · " + scorer : ""} · ¡abre la app y canjea YA!`,
              );
            } catch {
              /* push best-effort */
            }
          }
        }
      }
    } catch {
      nextMs = 15_000; // error inesperado: reintentar pronto sin morir
    } finally {
      // SIEMPRE reprogramar: es lo que garantiza que el polling nunca se detenga.
      try {
        await this.state.storage.setAlarm(Date.now() + Math.max(1000, nextMs));
      } catch {
        /* si ni el setAlarm funciona, el cron 1/min lo revive vía ensureFresh */
      }
    }
  }

  // Envía una notificación push a todos los navegadores suscritos. Limpia suscripciones muertas.
  async pushAll(title: string, body: string): Promise<number> {
    const subs = (await this.state.storage.get<PushSub[]>("pushSubs")) ?? [];
    if (!subs.length || !this.env.VAPID_PRIVATE) return 0;
    const payload = JSON.stringify({ title, body, url: "https://www.pedidosya.com/" });
    const dead: string[] = [];
    let sent = 0;
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const status = await sendPush(this.env, s, payload);
          if (status === 404 || status === 410) dead.push(s.endpoint);
          else if (status >= 200 && status < 300) sent++;
        } catch {
          /* fallo puntual: ignorar */
        }
      }),
    );
    if (dead.length) {
      await this.state.storage.put(
        "pushSubs",
        subs.filter((s) => !dead.includes(s.endpoint)),
      );
    }
    return sent;
  }

  // --- helpers ---

  newEvents(prev: Snapshot | null, m: Match): MatchEvent[] {
    const before = new Set(
      (prev?.matches.find((x) => x.id === m.id)?.events ?? []).map((e) => e.id),
    );
    return m.events.filter(
      (e) => !before.has(e.id) && (e.kind === "goal" || e.kind === "red_card"),
    );
  }

  async refreshStandings(fallback?: GroupStanding[]): Promise<GroupStanding[] | undefined> {
    const lastAt = (await this.state.storage.get<number>("standingsAt")) ?? 0;
    const cached = (await this.state.storage.get<GroupStanding[]>("standings")) ?? fallback;
    if (Date.now() - lastAt < 60_000 && cached) return cached;
    try {
      const fresh = await fetchStandings(this.env);
      if (fresh.length) {
        await this.state.storage.put("standings", fresh);
        await this.state.storage.put("standingsAt", Date.now());
        return fresh;
      }
    } catch {}
    return cached;
  }

  broadcast(msg: ServerMsg): void {
    const text = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(text);
      } catch {}
    }
  }

  // Garantiza que el polling esté vivo y actualizado. Es la red de seguridad contra un alarm
  // "atascado" (programado pero que no avanza): si el snapshot está viejo, fuerza un sondeo YA.
  //  - block=true  → sondea sincrónicamente (para que /ws y /api/state entreguen dato fresco).
  //  - block=false → solo dispara el alarm inmediato (cron / suscripción push).
  async ensureFresh(block: boolean): Promise<void> {
    const snap = await this.getSnapshot();
    const stale = !snap || Date.now() - snap.generatedAt > 15_000;
    if (stale) {
      if (block) {
        await this.poll(); // sondea ahora (y reprograma el próximo ciclo en su finally)
      } else {
        // setAlarm siempre sobrescribe: desatasca un alarm colgado y lo hace disparar ya.
        await this.state.storage.setAlarm(Date.now());
      }
    } else if ((await this.state.storage.getAlarm()) === null) {
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
  }

  getSnapshot(): Promise<Snapshot | undefined> {
    return this.state.storage.get<Snapshot>("snapshot");
  }

  async matchById(id: string): Promise<Match | undefined> {
    return (await this.getSnapshot())?.matches.find((m) => m.id === id);
  }

  async appendLog(ev: MatchEvent): Promise<void> {
    const log = (await this.state.storage.get<MatchEvent[]>("eventLog")) ?? [];
    if (!log.some((e) => e.id === ev.id)) {
      log.push(ev);
      // Acotar para no exceder el límite de tamaño por clave del DO (evita que put() falle).
      if (log.length > 800) log.splice(0, log.length - 800);
      await this.state.storage.put("eventLog", log);
    }
  }

  // Hibernación: handlers al despertar por mensaje/cierre/error.
  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer): Promise<void> {
    // El cliente no necesita enviar nada; respondemos ping/pong simple por si acaso.
    if (msg === "ping") {
      try {
        ws.send("pong");
      } catch {}
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {}
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {}
  }
}
