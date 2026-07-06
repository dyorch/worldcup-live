import { createResource, createMemo, createEffect, For, Show, onCleanup, onMount, type JSX } from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import type { Match } from "../../worker/types";
import { todayInput, dayToDates, shiftDay, isValidDay, prettyDate, byStart } from "../lib/format";
import { Section, Grid, EmptyMsg } from "../components/Section";
import { MatchCard } from "../components/MatchCard";

async function fetchMatches(dates: string): Promise<Match[]> {
  const r = await fetch(`/api/matches?dates=${dates}`, { cache: "no-store" });
  if (!r.ok) return [];
  const snap = (await r.json()) as { matches?: Match[] };
  return snap.matches ?? [];
}

// Vista POR FECHA. El día vive en la URL (/date/:day?); day inválido -> redirige a hoy.
export default function DateView(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();

  const day = (): string => (params.day && isValidDay(params.day) ? params.day : todayInput());

  // Redirección de un día malformado en la URL (efecto, no dentro del render).
  createEffect(() => {
    if (params.day && !isValidDay(params.day)) navigate(`/date/${todayInput()}`, { replace: true });
  });

  const [matches, { refetch }] = createResource(() => dayToDates(day()), fetchMatches);

  // Refresco de marcadores en vivo cada 30 s (cacheado en el worker). Se limpia al desmontar.
  onMount(() => {
    const id = window.setInterval(() => void refetch(), 30000);
    onCleanup(() => clearInterval(id));
  });

  const live = createMemo(() =>
    (matches() ?? []).filter((m) => m.status === "in").sort(byStart),
  );
  const post = createMemo(() =>
    (matches() ?? []).filter((m) => m.status === "post").sort(byStart),
  );
  const pre = createMemo(() =>
    (matches() ?? []).filter((m) => m.status === "pre").sort(byStart),
  );

  const navBtn = "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold hover:bg-white/10";

  return (
    <>
      <div class="mb-6 flex flex-wrap items-center gap-2">
        <A href={`/date/${shiftDay(day(), -1)}`} class={navBtn}>
          ◀ Día anterior
        </A>
        <input
          type="date"
          value={day()}
          onChange={(e) => navigate(`/date/${e.currentTarget.value || todayInput()}`)}
          class="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
        <A href={`/date/${shiftDay(day(), 1)}`} class={navBtn}>
          Día siguiente ▶
        </A>
        <A
          href={`/date/${todayInput()}`}
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          Hoy
        </A>
        <span class="ml-1 text-sm capitalize text-slate-400">{prettyDate(day())}</span>
      </div>
      <Show when={matches() !== undefined} fallback={<EmptyMsg>Cargando partidos…</EmptyMsg>}>
        <Show when={(matches() ?? []).length} fallback={<EmptyMsg>No hay partidos en esta fecha.</EmptyMsg>}>
          <Show when={live().length}>
            <Section title="🔴 EN VIVO" count={live().length}>
              <Grid>
                <For each={live()}>{(m) => <MatchCard m={m} />}</For>
              </Grid>
            </Section>
          </Show>
          <Show when={post().length}>
            <Section title="✅ RESULTADOS" count={post().length}>
              <Grid>
                <For each={post()}>{(m) => <MatchCard m={m} />}</For>
              </Grid>
            </Section>
          </Show>
          <Show when={pre().length}>
            <Section title="🗓️ PROGRAMADOS" count={pre().length}>
              <Grid>
                <For each={pre()}>{(m) => <MatchCard m={m} />}</For>
              </Grid>
            </Section>
          </Show>
        </Show>
      </Show>
    </>
  );
}
