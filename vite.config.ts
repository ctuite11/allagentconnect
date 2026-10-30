import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { validateMigrationBuildEnv } from "./scripts/migration/validate-env.mjs";
import { verifyDestinationLock } from "./scripts/migration/check-destination-lock.mjs";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode, command }) => {
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    validateMigrationBuildEnv(env);
    await verifyDestinationLock(env);
  }
  return ({
  root: ".",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
