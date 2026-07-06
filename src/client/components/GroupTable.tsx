import { For, type JSX } from "solid-js";
import type { GroupStanding } from "../../worker/types";

// Tabla de posiciones de un grupo (antes groupTable en render.ts).
export function GroupTable(props: { g: GroupStanding }): JSX.Element {
  const g = () => props.g;
  return (
    <div class="rounded-xl border border-white/10 bg-slate-900/50 p-3">
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{g().group || "Grupo"}</h3>
      <table class="w-full border-collapse text-xs">
        <thead class="text-slate-500">
          <tr class="border-b border-white/10">
            <th class="px-1.5 py-1 text-left font-semibold">#</th>
            <th class="px-1.5 py-1 text-left font-semibold">Equipo</th>
            <th class="px-1.5 py-1 text-center font-semibold">PJ</th>
            <th class="px-1.5 py-1 text-center font-semibold">DG</th>
            <th class="px-1.5 py-1 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          <For each={g().rows}>
            {(r, i) => (
              <tr class={`border-b border-white/5 ${i() < 2 ? "text-emerald-200" : "text-slate-300"}`}>
                <td class="px-1.5 py-1 tabnum text-slate-500">{r.rank}</td>
                <td class="px-1.5 py-1">
                  <span class="flex items-center gap-1.5">
                    {r.logo && <img src={r.logo} alt="" loading="lazy" class="h-4 w-4 object-contain" />}
                    <span class="truncate">{r.abbr || r.name}</span>
                  </span>
                </td>
                <td class="px-1.5 py-1 text-center tabnum">{r.gamesPlayed}</td>
                <td class="px-1.5 py-1 text-center tabnum text-slate-400">
                  {r.goalDiff > 0 ? "+" : ""}
                  {r.goalDiff}
                </td>
                <td class="px-1.5 py-1 text-center font-bold tabnum">{r.points}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
