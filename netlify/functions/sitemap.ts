import "../../supabase/functions/_shared/migrationRuntime.ts";

// Resolve at runtime rather than proxying the migration site into the old backend.
export const handler = async () => {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!base) return { statusCode: 503, body: "SUPABASE_URL is not configured" };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/sitemap`);
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: await response.text(),
    };
  } catch {
    return { statusCode: 503, body: "Migration sitemap backend is unavailable" };
  }
};
