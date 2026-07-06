import { Show, type JSX } from "solid-js";
import { connStatus, latency, lastUpdate } from "../state/connection";
import type { ConnStatus } from "../services/ws";

const CONN: Record<ConnStatus, [string, string]> = {
  connecting: ["bg-amber-400", "Conectando…"],
  ws: ["bg-emerald-400", "En vivo · WebSocket"],
  polling: ["bg-sky-400", "Polling (fallback)"],
};

export function Header(): JSX.Element {
  return (
    <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <h1 class="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl">
          <span class="text-2xl">⚽</span>
          World Cup <span class="text-emerald-400">Live</span>
          <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold text-emerald-300">2026</span>
        </h1>
        <div class="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold">
            <span class={`h-2 w-2 rounded-full pulse-dot ${CONN[connStatus()][0]}`} />
            {CONN[connStatus()][1]}
          </span>
          <Show when={latency() != null}>
            <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-slate-300">
              push ~{Math.max(0, Math.round(latency()!))} ms
            </span>
          </Show>
          <Show when={lastUpdate() != null}>
            <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-400">
              act. {new Date(lastUpdate()!).toLocaleTimeString([], { hour12: false })}
            </span>
          </Show>
        </div>
      </div>
    </header>
  );
}
