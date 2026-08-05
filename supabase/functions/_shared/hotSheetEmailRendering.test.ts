import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderAgentHotSheetListingEmailCard } from "./listingEmailCard.ts";
import { formatListingShareEmailFullAddress } from "./listingShareEmailAddress.ts";
import { renderEmailTemplate } from "./renderEmailTemplate.ts";

const listing = {
  id: "0775b03d-e774-4dc9-9627-f0d2ec752fd3",
  status: "active",
  price: 999000,
  property_type: "condo",
  address: "309 E Street",
  unit_number: "43",
  city: "South Boston",
  state: "MA",
  zip_code: "02127",
  neighborhood: "South Boston",
  bedrooms: 2,
  bathrooms: 2,
  square_feet: 1132,
  listing_number: "L-1229",
  listing_agent_name: "Susan Doig",
  listing_agent_email: "susan.doig@donnellyandco.com",
  listing_agent_phone: "6175044381",
  brokerage_name: "Donnelly and Co",
  photos: ["https://example.com/photo.jpg"],
};

function card() {
  return renderAgentHotSheetListingEmailCard(listing, { baseUrl: "https://allagentconnect.com" });
}

Deno.test("card contains no svg or data-uri icon sources", () => {
  const html = card();
  assert(!/data:image\/svg/i.test(html), "data-uri svg icon found");
  assert(!/<svg/i.test(html), "inline svg found");
  assert(!/src=["']\/(?!\/)/.test(html), "relative icon src found");
  assert(!/src=["'](?!https:\/\/)/i.test(html), "non-absolute image src found");
});

Deno.test("stats render as inline text labels", () => {
  const html = card();
  assertStringIncludes(html, ">2</span> <span style=\"color:#737373;font-weight:500;\">bd</span>");
  assertStringIncludes(html, "ba</span>");
  assertStringIncludes(html, "sq ft</span>");
  assertStringIncludes(html, "Email:</span>");
  assertStringIncludes(html, "Phone:</span>");
});

Deno.test("state abbreviation stays uppercase", () => {
  assertEquals(
    formatListingShareEmailFullAddress(listing),
    "309 E Street #43, South Boston, MA 02127",
  );
  assert(!card().includes(", Ma 02127"));
});

Deno.test("hot sheet email omits Remove my account and keeps working parts", () => {
  const html = renderEmailTemplate("new-match-notification", {
    userName: "Chris",
    matchCount: 1,
    hotSheetName: "Canary",
    hotSheetLink: "https://allagentconnect.com/agent/hot-sheets",
    listingsHtml: card(),
  });
  assert(!html.includes("Remove my account"), "Remove my account present");
  assertStringIncludes(html, "<!--AAC_FOOTER_UNSUB_ANCHOR-->");
  assertStringIncludes(html, "Open Hot Sheet");
  assertStringIncludes(html, "View listing");
  assertStringIncludes(html, "On MLS");
  assertStringIncludes(html, "$999,000");
  assertStringIncludes(html, "Susan Doig");
  assertStringIncludes(html, "susan.doig@donnellyandco.com");
  assertStringIncludes(html, "(617) 504-4381");
  assertStringIncludes(html, "Donnelly and Co");
  assert(!/data:image\/svg/i.test(html));
});

const HOT_SHEET_TEMPLATES = [
  "new-match-notification",
  "hot-sheet-status-change",
  "hot-sheet-subscriber-update",
  "hot-sheet-subscriber-status-change",
] as const;

const SUBSCRIBER_TEMPLATES = new Set<string>([
  "hot-sheet-subscriber-update",
  "hot-sheet-subscriber-status-change",
]);

function renderTemplate(template: string) {
  return renderEmailTemplate(template, {
    userName: "Chris",
    matchCount: 1,
    hotSheetName: "Canary",
    statusKey: "price_change",
    hotSheetLink: "https://allagentconnect.com/agent/hot-sheets",
    previewLink: "https://allagentconnect.com/hot-sheet/preview",
    unsubscribeLink: "https://allagentconnect.com/hot-sheet/unsubscribe?token=abc",
    listingsHtml: card(),
  });
}

for (const template of HOT_SHEET_TEMPLATES) {
  Deno.test(`${template} renders email-safe HTML`, () => {
    const html = renderTemplate(template);
    assert(!html.includes("Remove my account"), `${template}: Remove my account present`);
    assert(!/<svg/i.test(html), `${template}: inline svg found`);
    assert(!/data:image\/svg/i.test(html), `${template}: data-uri svg found`);
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      assert(m[1].startsWith("https://"), `${template}: non-https img src ${m[1]}`);
    }
    if (SUBSCRIBER_TEMPLATES.has(template)) {
      assertStringIncludes(html, "https://allagentconnect.com/hot-sheet/unsubscribe?token=abc");
      assertStringIncludes(html, "Unsubscribe");
    }
  });
}

function renderNewMatch(matchCount: unknown) {
  return renderEmailTemplate("new-match-notification", {
    userName: "Chris",
    matchCount,
    hotSheetName: "Canary",
    hotSheetLink: "https://allagentconnect.com/agent/hot-sheets",
    listingsHtml: card(),
  });
}

Deno.test("new-match-notification pluralization: 1 -> new listing", () => {
  const html = renderNewMatch(1);
  assertStringIncludes(html, "We found 1 new listing matching");
  assert(!html.includes("1 new listings"), "incorrectly pluralized singular count");
});

Deno.test("new-match-notification pluralization: 2 -> new listings", () => {
  assertStringIncludes(renderNewMatch(2), "We found 2 new listings matching");
});

Deno.test("new-match-notification pluralization normalizes string counts", () => {
  assertStringIncludes(renderNewMatch("1"), "We found 1 new listing matching");
  assertStringIncludes(renderNewMatch("2"), "We found 2 new listings matching");
});
