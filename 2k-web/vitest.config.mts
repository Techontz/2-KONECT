import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Component tests for the payment surface.
 *
 * Deliberately narrow. The rules that matter — what may be paid, by whom, for
 * how much — are enforced and tested on the server, and re-asserting them here
 * would only prove that a mock agrees with itself. What these cover is the one
 * thing only the browser can get wrong: showing a shopper a payment UI that
 * does not match the channel they are on.
 */
export default defineConfig({
  plugins: [react()],
  // The app's tsconfig sets `jsx: preserve` for Next's own compiler, so the
  // automatic runtime has to be named here or esbuild leaves bare JSX for a
  // `React` global that never exists in these files.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
