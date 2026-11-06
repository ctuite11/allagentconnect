import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rewritePublicMarketingHtml } from "../../netlify/edge-functions/public-page-seo.ts";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const original = source.match(/<title>(.*?)<\/title>/)?.[1];
assert.ok(original);

const routes = [
  ["/about", "About All Agent Connect | Founder Chris Tuite"],
  ["/request-access", "Request Agent Access | All Agent Connect"],
  ["/faq", "Real Estate Agent Network FAQ | All Agent Connect"],
  ["/off-market-listing-network", "Off-Market Listing Network for Agents | All Agent Connect"],
  ["/agent-rules", "Agent Network Rules | All Agent Connect"],
  ["/privacy", "Privacy Policy | All Agent Connect"],
  ["/terms", "Terms of Service | All Agent Connect"],
  ["/cookies", "Cookie Policy | All Agent Connect"],
  ["/fair-housing", "Fair Housing Notice | All Agent Connect"],
  ["/disclosures", "Platform Disclosures | All Agent Connect"],
];

for (const [path, title] of routes) {
  const html = rewritePublicMarketingHtml(source, path);
  assert.ok(html.includes("<title>" + title + "</title>"), "Missing page title: " + path);
  assert.ok(html.includes('data-static-seo href="https://allagentconnect.com' + path + '"'), "Wrong canonical: " + path);
  assert.ok(html.includes('property="og:url" data-static-seo content="https://allagentconnect.com' + path + '"'), "Wrong OG URL: " + path);
  assert.equal((html.match(/<meta name="description" data-static-seo/g) || []).length, 1, "Duplicate description: " + path);
  assert.equal((html.match(/<title>/g) || []).length, 1, "Duplicate title: " + path);
  assert.ok(!html.includes('<h1 style="font-size:48px'), "Homepage fallback incorrectly served: " + path);
  console.log("PASS static SEO: " + path);
}
assert.equal(rewritePublicMarketingHtml(source, "/auth"), source, "Private/auth page should not be rewritten");
assert.equal(rewritePublicMarketingHtml(source, "/property/123"), source, "Private listing path should not be rewritten");
assert.equal(rewritePublicMarketingHtml(source, "/"), source, "Homepage must remain unchanged");
console.log("PASS public SEO isolation");
