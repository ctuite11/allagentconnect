import { PRIVATE_PREVIEW_HTML, PRIVATE_PREVIEW_HEADERS } from "../../supabase/functions/_shared/privatePreview.ts";

export default async function handler(request: Request, context: { next(): Promise<Response> }) {
  const crawler = /bot|crawl|spider|facebookexternalhit|whatsapp|telegram|pinterest|slack/i.test(request.headers.get("user-agent") ?? "");
  if (!crawler) return context.next();
  // No database call, regardless of token, listing status or crawler identity.
  return new Response(PRIVATE_PREVIEW_HTML, { headers: PRIVATE_PREVIEW_HEADERS });
}
