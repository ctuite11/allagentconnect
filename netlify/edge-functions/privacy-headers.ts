import { isPublicMarketingPath } from "../../supabase/functions/_shared/privacyRoutes.ts";

export default async function handler(request: Request, context: { next(): Promise<Response> }) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  const path = new URL(request.url).pathname;
  const publicPage = isPublicMarketingPath(path);
  headers.set("X-Robots-Tag", publicPage ? "index, follow" : "noindex, nofollow, noarchive");
  if (!publicPage) {
    headers.set("Referrer-Policy", "no-referrer");
    if (!/^\/(assets|email|og)\//.test(path) && !/^\/favicon\./.test(path)) {
      headers.set("Cache-Control", "private, no-store");
      headers.set("Netlify-CDN-Cache-Control", "no-store");
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
