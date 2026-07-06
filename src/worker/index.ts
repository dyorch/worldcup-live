import { MatchHub } from "./MatchHub";
import { fetchSnapshot } from "./espn";
export { MatchHub };

export interface Env {
  MATCH_HUB: DurableObjectNamespace;
  ASSETS: Fetcher;
  INGEST_SECRET?: string;
  FOOTBALL_DATA_API_KEY?: string;
  POLL_INTERVAL_LIVE?: string;
  POLL_INTERVAL_IDLE?: string;
  VAPID_PUBLIC?: string; // clave pública VAPID (base64url) — la usa el cliente para suscribirse
  VAPID_PRIVATE?: string; // JWK privado en base64 — SECRETO
  VAPID_SUBJECT?: string; // mailto: de contacto VAPID
}

const hub = (env: Env) => env.MATCH_HUB.get(env.MATCH_HUB.idFromName("global"));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/ws") return hub(env).fetch(req); // WebSocket upgrade
    if (url.pathname === "/api/state") return hub(env).fetch(req); // snapshot JSON
    if (url.pathname === "/api/events") return hub(env).fetch(req); // log de eventos

    // Partidos de una fecha o rango (por-fecha / próximos / bracket). Cacheado ~30 s; no toca el DO.
    if (url.pathname === "/api/matches") {
      const dates = url.searchParams.get("dates") ?? "";
      if (!/^\d{8}(-\d{8})?$/.test(dates)) {
        return new Response("bad dates", { status: 400 });
      }
      const cache = caches.default;
      const cacheKey = new Request(`https://hub/api/matches?dates=${dates}`);
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
      try {
        const snap = await fetchSnapshot(env, dates);
        const res = Response.json(snap, {
          headers: { "cache-control": "max-age=30", "x-source": "espn" },
        });
        await cache.put(cacheKey, res.clone());
        return res;
      } catch (e) {
        return new Response("upstream error", { status: 502 });
      }
    }

    if (url.pathname === "/ingest" && req.method === "POST") {
      if (!env.INGEST_SECRET || req.headers.get("x-ingest-secret") !== env.INGEST_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      return hub(env).fetch(new Request("https://hub/ingest", req));
    }

    // ---- Web Push ----
    if (url.pathname === "/push/key") {
      return new Response(env.VAPID_PUBLIC ?? "", {
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      });
    }
    if (
      (url.pathname === "/push/subscribe" ||
        url.pathname === "/push/unsubscribe" ||
        url.pathname === "/push/test") &&
      req.method === "POST"
    ) {
      return hub(env).fetch(new Request("https://hub" + url.pathname, req));
    }

    // Resto: SPA estático (con fallback a index.html por not_found_handling=SPA).
    return env.ASSETS.fetch(req);
  },

  // Cron 1/min: "despierta" el hub si quedó dormido (el polling sub-minuto lo da el ALARM del DO).
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await hub(env).fetch(new Request("https://hub/internal/tick"));
  },
} satisfies ExportedHandler<Env>;
