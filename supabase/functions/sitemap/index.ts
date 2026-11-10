import "../_shared/migrationRuntime.ts";
// @auth-classification: public-read
import { PUBLIC_MARKETING_PATHS } from "../_shared/privacyRoutes.ts";

// Identical marketing scope to public/sitemap.xml. Never query private tables,
// even when called through an old domain or the legacy Netlify proxy.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...PUBLIC_MARKETING_PATHS].map(path => `  <url><loc>https://allagentconnect.com${path}</loc></url>`).join("\n")}
</urlset>`;

Deno.serve(() => new Response(xml, { headers: {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
} }));
