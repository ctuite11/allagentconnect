// DRAFT 3 — not deployed. On apply, move to
// supabase/functions/_shared/buildDevelopmentNotificationEmailHtml.test.ts
import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDevelopmentNotificationEmailHtml,
  buildDevelopmentNotificationSubject,
} from "../functions/_shared/buildDevelopmentNotificationEmailHtml.ts";

const BASE = {
  kind: "lead" as const,
  developmentName: "Harbor <Point>",
  developmentId: "11111111-1111-4111-8111-111111111111",
  developmentSlug: "harbor-point",
  unitLabel: "4B",
  recipientName: "Sales Desk",
  agentName: '"><script>alert(1)</script>',
  agentEmail: "agent@example.com",
  agentPhone: null,
  agentBrokerage: null,
  message: "Hi <b>there</b> & good day",
  submittedAt: "Mon, 01 Sep 2026 12:00:00 GMT",
};

Deno.test("all user-controlled values are HTML-escaped", () => {
  const html = buildDevelopmentNotificationEmailHtml(BASE);
  assertFalse(html.includes("<script>"));
  assertFalse(html.includes("Hi <b>there</b>"));
  assert(html.includes("&amp;"));
  assert(html.includes("Harbor &lt;Point&gt;"));
});

Deno.test("subject is single-line and escaped-free of injection", () => {
  const subject = buildDevelopmentNotificationSubject({
    ...BASE,
    // Real CR/LF injection attempt in the development name AND the unit label.
    developmentName: "Harbor\r\nBcc: victim@example.com",
    unitLabel: "4B\nX-Injected: 1",
  });
  assertFalse(subject.includes("\n"));
  assertFalse(subject.includes("\r"));
  assert(subject.includes("Harbor"));
  assert(subject.includes("Bcc: victim@example.com")); // flattened onto one line, not a header
});

Deno.test("CTA points at the developer workspace inbox, not the agent surface", () => {
  const html = buildDevelopmentNotificationEmailHtml(BASE);
  assert(html.includes(`/developer/developments/${BASE.developmentId}/leads`));
  assertFalse(html.includes("/developments/harbor-point/leads"));
});
