import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

const TAB = "view-tab";

// Pestañas como enlaces reales: <A> resalta la ruta activa (activeClass) y respeta
// Ctrl/⌘+click y click central (abrir en pestaña nueva) de forma nativa.
// "/date" (sin día) se resalta también en "/date/2026-..." porque no lleva `end`.
export function Nav(): JSX.Element {
  return (
    <nav class="border-b border-white/10 bg-slate-950/60">
      <div class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm">
        <A href="/" end class={TAB} activeClass="tab-active">
          🔴 En vivo
        </A>
        <A href="/date" class={TAB} activeClass="tab-active">
          📅 Por fecha
        </A>
        <A href="/upcoming" class={TAB} activeClass="tab-active">
          🗓️ Próximos
        </A>
        <A href="/bracket" class={TAB} activeClass="tab-active">
          🏆 Bracket
        </A>
        <A href="/groups" class={TAB} activeClass="tab-active">
          📊 Grupos
        </A>
      </div>
    </nav>
  );
}
