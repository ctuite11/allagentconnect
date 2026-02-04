type CorsResult = {
  headers: Record<string, string>;
  isAllowedOrigin: boolean;
  isBrowserRequest: boolean;
};

const isAllowedOrigin = (origin: string) =>
  origin === "https://allagentconnect.com" ||
  origin === "https://www.allagentconnect.com" ||
  origin.endsWith(".netlify.app") ||
  origin === "http://localhost" ||
  origin.startsWith("http://localhost:");

export const buildCorsHeaders = (origin: string | undefined, methods: string): CorsResult => {
  const isBrowserRequest = Boolean(origin);
  const isAllowed = origin ? isAllowedOrigin(origin) : false;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": methods,
  };

  if (origin && isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return { headers, isAllowedOrigin: isAllowed, isBrowserRequest };
};
