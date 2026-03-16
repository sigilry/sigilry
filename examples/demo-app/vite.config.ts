import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const sandboxJsonApiUrl =
  process.env.SANDBOX_JSON_API_URL ??
  `http://127.0.0.1:${process.env.SANDBOX_JSON_API_PORT ?? "37575"}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/ledger": {
        target: sandboxJsonApiUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ledger/, ""),
      },
    },
  },
});
