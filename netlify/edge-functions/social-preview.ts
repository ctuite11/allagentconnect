const CRAWLER_REGEX = /facebookexternalhit|facebot|Twitterbot|LinkedInBot|pinterest|slackbot|whatsapp|telegrambot|discordbot/i;
const SUPABASE_FUNCTION_URL = "https://qocduqtfbsevnhlgsfka.supabase.co/functions/v1/social-preview";

export default async function handler(request: Request, context: any) {
  const userAgent = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  
  // Only intercept /property/:id paths for crawlers
  const match = url.pathname.match(/^\/property\/([^\/]+)$/);
  if (!match || !CRAWLER_REGEX.test(userAgent)) {
    return context.next(); // Let SPA handle it
  }
  
  // For crawlers, proxy to Supabase social-preview function
  const listingId = match[1];
  const proxyUrl = `${SUPABASE_FUNCTION_URL}/property/${listingId}`;
  
  const response = await fetch(proxyUrl, {
    headers: {
      "User-Agent": userAgent,
      "X-Forwarded-Host": url.hostname,
      "X-Forwarded-Proto": "https",
    },
  });
  
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = { path: "/property/*" };
