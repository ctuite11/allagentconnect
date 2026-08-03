import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COMMS_FILTERS_CTA_LABEL,
  COMMS_FILTERS_NOTICE_BODY,
  COMMS_FILTERS_NOTICE_HEADING,
  COMMS_FILTERS_PATH,
  COMMS_FILTERS_URL,
  buildCommsFiltersFooterHtml,
  buildCommsFiltersNoticeHtml,
} from "./commsFiltersEmail.ts";
import { renderEmailTemplate } from "./renderEmailTemplate.ts";

Deno.test("comms filters URL deep-links to Filters section", () => {
  assertEquals(COMMS_FILTERS_PATH, "/communications?section=filters");
  assertStringIncludes(COMMS_FILTERS_URL, COMMS_FILTERS_PATH);
});

Deno.test("comms filters notice includes required copy and Update My Filters button", () => {
  const html = buildCommsFiltersNoticeHtml();
  assertStringIncludes(html, COMMS_FILTERS_NOTICE_HEADING);
  assertStringIncludes(html, COMMS_FILTERS_NOTICE_BODY);
  assertStringIncludes(html, COMMS_FILTERS_CTA_LABEL);
  assertStringIncludes(html, `href="${COMMS_FILTERS_URL}"`);
});

Deno.test("comms filters footer includes required reminder and filters link", () => {
  const html = buildCommsFiltersFooterHtml();
  assertStringIncludes(html, "You’re receiving this because of your Communications Center filters.");
  assertStringIncludes(html, "Review your filters");
  assertStringIncludes(html, `href="${COMMS_FILTERS_URL}"`);
  // Full required reminder phrase still reconstructible from footer copy
  assertEquals(
    html.includes("Communications Center filters") && html.includes("Review your filters"),
    true,
  );
});

Deno.test("client-need-broadcast email includes filters notice below heading and footer reminder", () => {
  const html = renderEmailTemplate("client-need-broadcast", {
    agentName: "Alex",
    senderName: "Jordan",
    senderCompany: "Example Realty",
    category: "Buyer Need",
    contentHtml: "<p>Looking for a condo</p>",
  });
  const headingIdx = html.indexOf(">Buyer Need</h2>");
  const noticeIdx = html.indexOf(COMMS_FILTERS_NOTICE_HEADING);
  const footerIdx = html.indexOf("Communications Center filters");
  assertEquals(headingIdx >= 0, true);
  assertEquals(noticeIdx > headingIdx, true, "notice must follow heading");
  assertEquals(footerIdx > noticeIdx, true, "footer reminder after notice");
  assertStringIncludes(html, COMMS_FILTERS_CTA_LABEL);
  assertStringIncludes(html, COMMS_FILTERS_URL);
  assertStringIncludes(html, "Review your filters");
  // Must not look like Hot Sheet unsubscribe copy
  assertEquals(html.includes("Hot Sheet"), false);
});

Deno.test("comms-digest email includes filters notice, CTA, and footer reminder", () => {
  const html = renderEmailTemplate("comms-digest", {
    cadence: "daily",
    itemCount: 2,
    contentHtml: "<p>Digest items here</p>",
    ctaUrl: "https://allagentconnect.com/communications/feed",
  });
  assertStringIncludes(html, "Daily Communications Digest");
  assertStringIncludes(html, COMMS_FILTERS_NOTICE_HEADING);
  assertStringIncludes(html, COMMS_FILTERS_CTA_LABEL);
  assertStringIncludes(html, "Communications Center filters");
  assertStringIncludes(html, "Review your filters");
  assertStringIncludes(html, COMMS_FILTERS_URL);
});

Deno.test("hot-sheet emails do not include Comms filters notice", () => {
  const html = renderEmailTemplate("new-match-notification", {
    userName: "Alex",
    matchCount: 1,
    hotSheetName: "Boston Buyers",
    listingsHtml: "<p>listing</p>",
  });
  assertEquals(html.includes(COMMS_FILTERS_NOTICE_HEADING), false);
  assertEquals(html.includes(COMMS_FILTERS_CTA_LABEL), false);
  assertEquals(html.includes("Communications Center filters"), false);
});
