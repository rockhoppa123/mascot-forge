import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Throwaway spike harness. `?raw` import is used to inline the shared mascot.svg
// into both emitter targets so the comparison renders identical geometry.
export default defineConfig({
  plugins: [react()],
  server: { open: true },
});
