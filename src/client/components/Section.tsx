import type { JSX } from "solid-js";

// Bloques de layout reutilizables (antes sectionHtml / grid / empty en render.ts).

export function Section(props: { title: string; count?: number | null; children: JSX.Element }): JSX.Element {
  return (
    <section class="mb-8">
      <div class="mb-3 flex items-center gap-2">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-300">{props.title}</h2>
        {props.count != null && (
          <span class="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{props.count}</span>
        )}
      </div>
      {props.children}
    </section>
  );
}

export function Grid(props: { children: JSX.Element }): JSX.Element {
  return <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{props.children}</div>;
}

export function EmptyMsg(props: { children: JSX.Element }): JSX.Element {
  return (
    <p class="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
      {props.children}
    </p>
  );
}
