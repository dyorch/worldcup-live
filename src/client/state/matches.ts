import { createStore, reconcile, produce } from "solid-js/store";
import type { Match, Snapshot, MatchEvent, GroupStanding, MatchStatus } from "../../worker/types";

export interface NewEvent {
  ev: MatchEvent;
  match: Match;
}

export interface ScoreUpdate {
  matchId: string;
  home: number;
  away: number;
  statusDetail: string;
  displayClock: string;
  status: MatchStatus;
}

// reconcile({ key: "id" }) solo toca los campos que cambian y conserva la identidad
// de cada partido, así el marcador se actualiza sin repintar la tarjeta entera.
interface MatchesState {
  matches: Match[];
  standings: GroupStanding[];
  stage: string;
  generatedAt: number;
}

const [state, setState] = createStore<MatchesState>({
  matches: [],
  standings: [],
  stage: "",
  generatedAt: 0,
});

export const matchList = (): Match[] => state.matches;
export const getMatch = (id: string): Match | undefined => state.matches.find((m) => m.id === id);
export const standings = (): GroupStanding[] => state.standings;
export const stage = (): string => state.stage;

// El diff detecta goles/rojas nuevos comparando contra el snapshot anterior (necesario
// en modo polling — Plan B). La deduplicación final se hace por `MatchEvent.id`.
let prev: Snapshot | null = null;

export function ingestSnapshot(s: Snapshot): NewEvent[] {
  const fresh: NewEvent[] = [];
  if (prev) {
    for (const m of s.matches) {
      const before = new Set((prev.matches.find((x) => x.id === m.id)?.events ?? []).map((e) => e.id));
      for (const ev of m.events) {
        if (!before.has(ev.id) && (ev.kind === "goal" || ev.kind === "red_card")) fresh.push({ ev, match: m });
      }
    }
  }
  setState("matches", reconcile(s.matches, { key: "id" }));
  if (s.standings) setState("standings", s.standings);
  setState("stage", s.stage);
  setState("generatedAt", s.generatedAt);
  prev = s;
  return fresh;
}

export function applyScore(u: ScoreUpdate): void {
  setState(
    "matches",
    (m) => m.id === u.matchId,
    produce((m) => {
      m.home.score = u.home;
      m.away.score = u.away;
      m.statusDetail = u.statusDetail;
      m.displayClock = u.displayClock;
      m.status = u.status;
    }),
  );
}

export function upsertEvent(matchId: string, ev: MatchEvent): void {
  setState(
    "matches",
    (m) => m.id === matchId,
    produce((m) => {
      if (m.events.some((e) => e.id === ev.id)) return;
      m.events.push(ev);
      m.events.sort((a, b) => a.minuteSeconds - b.minuteSeconds);
    }),
  );
}
