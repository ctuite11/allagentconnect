import "../../supabase/functions/_shared/migrationRuntime.ts";
/**
 * Provide route-specific initial HTML SEO metadata before the client-side SPA
 * hydrates. This runs ONLY on the ten explicitly named PUBLIC AAC pages.
 * No account or listing data is read; private paths and DCMLS are untouched.
 */
const PAGES: Record<string, { title: string; description: string; heading: string }> = {
  "/about": {
    "title": "About All Agent Connect | Founder Chris Tuite",
    "description": "Learn why Boston broker Chris Tuite created All Agent Connect, a private real estate agent network for collaboration across brokerages.",
    "heading": "About All Agent Connect"
  },
  "/request-access": {
    "title": "Request Agent Access | All Agent Connect",
    "description": "Apply to join All Agent Connect, a private network for verified Massachusetts real estate agents sharing buyer needs and property opportunities.",
    "heading": "Request access to All Agent Connect"
  },
  "/faq": {
    "title": "Real Estate Agent Network FAQ | All Agent Connect",
    "description": "Answers about AAC membership, agent license verification, private property sharing, MLS Clear Cooperation, and pricing inquiries.",
    "heading": "Frequently asked questions"
  },
  "/off-market-listing-network": {
    "title": "Off-Market Listing Network for Agents | All Agent Connect",
    "description": "Learn how verified Greater Boston agents share properties being prepared for sale, seller-approved opportunities, and active buyer demand.",
    "heading": "Off-market listing network for agents"
  },
  "/agent-rules": {
    "title": "Agent Network Rules | All Agent Connect",
    "description": "Read AAC membership requirements, confidentiality standards, property sharing rules, and agent responsibilities.",
    "heading": "Agent Network Rules"
  },
  "/privacy": {
    "title": "Privacy Policy | All Agent Connect",
    "description": "Read how All Agent Connect collects, uses and protects personal information in its verified real estate agent network.",
    "heading": "Privacy Policy"
  },
  "/terms": {
    "title": "Terms of Service | All Agent Connect",
    "description": "Review membership terms and conditions for using the private All Agent Connect real estate agent network.",
    "heading": "Terms of Service"
  },
  "/cookies": {
    "title": "Cookie Policy | All Agent Connect",
    "description": "Learn about cookies used on All Agent Connect, including essential site operation and analytics preferences.",
    "heading": "Cookie Policy"
  },
  "/fair-housing": {
    "title": "Fair Housing Notice | All Agent Connect",
    "description": "Review All Agent Connect's fair housing commitment and the responsibilities of member real estate professionals.",
    "heading": "Fair Housing Notice"
  },
  "/disclosures": {
    "title": "Platform Disclosures | All Agent Connect",
    "description": "Read platform disclaimers about licensing, MLS affiliation, accuracy of property information, and member responsibilities.",
    "heading": "Platform Disclosures"
  }
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function rewritePublicMarketingHtml(html: string, pathname: string): string {
  const page = PAGES[pathname];
  if (!page) return html;
  const origin = "https://allagentconnect.com";
  const canonical = origin + pathname;

  // Only replace existing static tags; React Helmet owns the hydrated tags.
  // No new duplicate OG, title, description or canonical tags are introduced.
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  const changes: Array<[RegExp, string]> = [
    [/(<meta name="description" data-static-seo content=")[^"]*(")/i, page.description],
    [/(<meta property="og:title" data-static-seo content=")[^"]*(")/i, page.title],
    [/(<meta property="og:description" data-static-seo content=")[^"]*(")/i, page.description],
    [/(<meta property="og:url" data-static-seo content=")[^"]*(")/i, canonical],
    [/(<meta name="twitter:title" data-static-seo content=")[^"]*(")/i, page.title],
    [/(<meta name="twitter:description" data-static-seo content=")[^"]*(")/i, page.description],
    [/(<link rel="canonical" data-static-seo href=")[^"]*(")/i, canonical],
  ];
  for (const [pattern, value] of changes) {
    html = html.replace(pattern, (_match, prefix, suffix) => prefix + escapeHtml(value) + suffix);
  }

  // For crawlers that do not execute JS, replace the homepage fallback rather
  // than misdescribe subpages as the homepage. JS removes this fallback on boot.
  html = html.replace(
    /<div id="aac-seo-fallback"[^>]*>[\s\S]*?<\/div>/i,
    `<div id="aac-seo-fallback" style="max-width:720px;margin:0 auto;padding:96px 24px;font-family:system-ui,sans-serif;color:#111317"><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/request-access">Request agent access</a> · <a href="/">Home</a></p></div>`,
  );
  return html;
}

export default async function handler(request: Request, context: { next: () => Promise<Response> }) {
  const url = new URL(request.url);
  if (request.method !== "GET" || !PAGES[url.pathname] ||
    url.hostname === "directconnectmls.com" || url.hostname === "www.directconnectmls.com" ||
    url.searchParams.get("dcmls") === "1") {
    return context.next();
  }

  const response = await context.next();
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }
  const html = rewritePublicMarketingHtml(await response.text(), url.pathname);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
export const config = { onError: "bypass" };
