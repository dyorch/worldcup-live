import type { Match } from "../../worker/types";

// Helpers de formato de fecha/hora compartidos por vistas y componentes.
// Unifican lo que antes estaba duplicado entre main.ts y render.ts.

export const pad = (n: number): string => String(n).padStart(2, "0");

export const toInputDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayInput = (): string => toInputDate(new Date());

export const dayToDates = (day: string): string => day.replace(/-/g, "");

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toInputDate(dt);
}

// Valida "YYYY-MM-DD" con fecha real (rechaza 2026-13-40).
export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export const fmtStart = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday(iso) ? `Hoy ${t}` : `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${t}`;
};

export const prettyDate = (isoDay: string): string => {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "long", day: "2-digit", month: "long" });
};

export const byStart = (a: Match, b: Match): number => +new Date(a.startUtc) - +new Date(b.startUtc);
