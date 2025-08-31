// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // We only use Vite to produce a production bundle on the VM
  return {
    plugins: [react()],
    root: path.resolve(import.meta.dirname, "client"),
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: true,       // helpful for prod debugging on the VM
      minify: "esbuild",
      cssCodeSplit: true,
    },
    // server{} not used in pure prod; harmless to omit
  };
});
