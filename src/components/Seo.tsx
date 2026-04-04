import { Helmet } from "react-helmet-async";

const SITE_NAME = "All Agent Connect";
const DEFAULT_TITLE = "All Agent Connect | Real Estate Agent Collaboration Platform";
const DEFAULT_DESCRIPTION =
  "All Agent Connect is a professional collaboration platform for real estate agents to connect, share listings, manage buyers, and close deals faster.";
const DEFAULT_IMAGE = "https://allagentconnect.com/og-image.jpg";
const SITE_URL = "https://allagentconnect.com";

interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "profile" | "article";
  noindex?: boolean;
  canonical?: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * Reusable SEO component for AAC.
 * Renders title, meta description, canonical, robots, OG, Twitter, and optional JSON-LD.
 */
export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  noindex = false,
  canonical,
  jsonLd,
}: SeoProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = canonical || url || SITE_URL;
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
