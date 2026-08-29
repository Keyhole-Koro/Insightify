import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    watch: {
      exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.vite/**"],
    },
  },
});
