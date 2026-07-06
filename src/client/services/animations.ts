import type { MatchEvent, Match } from "../../worker/types";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let soundOn = false;
export function setSoundEnabled(v: boolean): void {
  soundOn = v;
}

// Cola: si caen dos goles casi juntos, se muestran en secuencia (no encimados).
const queue: (() => Promise<void>)[] = [];
let running = false;
async function run(): Promise<void> {
  if (running) return;
  running = true;
  while (queue.length) await queue.shift()!();
  running = false;
}

export function playGoal(ev: MatchEvent, m: Match): void {
  const extra = ev.penalty ? " (penal)" : ev.ownGoal ? " (en propia)" : "";
  queue.push(() =>
    overlay({
      badge: "⚽",
      title: "¡GOOOL!",
      sub: `${ev.player || ev.teamAbbr || "Gol"} · ${ev.minuteLabel}${extra}`,
      score: scoreLine(m),
      variant: "goal",
    }),
  );
  void run();
}

export function playRedCard(ev: MatchEvent, m: Match): void {
  queue.push(() =>
    overlay({
      badge: "🟥",
      title: "TARJETA ROJA",
      sub: `${ev.player || ev.teamAbbr || ""} · ${ev.minuteLabel}`.trim(),
      score: scoreLine(m),
      variant: "red",
    }),
  );
  void run();
}

function scoreLine(m: Match): string {
  return `${m.home.abbr} ${m.home.score} - ${m.away.score} ${m.away.abbr}`;
}

interface OverlayOpts {
  badge: string;
  title: string;
  sub: string;
  score: string;
  variant: "goal" | "red";
}

// Construcción segura por nodos (textContent), nunca innerHTML con datos de la fuente.
function overlay(o: OverlayOpts): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = `fx-overlay fx-${o.variant}` + (reduce ? " fx-reduced" : "");

    const card = document.createElement("div");
    card.className = "fx-card";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "fx-x";
    close.setAttribute("aria-label", "cerrar");
    close.textContent = "✕";

    const badge = document.createElement("div");
    badge.className = "fx-badge";
    badge.textContent = o.badge;

    const title = document.createElement("div");
    title.className = "fx-title";
    title.textContent = o.title;

    const sub = document.createElement("div");
    sub.className = "fx-sub";
    sub.textContent = o.sub;

    const score = document.createElement("div");
    score.className = "fx-score tabnum";
    score.textContent = o.score;

    card.append(close, badge, title, sub, score);
    el.append(card);
    document.body.append(el);

    // Cierre único: por clic en la X o por auto-cierre. Nunca resuelve dos veces (romperia la cola).
    let done = false;
    let timer = 0;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      el.remove();
      resolve();
    };
    close.addEventListener("click", finish);

    playSound(o.variant);

    const ms = reduce ? 1400 : 3600;
    timer = window.setTimeout(finish, ms);
  });
}

function playSound(variant: "goal" | "red"): void {
  if (!soundOn) return;
  try {
    const a = new Audio(variant === "goal" ? "/goal.mp3" : "/red.mp3");
    a.volume = 0.6;
    a.play().catch(() => {
      /* archivo opcional ausente o bloqueado por autoplay */
    });
  } catch {
    /* noop */
  }
}
