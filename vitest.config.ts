import { defineConfig } from "vitest/config";
import path from "path";

// Vitest owns the frontend (`src/`) suite only. Edge Function tests under
// supabase/functions are Deno tests and are run with `deno test`; without this
// scoping Vitest tries to load their `https://` imports and fails.
export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "dist/**",
      "supabase/**",
      "e2e/**",
      "tests/**",
    // Pre-existing Deno-authored suites that live under src/ but import from
    // deno.land. They run with `deno test src/lib` and pass there (22 tests).
    // Vitest cannot resolve their https: imports, so it must not collect them.
      "src/lib/addListingDraftSession.test.ts",
      "src/lib/commsFiltersCopy.test.ts",
      "src/lib/listingPricingValidation.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
