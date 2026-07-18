import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 5173 is not incidental: the backend's CORS_ORIGINS allowlists
// http://localhost:5173 exactly. `strictPort` fails loudly rather than silently
// falling back to 5174, where every API call would be blocked by CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
