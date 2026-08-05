import { defineConfig } from "vitest/config";
import path from "path";

// Vitest owns the frontend (`src/`) suite only. Edge Function tests under
// supabase/functions are Deno tests and are run with `deno test`; without this
// scoping Vitest tries to load their `https://` imports and fails.
export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "supabase/**", "e2e/**", "tests/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
