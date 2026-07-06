import { For, Show, type JSX } from "solid-js";
import { standings } from "../state/matches";
import { Section, EmptyMsg } from "../components/Section";
import { GroupTable } from "../components/GroupTable";

// Vista GRUPOS (tabla de posiciones A–L).
export default function Groups(): JSX.Element {
  return (
    <Show
      when={standings().length}
      fallback={
        <Section title="📊 TABLA DE GRUPOS" count={null}>
          <EmptyMsg>Tabla de grupos no disponible por ahora.</EmptyMsg>
        </Section>
      }
    >
      <Section title="📊 TABLA DE GRUPOS" count={standings().length}>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <For each={standings()}>{(g) => <GroupTable g={g} />}</For>
        </div>
      </Section>
    </Show>
  );
}
