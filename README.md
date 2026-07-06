# ⚽ World Cup Live 2026

Tablero en **tiempo real** del Mundial 2026: partidos en vivo, próximos, resultados,
bracket de eliminatorias y tabla de grupos — con **animación al detectar un gol o una
tarjeta roja** y una **alarma configurable** pensada para no perderse ningún evento.

🔗 **En vivo:** [world-cup.dyorch.com](https://world-cup.dyorch.com)

---

## Características

- **Tiempo real por WebSocket.** El servidor sondea la fuente y **empuja** los cambios
  al navegador; para el cliente es indistinguible de un webhook.
- **Animaciones de gol y tarjeta roja** (overlay a pantalla, en cola, respeta
  `prefers-reduced-motion`).
- **Alarma de gol** multicanal: sirena (Web Audio), notificación de escritorio, banner
  persistente y parpadeo del título de la pestaña. Funciona en cualquier vista.
- **Web Push** al celular (Service Worker): el aviso llega aunque la web esté cerrada.
- **Router (SPA)** con URLs limpias: `/`, `/date/:day`, `/upcoming`, `/bracket`,
  `/groups`. Deep-linking, recarga y botón atrás/adelante.
- **Reactividad fina:** los marcadores hacen *tick* sin reconstruir la tarjeta.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | **SolidJS** + `@solidjs/router` + Vite + Tailwind CSS (TypeScript) |
| Backend / hosting | **Cloudflare Workers** + **Durable Object** (WebSocket hub) |
| Datos | API pública de **ESPN** (`fifa.world`) |

## Arquitectura

Un único **Durable Object** (`MatchHub`) mantiene las conexiones WebSocket de todos
los navegadores, sondea ESPN con un *alarm* cada pocos segundos, detecta goles/rojas
por *diff* contra el estado anterior y hace **broadcast** del cambio. Así, **da igual
cuántas pestañas haya abiertas: la fuente se sondea una sola vez**. Si el WebSocket
cae, el cliente degrada a *polling* de `/api/state` sin perder funcionalidad.

```
src/
├── client/   → SPA SolidJS (state/, services/, components/, views/, lib/)
└── worker/   → Worker + Durable Object (index.ts, MatchHub.ts, espn.ts, types.ts)
```

`src/worker/types.ts` es el **contrato de datos** compartido cliente↔servidor: el
cliente importa esos mismos tipos y nunca reinterpreta el JSON crudo de ESPN.

## Desarrollo

```bash
npm install

# Dev con recarga en caliente del cliente (Vite :5173, proxy /api y /ws al worker)
npm run dev:client
# En otra terminal, el Worker + Durable Object:
npx wrangler dev

# Alternativa "todo en uno" (build del SPA + worker sirviendo el dist)
npm run dev

npm run typecheck   # tsc del cliente y del worker
npm run build       # SPA de producción → ./dist
```

## Despliegue (Cloudflare)

```bash
npx wrangler login          # una sola vez
npx wrangler secret put INGEST_SECRET
npx wrangler secret put VAPID_PRIVATE
npm run deploy              # vite build && wrangler deploy
```

Las variables no secretas viven en `wrangler.toml`; los secretos en `.dev.vars`
(local, **no se commitea**) y en `wrangler secret put` (producción). Copia
`.env.example` como referencia.

## Aviso

Los datos provienen de una **fuente no oficial** (ESPN) y van con retardo respecto a
la jugada real en cancha. El aviso de gol puede llegar unos segundos después del
momento real; **no constituye prueba oficial**.

---

Creado por **Deyvidyorch Sanchez** — portafolio en [dyorch.com](https://dyorch.com).
