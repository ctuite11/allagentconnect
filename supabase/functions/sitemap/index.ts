import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const SITE_URL = "https://allagentconnect.com";

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/register", changefreq: "monthly", priority: "0.7" },
  { loc: "/browse", changefreq: "daily", priority: "0.8" },
  { loc: "/our-agents", changefreq: "weekly", priority: "0.7" },
  { loc: "/privacy", changefreq: "monthly", priority: "0.3" },
  { loc: "/terms", changefreq: "monthly", priority: "0.3" },
  { loc: "/cookies", changefreq: "monthly", priority: "0.3" },
  { loc: "/fair-housing", changefreq: "monthly", priority: "0.3" },
  { loc: "/disclosures", changefreq: "monthly", priority: "0.3" },
  { loc: "/agent-network-rules", changefreq: "monthly", priority: "0.3" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toUrlEntry(
  loc: string,
  lastmod?: string,
  changefreq?: string,
  priority?: string
): string {
  let entry = `  <url>\n    <loc>${escapeXml(SITE_URL + loc)}</loc>`;
  if (lastmod) entry += `\n    <lastmod>${lastmod.substring(0, 10)}</lastmod>`;
  if (changefreq) entry += `\n    <changefreq>${changefreq}</changefreq>`;
  if (priority) entry += `\n    <priority>${priority}</priority>`;
  entry += `\n  </url>`;
  return entry;
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active listings (public)
    const { data: listings } = await supabase
      .from("listings")
      .select("id, updated_at")
      .in("status", ["active", "coming_soon", "back_on_market"])
      .order("updated_at", { ascending: false })
      .limit(50000);

    // Fetch agent profiles (public)
    const { data: agents } = await supabase
      .from("agent_profiles")
      .select("aac_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50000);

    const urls: string[] = [];

    // Static pages
    for (const page of STATIC_PAGES) {
      urls.push(toUrlEntry(page.loc, undefined, page.changefreq, page.priority));
    }

    // Listings
    if (listings) {
      for (const l of listings) {
        urls.push(toUrlEntry(`/property/${l.id}`, l.updated_at, "daily", "0.8"));
      }
    }

    // Agent profiles
    if (agents) {
      for (const a of agents) {
        urls.push(toUrlEntry(`/agent/${a.aac_id}`, a.updated_at, "weekly", "0.6"));
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    console.error("sitemap error", e);
    return new Response("Internal Server Error", { status: 500 });
  }
});
