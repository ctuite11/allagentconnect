const CRAWLER_REGEX = /facebookexternalhit|facebot|Twitterbot|LinkedInBot|pinterest|slackbot|whatsapp|telegrambot|discordbot/i;

// Derive Supabase function URL from environment variable
const getSupabaseFunctionUrl = (): string => {
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/social-preview`;
  }
  // Fallback: derive from project ID if URL not set
  const projectId = Netlify.env.get("VITE_SUPABASE_PROJECT_ID");
  if (projectId) {
    return `https://${projectId}.supabase.co/functions/v1/social-preview`;
  }
  throw new Error("VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID must be set");
};

export default async function handler(request: Request, context: any) {
  try {
    const userAgent = request.headers.get("user-agent") || "";
    const url = new URL(request.url);
    
    // Only intercept /property/:id paths for crawlers
    const match = url.pathname.match(/^\/property\/([^\/]+)$/);
    if (!match || !CRAWLER_REGEX.test(userAgent)) {
      return context.next(); // Let SPA handle it
    }
    
    // For crawlers, proxy to Supabase social-preview function
    const listingId = match[1];
    const supabaseFunctionUrl = getSupabaseFunctionUrl();
    const proxyUrl = `${supabaseFunctionUrl}/property/${listingId}`;
    
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
  } catch (error) {
    console.error("social-preview edge function error:", error);
    return context.next(); // Graceful fallback to SPA
  }
}

export const config = { 
  path: "/property/*",
  onError: "bypass" 
};
