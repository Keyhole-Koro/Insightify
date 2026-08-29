import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["node:sqlite"],
    },
    watch: {
      exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.vite/**"],
    },
  },
});
