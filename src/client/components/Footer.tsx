import type { JSX } from "solid-js";

export function Footer(): JSX.Element {
  return (
    <footer class="border-t border-white/10 px-4 py-6 text-center text-xs leading-relaxed text-slate-500">
      <p>
        Datos vía la API pública de <strong>ESPN</strong> — fuente <strong>no oficial</strong> y con retardo respecto a
        la jugada real en cancha. El aviso de gol puede llegar unos segundos después del momento real. No constituye
        prueba oficial.
      </p>
      <p class="mt-2">
        Creado por <strong class="text-slate-300">Deyvidyorch Sanchez</strong> ·{" "}
        <a
          href="https://dyorch.com"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold text-emerald-400 transition hover:text-emerald-300 hover:underline"
        >
          dyorch.com
        </a>
      </p>
    </footer>
  );
}
