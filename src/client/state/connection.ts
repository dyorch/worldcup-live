import { createSignal } from "solid-js";
import type { ConnStatus } from "../services/ws";

// Señales de conexión que lee el Header (badges de estado / latencia / última actualización).
export const [connStatus, setConnStatus] = createSignal<ConnStatus>("connecting");
export const [latency, setLatency] = createSignal<number | null>(null);
export const [lastUpdate, setLastUpdate] = createSignal<number | null>(null);
