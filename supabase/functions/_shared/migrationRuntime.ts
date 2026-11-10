// Keep this FIRST in Supabase Edge and Netlify serverless entry points.
// This also covers SDKs using fetch; the separate SMTP guard covers nodemailer.
// Netlify Edge middleware uses scoped createMigrationFetch instead: its platform
// context.next() also uses global fetch and must not inherit the application guard.
import { installMigrationFetchGuard } from "./migrationSafety.ts";
installMigrationFetchGuard();
