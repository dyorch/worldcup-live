import type { ServerMsg, Snapshot, MatchEvent, Match } from "../../worker/types";
import type { ScoreUpdate } from "../state/matches";

export type ConnStatus = "connecting" | "ws" | "polling";

interface Handlers {
  onSnapshot: (s: Snapshot) => void;
  onScore: (u: ScoreUpdate) => void;
  onEvent: (ev: MatchEvent, match: Match) => void;
  onStatus?: (s: ConnStatus) => void;
}

// Plan A: WebSocket empujado por el servidor. Si el WS cae, fallback a polling /api/state
// (Plan B) sin perder funcionalidad, y reintento del WS con backoff exponencial.
export function connect(h: Handlers): void {
  let ws: WebSocket | null = null;
  let backoff = 500;
  let pollTimer: number | null = null;

  const status = (s: ConnStatus) => h.onStatus?.(s);

  const startPollingFallback = () => {
    if (pollTimer) return;
    status("polling");
    const tick = async () => {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        h.onSnapshot((await r.json()) as Snapshot);
      } catch {
        /* red de seguridad: ignorar fallos puntuales */
      }
    };
    pollTimer = setInterval(tick, 2500) as unknown as number;
    void tick();
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const open = () => {
    status("connecting");
    try {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
    } catch {
      startPollingFallback();
      window.setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 10000);
      return;
    }

    ws.onopen = () => {
      backoff = 500;
      stopPolling();
      status("ws");
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data as string) as ServerMsg;
      } catch {
        return;
      }
      if (msg.type === "snapshot") h.onSnapshot(msg.data);
      else if (msg.type === "score") h.onScore(msg);
      else if (msg.type === "event") h.onEvent(msg.data, msg.match);
    };
    ws.onclose = () => {
      startPollingFallback(); // mantener datos vivos mientras reconecta
      window.setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 10000);
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  };

  open();
}
