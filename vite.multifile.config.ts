import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Wersja wielopilkowa (index.html + assets/) dla PWA i portali z grami.
 * Podstawowy build jednoplikowy zostaje w vite.config.ts; ta konfiguracja jest używana
 * wyłącznie przez scripts/build.mjs, który podaje katalog wyjściowy.
 * `base: "./"` daje ścieżki względne, więc gra działa pod dowolnym adresem i w podkatalogu.
 * Phaser trafia do osobnego pliku, który rzadko się zmienia.
 */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
});
