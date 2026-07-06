import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// El SPA se construye a ./dist; el Worker (wrangler) lo sirve con el binding ASSETS.
// En desarrollo con HMR: `npm run dev:client` (Vite :5173) + `npm run dev` (wrangler :8787).
// El proxy reenvía /api, /ingest y /ws al runtime del Worker en :8787.
export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/ingest": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
});
