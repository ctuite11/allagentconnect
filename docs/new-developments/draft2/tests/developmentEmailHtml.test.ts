// DRAFT 2 — not deployed. On apply, move to
// supabase/functions/_shared/buildDevelopmentNotificationEmailHtml.test.ts
import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDevelopmentNotificationEmailHtml,
  buildDevelopmentNotificationSubject,
} from "../functions/_shared/buildDevelopmentNotificationEmailHtml.ts";

const BASE = {
  kind: "lead" as const,
  developmentName: "Harbor <Point>",
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
  const subject = buildDevelopmentNotificationSubject(BASE);
  assertFalse(subject.includes("\n"));
  assertFalse(subject.includes("\r"));
  assert(subject.includes("Harbor"));
});
