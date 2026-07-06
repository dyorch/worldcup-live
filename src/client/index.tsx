import "./styles.css";
import { render } from "solid-js/web";
import App from "./App";
import { connect } from "./services/ws";
import { ingestSnapshot, applyScore, matchList, getMatch } from "./state/matches";
import { setConnStatus, setLastUpdate } from "./state/connection";
import { maybeCoupon, fireEvent } from "./services/coupon-pipeline";

const root = document.getElementById("root");
if (root) render(() => <App />, root);

// connect() alimenta el store reactivo (para el render) y el pipeline de cupón
// (alarma, animaciones y latencia), que corre igual en cualquier ruta.
connect({
  onSnapshot: (s) => {
    const fresh = ingestSnapshot(s);
    const now = Date.now();
    for (const m of matchList()) maybeCoupon(m);
    for (const { ev, match } of fresh) fireEvent(ev, match, now);
    setLastUpdate(now);
  },
  onScore: (u) => {
    applyScore(u);
    const m = getMatch(u.matchId);
    if (m) maybeCoupon(m);
    setLastUpdate(Date.now());
  },
  onEvent: (ev, match) => fireEvent(ev, match, Date.now()),
  onStatus: setConnStatus,
});
