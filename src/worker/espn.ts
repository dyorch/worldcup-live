// Aísla TODO el parseo del JSON crudo de ESPN. El resto del sistema solo ve tipos de types.ts.
import type { Env } from "./index";
import type {
  Snapshot,
  Match,
  MatchEvent,
  EventKind,
  TeamSide,
  GroupStanding,
  GroupRow,
} from "./types";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
const UA = "worldcup-live/1.0 (+personal dashboard)";

// Snapshot de partidos del matchday activo (o de ?dates=YYYYMMDD si se pasa).
export async function fetchSnapshot(env: Env, dates?: string): Promise<Snapshot> {
  void env; // reservado por si se necesita config en el futuro
  const url = dates ? `${SITE_BASE}/scoreboard?dates=${dates}` : `${SITE_BASE}/scoreboard`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cf: { cacheTtl: 0 }, // sin caché: 1 request por ciclo del DO y mínima latencia
  });
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
  const raw = await res.json<any>();

  const matches: Match[] = (raw.events ?? []).map(toMatch);
  const stage: string =
    raw.leagues?.[0]?.season?.type?.name ?? raw.season?.type?.name ?? "";
  return { generatedAt: Date.now(), stage, matches };
}

function toMatch(ev: any): Match {
  const c = ev.competitions?.[0] ?? {};
  const competitors: any[] = c.competitors ?? [];
  const abbrById: Record<string, string> = {};
  for (const t of competitors) {
    if (t?.team?.id) abbrById[t.team.id] = t.team.abbreviation ?? "";
  }

  const side = (which: "home" | "away"): TeamSide => {
    const t = competitors.find((x: any) => x.homeAway === which) ?? {};
    const team = t.team ?? {};
    return {
      id: team.id ?? "",
      name: team.displayName ?? team.name ?? "",
      abbr: team.abbreviation ?? "",
      logo: team.logo ?? team.logos?.[0]?.href ?? "",
      color: team.color ?? "64748b",
      score: Number(t.score ?? 0),
      homeAway: which,
      winner: t.winner === true,
    };
  };

  return {
    id: String(ev.id),
    status: ev.status?.type?.state ?? "pre",
    statusDetail: ev.status?.type?.detail ?? ev.status?.type?.shortDetail ?? "",
    displayClock: ev.status?.displayClock ?? "",
    startUtc: ev.date ?? "",
    group: (c.altGameNote ?? "").replace("FIFA World Cup, ", "").replace("FIFA World Cup", "").trim(),
    roundSlug: ev.season?.slug ?? ev.seasonType?.slug ?? "",
    venue: c.venue?.fullName ?? "",
    home: side("home"),
    away: side("away"),
    events: (c.details ?? [])
      .map((d: any) => toEvent(String(ev.id), d, abbrById))
      .sort((a: MatchEvent, b: MatchEvent) => a.minuteSeconds - b.minuteSeconds),
  };
}

function toEvent(matchId: string, d: any, abbrById: Record<string, string>): MatchEvent {
  // Clasificación por booleanos (NO por type.id).
  const kind: EventKind = d.scoringPlay
    ? "goal"
    : d.redCard
      ? "red_card"
      : d.yellowCard
        ? "yellow_card"
        : "other";
  const player = d.athletesInvolved?.[0]?.displayName ?? "";
  const minuteSeconds = Number(d.clock?.value ?? 0);
  const teamId = d.team?.id ?? "";
  return {
    id: `${matchId}:${kind}:${minuteSeconds}:${player}`.replace(/\s+/g, "_"),
    matchId,
    kind,
    teamId,
    teamAbbr: abbrById[teamId] ?? "",
    player,
    minuteLabel: d.clock?.displayValue ?? "",
    minuteSeconds,
    penalty: !!d.penaltyKick,
    ownGoal: !!d.ownGoal,
    detail: d.type?.text ?? "",
    serverDetectedAt: 0, // lo setea el DO al detectarlo
  };
}

// Tabla por grupos. Defensivo: si la estructura no calza, devuelve [] (la UI lo tolera).
export async function fetchStandings(env: Env): Promise<GroupStanding[]> {
  void env;
  const res = await fetch(STANDINGS_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cf: { cacheTtl: 30 },
  });
  if (!res.ok) throw new Error(`ESPN standings ${res.status}`);
  const raw = await res.json<any>();

  const groups: GroupStanding[] = [];
  const children: any[] = raw.children ?? raw.standings?.groups ?? [];
  for (const child of children) {
    const entries: any[] = child.standings?.entries ?? child.entries ?? [];
    if (!entries.length) continue;
    const rows: GroupRow[] = entries.map((e: any, i: number) => {
      const team = e.team ?? {};
      const stats: any[] = e.stats ?? [];
      const stat = (...names: string[]): number => {
        for (const n of names) {
          const f = stats.find((s: any) => s.name === n || s.type === n);
          if (f && f.value != null) return Number(f.value);
        }
        return 0;
      };
      const rank = stat("rank") || i + 1;
      return {
        teamId: team.id ?? "",
        name: team.displayName ?? team.name ?? "",
        abbr: team.abbreviation ?? "",
        logo: team.logos?.[0]?.href ?? team.logo ?? "",
        rank,
        gamesPlayed: stat("gamesPlayed"),
        wins: stat("wins"),
        draws: stat("ties", "draws"),
        losses: stat("losses"),
        goalsFor: stat("pointsFor", "goalsFor"),
        goalsAgainst: stat("pointsAgainst", "goalsAgainst"),
        goalDiff: stat("pointDifferential", "goalDifference", "pointDiff"),
        points: stat("points"),
      };
    });
    rows.sort((a, b) => a.rank - b.rank);
    groups.push({
      group: (child.name ?? child.abbreviation ?? "").replace("FIFA World Cup, ", "").trim(),
      rows,
    });
  }
  groups.sort((a, b) => a.group.localeCompare(b.group));
  return groups;
}
