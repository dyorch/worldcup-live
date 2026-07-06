import { Show, For, type JSX } from "solid-js";
import type { Match, MatchEvent, TeamSide } from "../../worker/types";
import { fmtStart } from "../lib/format";

const evIcon = (e: MatchEvent): string =>
  e.kind === "goal" ? (e.ownGoal ? "🥅" : "⚽") : e.kind === "red_card" ? "🟥" : e.kind === "yellow_card" ? "🟨" : "•";

function StatusBadge(props: { m: Match }): JSX.Element {
  const m = () => props.m;
  return (
    <>
      {m().status === "in" ? (
        <span class="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">
          <span class="h-2 w-2 rounded-full bg-rose-500 pulse-dot" />
          {m().displayClock || m().statusDetail || "EN VIVO"}
        </span>
      ) : m().status === "post" ? (
        <span class="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
          {m().statusDetail || "Final"}
        </span>
      ) : (
        <span class="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
          {fmtStart(m().startUtc)}
        </span>
      )}
    </>
  );
}

function TeamBlock(props: { side: TeamSide }): JSX.Element {
  const side = () => props.side;
  return (
    <div class="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <div class="grid h-12 w-12 place-items-center">
        {side().logo ? (
          <img src={side().logo} alt={side().abbr || side().name} loading="lazy" class="h-12 w-12 object-contain" />
        ) : (
          <div class="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-xs font-bold">
            {side().abbr || "?"}
          </div>
        )}
      </div>
      <span class="truncate text-sm font-semibold" title={side().name} style={{ "max-width": "7rem" }}>
        {side().abbr || side().name}
      </span>
    </div>
  );
}

function EventRow(props: { e: MatchEvent; m: Match }): JSX.Element {
  const e = () => props.e;
  const label = () => `${e().player || e().teamAbbr}${e().penalty ? " (pen.)" : ""}${e().ownGoal ? " (e.p.)" : ""}`;
  const isHome = () => !!e().teamId && e().teamId === props.m.home.id;
  return (
    <>
      {isHome() ? (
        <li class="flex items-center gap-2">
          <span>{evIcon(e())}</span>
          <span class="tabnum text-slate-500">{e().minuteLabel}</span>
          <span class="truncate">{label()}</span>
        </li>
      ) : (
        <li class="flex items-center justify-end gap-2 text-right">
          <span class="truncate">{label()}</span>
          <span class="tabnum text-slate-500">{e().minuteLabel}</span>
          <span>{evIcon(e())}</span>
        </li>
      )}
    </>
  );
}

function EventsList(props: { m: Match }): JSX.Element {
  const evs = () => props.m.events.filter((e) => e.kind === "goal" || e.kind === "red_card");
  return (
    <Show when={evs().length}>
      <ul class="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-slate-300">
        <For each={evs()}>{(e) => <EventRow e={e} m={props.m} />}</For>
      </ul>
    </Show>
  );
}

// Tarjeta de partido (reusada por Live / DateView / Upcoming).
export function MatchCard(props: { m: Match }): JSX.Element {
  const m = () => props.m;
  const accent = () => (/^[0-9a-fA-F]{6}$/.test(m().home.color) ? `#${m().home.color}` : "#334155");
  const phase = () => m().group || "—";
  return (
    <article
      class="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg shadow-black/20"
      style={{ "border-top": `3px solid ${accent()}` }}
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <span class="truncate text-xs text-slate-500" title={m().venue}>
          {phase()}
          {m().venue ? " · " + m().venue : ""}
        </span>
        <StatusBadge m={m()} />
      </div>
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamBlock side={m().home} />
        <div class="px-2 text-center">
          <div class="text-3xl font-black tabnum leading-none">
            {m().status === "pre" ? (
              <span class="text-slate-600">vs</span>
            ) : (
              <>
                {m().home.score}
                <span class="px-1 text-slate-600">-</span>
                {m().away.score}
              </>
            )}
          </div>
        </div>
        <TeamBlock side={m().away} />
      </div>
      <EventsList m={m()} />
    </article>
  );
}
