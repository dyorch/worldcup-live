import { createMemo, For, Show, type JSX } from "solid-js";
import { matchList } from "../state/matches";
import { byStart } from "../lib/format";
import { Section, Grid, EmptyMsg } from "../components/Section";
import { MatchCard } from "../components/MatchCard";

// Vista EN VIVO (hoy, tiempo real desde el store reactivo).
export default function Live(): JSX.Element {
  const live = createMemo(() => matchList().filter((m) => m.status === "in"));
  const pre = createMemo(() =>
    matchList()
      .filter((m) => m.status === "pre")
      .sort(byStart),
  );
  const post = createMemo(() => matchList().filter((m) => m.status === "post"));

  return (
    <>
      <Section title="🔴 EN VIVO" count={live().length}>
        <Show when={live().length} fallback={<EmptyMsg>No hay partidos en vivo en este momento.</EmptyMsg>}>
          <Grid>
            <For each={live()}>{(m) => <MatchCard m={m} />}</For>
          </Grid>
        </Show>
      </Section>
      <Section title="🗓️ PRÓXIMOS (hoy)" count={pre().length}>
        <Show when={pre().length} fallback={<EmptyMsg>Sin próximos hoy.</EmptyMsg>}>
          <Grid>
            <For each={pre()}>{(m) => <MatchCard m={m} />}</For>
          </Grid>
        </Show>
      </Section>
      <Section title="✅ RESULTADOS (hoy)" count={post().length}>
        <Show when={post().length} fallback={<EmptyMsg>Aún sin resultados hoy.</EmptyMsg>}>
          <Grid>
            <For each={post()}>{(m) => <MatchCard m={m} />}</For>
          </Grid>
        </Show>
      </Section>
    </>
  );
}
