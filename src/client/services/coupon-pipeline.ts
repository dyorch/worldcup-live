import type { Match, MatchEvent } from "../../worker/types";
import { playGoal, playRedCard } from "./animations";
import { couponAlert } from "./alerts";
import { upsertEvent } from "../state/matches";
import { setLatency } from "../state/connection";

// Detección de gol -> alarma de cupón. Vive fuera de los componentes y se dispara
// desde connect() (index.tsx), para que suene en cualquier pestaña.
// Los Sets/Map de dedup se mantienen a nivel de módulo y no se limpian al navegar,
// para no repetir la alarma tras una reconexión del WS o un solape con el polling.

const baselineTotals = new Map<string, number>();
const couponSeen = new Set<string>();
const seen = new Set<string>();

export function maybeCoupon(m: Match, scorer?: string): void {
  const total = (m.home.score || 0) + (m.away.score || 0);
  if (!baselineTotals.has(m.id)) {
    baselineTotals.set(m.id, total);
    return;
  }
  if (total <= baselineTotals.get(m.id)!) return;
  const key = `${m.id}:${total}`;
  if (couponSeen.has(key)) return;
  couponSeen.add(key);
  couponAlert({ matchLabel: `${m.home.abbr} ${m.home.score} - ${m.away.score} ${m.away.abbr}`, scorer });
}

export function fireEvent(ev: MatchEvent, match: Match, receivedAt: number): void {
  if (seen.has(ev.id)) return;
  seen.add(ev.id);
  if (ev.kind === "goal") {
    playGoal(ev, match);
    maybeCoupon(match, ev.player || ev.teamAbbr);
  } else if (ev.kind === "red_card") {
    playRedCard(ev, match);
  }
  upsertEvent(match.id, ev); // el re-render lo dispara la reactividad del store
  if (ev.serverDetectedAt) setLatency(receivedAt - ev.serverDetectedAt);
}
