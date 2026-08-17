import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAttachmentCtaHtml,
  normalizeCommsAttachments,
  summarizeCommsAttachments,
} from "./commsBroadcastAttachments.ts";

const SENDER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

Deno.test("no attachments => empty list, no CTA (existing broadcasts unchanged)", () => {
  const r = normalizeCommsAttachments(undefined, SENDER);
  assertEquals(r.ok && r.attachments.length, 0);
  assertEquals(buildAttachmentCtaHtml([], "Chris", "https://x"), "");
  assertEquals(summarizeCommsAttachments([]), "");
});

Deno.test("normalizes valid attachments in order", () => {
  const r = normalizeCommsAttachments(
    [
      { path: `${SENDER}/a.jpg`, kind: "image", mimeType: "image/jpeg", name: "a.jpg", size: 12 },
      { path: `${SENDER}/b.mp4`, kind: "video" },
    ],
    SENDER,
  );
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.attachments.map((a) => a.sort_order), [0, 1]);
  assertEquals(r.attachments[1].kind, "video");
  assertEquals(r.attachments[1].file_name, "attachment");
});

Deno.test("rejects paths belonging to another sender", () => {
  const r = normalizeCommsAttachments([{ path: `${OTHER}/a.jpg`, kind: "image" }], SENDER);
  assertEquals(r.ok, false);
});

Deno.test("rejects traversal, duplicates, bad kinds and oversized batches", () => {
  assertEquals(normalizeCommsAttachments([{ path: `${SENDER}/../x`, kind: "image" }], SENDER).ok, false);
  assertEquals(
    normalizeCommsAttachments(
      [{ path: `${SENDER}/a`, kind: "image" }, { path: `${SENDER}/a`, kind: "image" }],
      SENDER,
    ).ok,
    false,
  );
  assertEquals(normalizeCommsAttachments([{ path: `${SENDER}/a`, kind: "pdf" }], SENDER).ok, false);
  const many = Array.from({ length: 11 }, (_, i) => ({ path: `${SENDER}/${i}`, kind: "image" }));
  assertEquals(normalizeCommsAttachments(many, SENDER).ok, false);
  assertEquals(normalizeCommsAttachments("nope", SENDER).ok, false);
});

Deno.test("summary + CTA copy", () => {
  const atts = [
    { kind: "image" as const },
    { kind: "image" as const },
    { kind: "image" as const },
    { kind: "video" as const },
  ];
  assertEquals(summarizeCommsAttachments(atts), "3 photos and 1 video");
  const html = buildAttachmentCtaHtml(atts, "Chris", "https://aac/communications");
  assertEquals(html.includes("Chris shared 3 photos and 1 video"), true);
  assertEquals(html.includes("View attachments"), true);
  assertEquals(html.includes("https://aac/communications"), true);
});
