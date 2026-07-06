import { createResource, createMemo, createSignal, createEffect, For, Show, onCleanup, onMount, type JSX } from "solid-js";
import type { Match, TeamSide } from "../../worker/types";
import { fmtStart } from "../lib/format";
import { Section, EmptyMsg } from "../components/Section";

const ROUNDS: { slug: string; label: string }[] = [
  { slug: "round-of-32", label: "16avos" },
  { slug: "round-of-16", label: "Octavos" },
  { slug: "quarterfinals", label: "Cuartos" },
  { slug: "semifinals", label: "Semis" },
  { slug: "final", label: "Final" },
];

const isThirdPlace = (m: Match): boolean =>
  /3rd|third|place|puesto/i.test(m.group) || /third|3rd-place/i.test(m.roundSlug);

// ¿Es un lado "placeholder" (aún sin equipo)? Ej: "Round of 16 5 Winner" / abbr "RD16 W5".
const isPlaceholderSide = (s: TeamSide): boolean => /\bwinner\b/i.test(s.name) || /w\s*\d+\s*$/i.test(s.abbr);

// Nº del partido de la ronda previa del que proviene este lado placeholder.
const feederSlot = (s: TeamSide): number | null => {
  const byName = s.name.match(/(\d+)\s*winner\b/i);
  if (byName) return Number(byName[1]);
  const byAbbr = s.abbr.match(/w\s*(\d+)\s*$/i);
  return byAbbr ? Number(byAbbr[1]) : null;
};

// Reordena cada ronda según la estructura REAL del cuadro (no por hora de inicio).
function bracketColumns(all: Match[]): { label: string; matches: Match[] }[] {
  const byRound = new Map<string, Match[]>();
  for (const m of all) {
    if (isThirdPlace(m) || !ROUNDS.some((r) => r.slug === m.roundSlug)) continue;
    (byRound.get(m.roundSlug) ?? byRound.set(m.roundSlug, []).get(m.roundSlug)!).push(m);
  }
  const present = ROUNDS.filter((r) => byRound.get(r.slug)?.length);
  if (!present.length) return [];
  const bySlot = present.map((r) => byRound.get(r.slug)!.sort((a, b) => Number(a.id) - Number(b.id)));

  const feedersOf = (m: Match, ri: number): Match[] => {
    if (ri === 0) return [];
    const prev = bySlot[ri - 1];
    const resolve = (s: TeamSide): Match | null => {
      if (isPlaceholderSide(s)) {
        const n = feederSlot(s);
        return n && prev[n - 1] ? prev[n - 1] : null;
      }
      return prev.find((p) => (p.home.winner && p.home.id === s.id) || (p.away.winner && p.away.id === s.id)) ?? null;
    };
    return [resolve(m.home), resolve(m.away)].filter((x): x is Match => !!x);
  };

  const order: Match[][] = present.map(() => []);
  order[present.length - 1] = bySlot[present.length - 1].slice();
  for (let ri = present.length - 1; ri >= 1; ri--) {
    const seen = new Set<string>();
    const ord: Match[] = [];
    for (const m of order[ri]) for (const f of feedersOf(m, ri)) if (!seen.has(f.id)) (seen.add(f.id), ord.push(f));
    for (const m of bySlot[ri - 1]) if (!seen.has(m.id)) ord.push(m);
    order[ri - 1] = ord;
  }
  return present.map((r, i) => ({ label: r.label, matches: order[i] }));
}

async function fetchMatches(dates: string): Promise<Match[]> {
  const r = await fetch(`/api/matches?dates=${dates}`, { cache: "no-store" });
  if (!r.ok) return [];
  const snap = (await r.json()) as { matches?: Match[] };
  return snap.matches ?? [];
}

function BkTeamRow(props: { side: TeamSide; winner: boolean; showScore: boolean }): JSX.Element {
  const s = () => props.side;
  return (
    <div class={`flex items-center justify-between gap-2 ${props.winner ? "font-bold text-white" : "text-slate-300"}`}>
      <span class="flex min-w-0 items-center gap-1.5">
        {s().logo ? (
          <img src={s().logo} alt="" loading="lazy" class="h-4 w-4 shrink-0 object-contain" />
        ) : (
          <span class="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/10 text-[8px]">
            {(s().abbr || "?").slice(0, 3)}
          </span>
        )}
        <span class="truncate">{s().abbr || s().name || "—"}</span>
      </span>
      <span class="tabnum">{props.showScore ? s().score : ""}</span>
    </div>
  );
}

function BkMatchCard(props: { m: Match }): JSX.Element {
  const m = () => props.m;
  const done = () => m().status === "post";
  const live = () => m().status === "in";
  const homeW = () => done() && m().home.score > m().away.score;
  const awayW = () => done() && m().away.score > m().home.score;
  const showScore = () => m().status !== "pre";
  const when = () => (live() ? m().displayClock || "EN VIVO" : done() ? m().statusDetail || "FT" : fmtStart(m().startUtc));
  return (
    <div
      class={`bk-match rounded-lg border ${live() ? "border-rose-500/50" : "border-white/10"} bg-slate-900/90 p-2 text-xs shadow`}
    >
      <BkTeamRow side={m().home} winner={homeW()} showScore={showScore()} />
      <div class="my-1 border-t border-white/5" />
      <BkTeamRow side={m().away} winner={awayW()} showScore={showScore()} />
      <div class={`mt-1 truncate text-[10px] ${live() ? "font-semibold text-rose-300" : "text-slate-500"}`}>{when()}</div>
    </div>
  );
}

// Vista BRACKET (árbol de eliminatorias con líneas SVG medidas del DOM).
export default function Bracket(): JSX.Element {
  const [matches, { refetch }] = createResource(() => "20260628-20260720", fetchMatches);
  const cols = createMemo(() => bracketColumns(matches() ?? []));
  const third = createMemo(() => (matches() ?? []).filter(isThirdPlace));

  let rootEl: HTMLDivElement | undefined;
  const [paths, setPaths] = createSignal<string[]>([]);
  const [dims, setDims] = createSignal({ w: 0, h: 0 });

  // Dibuja las líneas midiendo posiciones reales (robusto ante cualquier tamaño).
  function relayout(): void {
    const root = rootEl;
    if (!root || !root.isConnected) return;
    const colsEl = root.querySelector<HTMLElement>(".bk-cols");
    if (!colsEl) return;
    const rounds = [...colsEl.querySelectorAll<HTMLElement>(".bk-round")];
    setDims({ w: colsEl.scrollWidth, h: colsEl.scrollHeight });
    const center = (el: HTMLElement) => ({
      left: el.offsetLeft,
      right: el.offsetLeft + el.offsetWidth,
      mid: el.offsetTop + el.offsetHeight / 2,
    });
    const out: string[] = [];
    for (let r = 0; r < rounds.length - 1; r++) {
      const cur = [...rounds[r].querySelectorAll<HTMLElement>(".bk-match")];
      const next = [...rounds[r + 1].querySelectorAll<HTMLElement>(".bk-match")];
      cur.forEach((el, i) => {
        const tgt = next[Math.floor(i / 2)];
        if (!tgt) return;
        const a = center(el);
        const b = center(tgt);
        const midX = (a.right + b.left) / 2;
        out.push(`M${a.right} ${a.mid} H${midX} V${b.mid} H${b.left}`);
      });
    }
    setPaths(out);
  }

  // Re-medir cuando cambia la estructura del cuadro (tras cargar / refetch).
  createEffect(() => {
    cols();
    requestAnimationFrame(relayout);
  });

  // Redibujar al redimensionar (con debounce); listener limpiado al desmontar.
  onMount(() => {
    let t: number | undefined;
    const onResize = () => {
      if (t) clearTimeout(t);
      t = window.setTimeout(relayout, 150);
    };
    window.addEventListener("resize", onResize);
    const id = window.setInterval(() => void refetch(), 30000);
    onCleanup(() => {
      window.removeEventListener("resize", onResize);
      if (t) clearTimeout(t);
      clearInterval(id);
    });
  });

  return (
    <Show
      when={matches() !== undefined}
      fallback={
        <Section title="🏆 BRACKET · ELIMINATORIAS" count={null}>
          <EmptyMsg>Cargando bracket…</EmptyMsg>
        </Section>
      }
    >
      <Show
        when={cols().length}
        fallback={
          <Section title="🏆 BRACKET · ELIMINATORIAS" count={null}>
            <EmptyMsg>El bracket aparecerá cuando arranquen las eliminatorias.</EmptyMsg>
          </Section>
        }
      >
        <Section title="🏆 BRACKET · ELIMINATORIAS" count={null}>
          <div class="bk-wrap">
            <div class="bk-inner" ref={(el) => (rootEl = el)}>
              <svg
                class="bk-lines text-slate-600"
                xmlns="http://www.w3.org/2000/svg"
                width={dims().w}
                height={dims().h}
                viewBox={`0 0 ${dims().w} ${dims().h}`}
              >
                <For each={paths()}>{(d) => <path d={d} fill="none" stroke="currentColor" stroke-width="2" />}</For>
              </svg>
              <div class="bk-cols">
                <For each={cols()}>
                  {(c) => (
                    <div class="bk-round">
                      <div class="bk-round-head">{c.label}</div>
                      <div class="bk-matches">
                        <For each={c.matches}>{(m) => <BkMatchCard m={m} />}</For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
          <Show when={third().length}>
            <div class="mt-6">
              <div class="bk-round-head mb-2">🥉 3er puesto</div>
              <div class="max-w-xs">
                <For each={third()}>{(m) => <BkMatchCard m={m} />}</For>
              </div>
            </div>
          </Show>
        </Section>
      </Show>
    </Show>
  );
}
