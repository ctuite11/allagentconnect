import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  buildListUnsubscribeHeaders,
  isSubscriptionCategory,
  MANAGE_EMAIL_PREFERENCES_URL,
} from "./emailCategories.ts";
import { injectOptOutFooter } from "./sendEmail.ts";
import { buildAacEmail } from "./aacEmailTemplate.ts";

const SUBSCRIPTION = [
  "hot_sheet_alerts",
  "marketing",
  "account_reminders",
  "comms_broadcast",
  "comms_digest",
  "member_updates",
  "development_notifications",
  "listing_broadcast",
];

const DIRECT = [
  "listing_shares", // deliberate 1:1 share — direct correspondence
  "for_sale",
  "transactional",
  "security",
  "system",
  undefined,
  null,
  "",
];

Deno.test("subscription categories are opt-out eligible", () => {
  for (const c of SUBSCRIPTION) {
    assert(isSubscriptionCategory(c), `${c} should be subscription`);
  }
});

Deno.test("direct + transactional categories are never opt-out eligible", () => {
  for (const c of DIRECT) {
    assert(!isSubscriptionCategory(c as string), `${c} must not be subscription`);
  }
});

Deno.test("List-Unsubscribe-Post only accompanies an HTTPS one-click URL", () => {
  assertEquals(buildListUnsubscribeHeaders(null), {});
  assertEquals(buildListUnsubscribeHeaders(undefined), {});
  const h = buildListUnsubscribeHeaders("https://x.test/email-unsubscribe?e=a&c=marketing&t=z");
  assertStringIncludes(h["List-Unsubscribe"], "https://x.test/email-unsubscribe?e=a&c=marketing&t=z");
  assertEquals(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

Deno.test("footer link and one-click header use the identical signed URL", () => {
  const url = "https://x.test/email-unsubscribe?e=YQ&c=hot_sheet_alerts&t=sig";
  const headers = buildListUnsubscribeHeaders(url);
  const html = injectOptOutFooter(
    buildAacEmail({ headline: "Hi", body: "<p>body</p>" }),
    { unsubscribeUrl: url, recipientEmail: "a@b.test", category: "hot_sheet_alerts" },
  );
  assertStringIncludes(html, `href="${url}"`);
  assertStringIncludes(headers["List-Unsubscribe"], url);
  assertStringIncludes(html, MANAGE_EMAIL_PREFERENCES_URL);
  assertStringIncludes(html, "Manage email preferences");
  assertStringIncludes(html, "Unsubscribe from hot sheet alerts");
});

Deno.test("base template never renders account-removal or opt-out links", () => {
  const html = buildAacEmail({ headline: "Reset your password", body: "<p>link</p>" });
  assert(!html.includes("Remove my account"), "account removal link present");
  assert(!html.toLowerCase().includes("unsubscribe"), "opt-out link leaked into transactional shell");
  assertStringIncludes(html, "<!--AAC_FOOTER_UNSUB_ANCHOR-->");
});

Deno.test("opt-out footer is injected exactly once", () => {
  const url = "https://x.test/u?c=marketing";
  const html = injectOptOutFooter(
    buildAacEmail({ headline: "Hi", body: "<p>body</p>" }),
    { unsubscribeUrl: url, recipientEmail: "a@b.test", category: "marketing" },
  );
  assertEquals(html.split("Manage email preferences").length - 1, 1);
});
