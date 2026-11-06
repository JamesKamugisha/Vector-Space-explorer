import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Discover lazy worker dependencies before Vite serves its first module graph.
  optimizeDeps: {
    include: ["@huggingface/transformers", "umap-js", "pdfjs-dist"],
  },
  worker: { format: "es" },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], react: ["react", "react-dom"] },
      },
    },
  },
});
