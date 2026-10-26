/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Standalone Vitest config so tests run without booting the full
 * TanStack Start dev pipeline. The `@/` alias is resolved by reading
 * tsconfig.json via vite-tsconfig-paths.
 */
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
