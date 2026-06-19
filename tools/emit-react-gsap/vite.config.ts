import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal harness for live verification of the generated React+GSAP Mascot component.
export default defineConfig({
  root: ".",
  plugins: [react()],
  server: { port: 5174 },
});
