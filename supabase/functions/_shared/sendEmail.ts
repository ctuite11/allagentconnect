import type { EmailJob } from "./emailTypes.ts";
import { renderEmailTemplate } from "./renderEmailTemplate.ts";
import {
  buildTransactionalFrom,
} from "./transactionalSender.ts";
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
  // Strip script/style/head blocks entirely so CSS/JS never leaks into the
  // plain-text alternative (huge spam-filter red flag in Yahoo/Gmail).
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<head[\s\S]*?<\/head>/gi, "");
  // HTML comments — including the "<!-- plain-text-fallback: ... -->" markers
  // some templates embed for debugging.
  out = out.replace(/<!--[\s\S]*?-->/g, "");
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
  // Table cell / inline-block boundaries -> space, so adjacent <td>Name</td>
  // <td>Value</td> doesn't collapse to "NameValue" in the plain-text part.
  out = out.replace(/<\/(td|th|span)>/gi, " ");
  // Block-level tags -> newlines
  out = out.replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table)>/gi, "\n");
  out = out.replace(/<br\s*\/?>(?!\n)/gi, "\n");
  // Drop remaining tags
  out = out.replace(/<[^>]+>/g, "");
  // Decode the most common HTML entities
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&middot;/gi, "\u00b7")
    .replace(/&bull;/gi, "\u2022")
    .replace(/&rarr;/gi, "\u2192")
    .replace(/&larr;/gi, "\u2190")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&hellip;/gi, "\u2026")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    // Decode &amp; last so we don't double-decode entities that start with &amp;
    .replace(/&amp;/gi, "&");
  // Collapse whitespace
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n[ \t]+/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

export interface SendEmailOptions {
  /**
   * Value for Resend's HTTP `Idempotency-Key` request header.
   *
   * Resend compares the serialized request body for a repeated key and
   * retains the key for 24 hours; the same key with a DIFFERENT body is
   * rejected as a conflict. Callers must therefore only supply a key when
   * the rendered body is byte-stable across retries (see the activation
   * flow, where the token is a reproducible HMAC).
   *
   * This is a real HTTP header on the provider request — NOT an entry in
   * the email's `headers` object, which Resend would render into the
   * outgoing MIME message instead of using for deduplication.
   */
  providerIdempotencyKey?: string;
  /** Pre-rendered body supplied by the worker (late-rendered templates). */
  htmlOverride?: string;
}

export async function sendEmail(
  job: EmailJob,
  resendApiKey: string,
  options: SendEmailOptions = {},
): Promise<{ providerMessageId: string | null }> {
  const canonicalFrom = buildTransactionalFrom();

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
  const isSingleMarketing =
    isMarketingCategory(category) && toList.length === 1;
  // Pixel + click-wrapping only runs when we render the template ourselves.
  const trackingEnabled = isSingleMarketing && !job.payload.html;

  let html: string;
  // Baseline List-Unsubscribe (mailto fallback) on every send.
  // Marketing single-recipient path below overrides with the richer one-click URL header.
  let extraHeaders: Record<string, string> = {
    "List-Unsubscribe": "<mailto:unsubscribe@allagentconnect.com>",
  };

  if (isSingleMarketing) {
    // Suppression check — applies for any single-recipient marketing send,
    // including pre-rendered HTML (bulk outreach).
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: suppressed } = await supa.rpc("is_email_unsubscribed", {
      _email: toList[0],
      _category: category!,
    });
    if (suppressed === true) {
      console.log(`[sendEmail] Suppressed ${toList[0]} for ${category}`);
      return { providerMessageId: `suppressed:${category}` };
    }

    const unsubUrl = await buildUnsubUrl(toList[0], category!);
    extraHeaders = {
      "List-Unsubscribe": `<${unsubUrl}>, <mailto:hello@allagentconnect.com?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  if (trackingEnabled && options.htmlOverride) {
    // Tracking rewrites the body per attempt, which would break the
    // byte-stability the provider idempotency key depends on.
    throw new Error("htmlOverride cannot be combined with tracking injection");
  }

  if (trackingEnabled) {
    const ctx: TrackingContext = {
      jobId: job.id,
      recipientEmail: toList[0],
      category: category!,
    };
    const rawHtml = renderEmailTemplate(job.payload.template, job.payload.variables || {});
    html = await injectTracking(rawHtml, ctx);
  } else {
    html =
      options.htmlOverride ||
      job.payload.html ||
      renderEmailTemplate(job.payload.template, job.payload.variables || {});
  }

  // Allow the enqueuing function to pass additional headers (merged after
  // List-Unsubscribe so callers cannot accidentally drop compliance headers).
  const payloadHeaders = (job.payload as { headers?: Record<string, string> }).headers;
  if (payloadHeaders && typeof payloadHeaders === "object") {
    extraHeaders = { ...payloadHeaders, ...extraHeaders };
  }

  // Serialize ONCE. The exact same string is replayed on every retry, which
  // is what Resend's idempotency contract compares against.
  const requestBody = JSON.stringify({
      // Always use canonical From — never honor payload.from (prevents notify/mail drift
      // and dynamic display-name overrides that damaged reputation).
      from: canonicalFrom,
      to: toList,
      subject: job.payload.subject,
      html,
      text: htmlToPlainText(html),
      reply_to: job.payload.reply_to,
      headers: Object.keys(extraHeaders).length ? extraHeaders : undefined,
  });

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resendApiKey}`,
  };
  if (options.providerIdempotencyKey) {
    requestHeaders["Idempotency-Key"] = options.providerIdempotencyKey;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: requestHeaders,
    body: requestBody,
  });

  console.log(`[sendEmail] job=${job.id} template=${job.payload.template} from=${canonicalFrom} reply_to=${job.payload.reply_to ?? "(none)"}`);

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

  // 2. (Opt-out footer is injected by sendEmail for every subscription email —
  //     tracking no longer renders its own, so the two can never diverge.)



  // 3. Inject pixel before </body>
  const pixelUrl = await buildOpenPixelUrl(ctx);
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />`;
  out = out.replace("</body>", `${pixel}</body>`);

  return out;
}
