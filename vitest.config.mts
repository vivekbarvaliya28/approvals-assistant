import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Vitest runs only the component test (it needs a browser-like environment).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/tests/components/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
