import type { EmailJob } from "./emailTypes.ts";
import { renderEmailTemplate } from "./renderEmailTemplate.ts";
import {
  buildClickUrl,
  buildOpenPixelUrl,
  buildUnsubUrl,
  isMarketingCategory,
  type TrackingContext,
} from "./tracking.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Derive a plaintext version of an HTML email body.
 * Sending multipart/alternative (html + text) significantly improves
 * deliverability — html-only messages are penalized by Outlook /
 * SpamAssassin-based filters.
 */
function htmlToPlainText(html: string): string {
  if (!html) return "";
  let out = html;
  // Strip script/style blocks entirely
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Preserve link URLs: "<a href="X">label</a>" -> "label (X)"
  out = out.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, "").trim();
      if (!text) return href;
      if (text === href) return href;
      return `${text} (${href})`;
    },
  );
  // Block-level tags -> newlines
  out = out.replace(/<\/(p|div|tr|h[1-6]|li|blockquote)>/gi, "\n");
  out = out.replace(/<br\s*\/?>(?!\n)/gi, "\n");
  // Drop remaining tags
  out = out.replace(/<[^>]+>/g, "");
  // Decode the most common HTML entities
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
  // Collapse whitespace
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n[ \t]+/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

export async function sendEmail(
  job: EmailJob,
  resendApiKey: string,
): Promise<{ providerMessageId: string | null }> {
  const FROM_EMAIL = Deno.env.get("TRANSACTIONAL_FROM_EMAIL") || "hello@notify.allagentconnect.com";
  const FROM_NAME = "All Agent Connect";

  const toList: string[] = Array.isArray(job.payload.to)
    ? job.payload.to
    : typeof job.payload.to === "string"
      ? job.payload.to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (toList.length === 0) throw new Error("No valid recipients");

  // Marketing emails (single recipient) get tracking + unsubscribe injected.
  const category = (job.payload as { category?: string }).category;
  const trackingEnabled =
    isMarketingCategory(category) && toList.length === 1 && !job.payload.html;

  let html: string;
  let extraHeaders: Record<string, string> = {};

  if (trackingEnabled) {
    // Suppression check
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: suppressed } = await supa.rpc("is_email_unsubscribed", {
      _email: toList[0],
      _category: category!,
    });
    if (suppressed === true) {
      // Mark as suppressed (return a synthetic id so the queue records success).
      console.log(`[sendEmail] Suppressed ${toList[0]} for ${category}`);
      return { providerMessageId: `suppressed:${category}` };
    }

    const ctx: TrackingContext = {
      jobId: job.id,
      recipientEmail: toList[0],
      category: category!,
    };

    const rawHtml = renderEmailTemplate(job.payload.template, job.payload.variables || {});
    html = await injectTracking(rawHtml, ctx);

    const unsubUrl = await buildUnsubUrl(toList[0], category!);
    extraHeaders = {
      "List-Unsubscribe": `<${unsubUrl}>, <mailto:hello@allagentconnect.com?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  } else {
    html =
      job.payload.html ||
      renderEmailTemplate(job.payload.template, job.payload.variables || {});
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: job.payload.from || `${FROM_NAME} <${FROM_EMAIL}>`,
      to: toList,
      subject: job.payload.subject,
      html,
      text: htmlToPlainText(html),
      reply_to: job.payload.reply_to,
      headers: Object.keys(extraHeaders).length ? extraHeaders : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Resend API ${res.status}: ${JSON.stringify(err)}`,
    );
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  const providerMessageId =
    typeof (data as { id?: unknown }).id === "string"
      ? (data as { id: string }).id
      : null;

  return { providerMessageId };
}

/**
 * Post-process AAC-rendered HTML to:
 *  - wrap external http(s) hrefs through the click redirector,
 *  - append the unsubscribe footer line inside the dark footer,
 *  - inject the open-tracking pixel before </body>.
 * Preserves mailto:, anchor links, tel:, and our own tracking URLs.
 */
async function injectTracking(html: string, ctx: TrackingContext): Promise<string> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const FUNCTIONS_HOST = SUPABASE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  // 1. Wrap hrefs
  const hrefRe = /href="(https?:\/\/[^"]+)"/g;
  const matches = [...html.matchAll(hrefRe)];
  const replacements = await Promise.all(
    matches.map(async (m) => {
      const url = m[1];
      // Skip our own tracking endpoints, brand assets, and mail/tel.
      if (
        FUNCTIONS_HOST && url.includes(FUNCTIONS_HOST)
      ) {
        return { from: m[0], to: m[0] };
      }
      const wrapped = await buildClickUrl(ctx, url);
      return { from: m[0], to: `href="${wrapped}"` };
    }),
  );
  // Replace each unique original once via global replace (safe — every href tag is unique enough).
  let out = html;
  for (const r of replacements) {
    if (r.from !== r.to) {
      out = out.replace(r.from, r.to);
    }
  }

  // 2. Append unsubscribe footer inside dark footer table cell
  const unsubUrl = await buildUnsubUrl(ctx.recipientEmail, ctx.category);
  const categoryLabel =
    ctx.category === "listing_shares" ? "listing emails" :
    ctx.category === "hot_sheet_alerts" ? "hot sheet alerts" :
    "marketing emails";
  const unsubBlock = `<p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Sent to <span style="color:rgba(255,255,255,0.6);">${ctx.recipientEmail}</span>. <a href="${unsubUrl}" style="color:rgba(255,255,255,0.6);text-decoration:underline;">Unsubscribe from ${categoryLabel}</a></p>`;
  // Insert just before the closing </td></tr> of the dark footer (first occurrence after "Remove my account").
  const removeAcctIdx = out.indexOf("Remove my account");
  if (removeAcctIdx >= 0) {
    const closeIdx = out.indexOf("</td></tr>", removeAcctIdx);
    if (closeIdx >= 0) {
      out = out.slice(0, closeIdx) + unsubBlock + out.slice(closeIdx);
    }
  }

  // 3. Inject pixel before </body>
  const pixelUrl = await buildOpenPixelUrl(ctx);
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />`;
  out = out.replace("</body>", `${pixel}</body>`);

  return out;
}
