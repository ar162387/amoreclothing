import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Emits .map files for error-tracking/debugging without exposing readable source via the
    // browser's Sources tab (unlike `sourcemap: true`) — no sourceMappingURL comment is added.
    sourcemap: "hidden",
  },
}));
