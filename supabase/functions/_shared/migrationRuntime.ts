// Keep this as the FIRST dependency of every deployed server entry point.
// This also covers SDKs using fetch; the separate SMTP guard covers nodemailer.
import { installMigrationFetchGuard } from "./migrationSafety.ts";
installMigrationFetchGuard();
