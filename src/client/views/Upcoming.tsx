import { createResource, createMemo, For, Show, onCleanup, onMount, type JSX } from "solid-js";
import type { Match } from "../../worker/types";
import { todayInput, dayToDates, toInputDate, prettyDate, byStart } from "../lib/format";
import { Section, Grid, EmptyMsg } from "../components/Section";
import { MatchCard } from "../components/MatchCard";

async function fetchMatches(dates: string): Promise<Match[]> {
  const r = await fetch(`/api/matches?dates=${dates}`, { cache: "no-store" });
  if (!r.ok) return [];
  const snap = (await r.json()) as { matches?: Match[] };
  return snap.matches ?? [];
}

// Vista PRÓXIMOS: todos los partidos que aún no se juegan (hoy → 19 jul), agrupados por día.
export default function Upcoming(): JSX.Element {
  const [matches, { refetch }] = createResource(() => `${dayToDates(todayInput())}-20260719`, fetchMatches);

  onMount(() => {
    const id = window.setInterval(() => void refetch(), 30000);
    onCleanup(() => clearInterval(id));
  });

  const groups = createMemo<[string, Match[]][]>(() => {
    const pre = (matches() ?? []).filter((m) => m.status === "pre" || m.status === "in").sort(byStart);
    const map = new Map<string, Match[]>();
    for (const m of pre) {
      const key = toInputDate(new Date(m.startUtc));
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(m);
    }
    return [...map.entries()];
  });

  return (
    <Show
      when={matches() !== undefined}
      fallback={
        <Section title="🗓️ PRÓXIMOS PARTIDOS" count={null}>
          <EmptyMsg>Cargando próximos partidos…</EmptyMsg>
        </Section>
      }
    >
      <Show
        when={groups().length}
        fallback={
          <Section title="🗓️ PRÓXIMOS PARTIDOS" count={0}>
            <EmptyMsg>No hay próximos partidos programados.</EmptyMsg>
          </Section>
        }
      >
        <div class="mb-2 text-sm text-slate-400">Todos los partidos que aún no se juegan.</div>
        <For each={groups()}>
          {([day, ms]) => (
            <Section title={`📅 ${prettyDate(day)}`} count={ms.length}>
              <Grid>
                <For each={ms}>{(m) => <MatchCard m={m} />}</For>
              </Grid>
            </Section>
          )}
        </For>
      </Show>
    </Show>
  );
}
