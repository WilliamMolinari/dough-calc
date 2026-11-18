import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs so the same build works from a web root and from the
  // Electron app loading dist/index.html over file://.
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: false,
  },
  // Only scan the app's own entry. Stale build output in the project root
  // (dist/, freebuff-sites-build/) otherwise makes the dependency scan fail.
  optimizeDeps: {
    entries: ["index.html"],
  },
});
