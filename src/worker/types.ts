// Contrato de datos compartido cliente <-> servidor.
// El cliente importa estos mismos tipos (solo type imports): NUNCA reinterpreta el JSON crudo de ESPN.

export type MatchStatus = "pre" | "in" | "post";
export type EventKind = "goal" | "red_card" | "yellow_card" | "other";

export interface TeamSide {
  id: string; // id ESPN del equipo
  name: string; // "Argentina"
  abbr: string; // "ARG"
  logo: string; // url del escudo
  color: string; // hex sin '#'
  score: number; // marcador actual
  homeAway: "home" | "away";
  winner?: boolean; // true si este equipo ganó (competitor.winner de ESPN; fiable incluso con penales)
}

export interface MatchEvent {
  id: string; // id estable: `${matchId}:${kind}:${minuteSeconds}:${player}`
  matchId: string;
  kind: EventKind;
  teamId: string;
  teamAbbr: string;
  player: string; // "Boualem Khoukhi"
  minuteLabel: string; // "90'+4'"
  minuteSeconds: number; // 5400 (segundos de juego)
  penalty: boolean;
  ownGoal: boolean;
  detail: string; // type.text de ESPN, ej. "Goal - Header"
  serverDetectedAt: number; // Date.now() del servidor al detectarlo (epoch ms, UTC)
}

export interface Match {
  id: string;
  status: MatchStatus;
  statusDetail: string; // "FT", "HT", "Scheduled", "45'+2'"
  displayClock: string; // reloj en vivo
  startUtc: string; // ISO date (UTC)
  group: string; // "Group I" o fase
  roundSlug: string; // "group-stage" | "round-of-32" | "round-of-16" | "quarterfinals" | "semifinals" | "final" | ...
  venue: string;
  home: TeamSide;
  away: TeamSide;
  events: MatchEvent[]; // ordenados por minuteSeconds
}

// Fila de la tabla de un grupo.
export interface GroupRow {
  teamId: string;
  name: string;
  abbr: string;
  logo: string;
  rank: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GroupStanding {
  group: string; // "Group A"
  rows: GroupRow[];
}

export interface Snapshot {
  generatedAt: number; // epoch ms del servidor
  stage: string; // "Group Stage", etc.
  matches: Match[];
  standings?: GroupStanding[]; // tabla por grupos (refrescada con menor cadencia)
}

// Mensajes del WebSocket (servidor -> cliente)
export type ServerMsg =
  | { type: "snapshot"; data: Snapshot } // estado completo (al conectar y periódico)
  | { type: "event"; data: MatchEvent; match: Match } // evento nuevo (gol/roja) -> dispara animación
  | {
      type: "score";
      matchId: string;
      home: number;
      away: number;
      statusDetail: string;
      displayClock: string;
      status: MatchStatus;
    };
