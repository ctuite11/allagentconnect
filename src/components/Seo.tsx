import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { getBrandForRoute } from "@/lib/branding";

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
 * Reusable SEO component that dynamically brands based on current route.
 * AAC routes get AAC branding, DCMLS routes get DCMLS branding.
 */
export function Seo({
  title,
  description,
  image,
  url,
  type = "website",
  noindex = false,
  canonical,
  jsonLd,
}: SeoProps) {
  const location = useLocation();
  const brand = getBrandForRoute(location.pathname);

  const defaultSiteName = "All Agent Connect";
  const defaultTitle = "All Agent Connect";
  const defaultDescription = "Private real estate agent collaboration platform.";

  const siteName = brand.siteName || defaultSiteName;
  const baseTitle = title || brand.title || defaultTitle;
  const fullTitle = baseTitle.toLowerCase().includes(siteName.toLowerCase())
    ? baseTitle
    : `${baseTitle} | ${siteName}`;

  const resolvedDescription = description || brand.description || defaultDescription;

  const autoCanonical =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : `${brand.siteUrl}${location.pathname}`;

  const canonicalUrl = canonical || autoCanonical;
  const imageUrl = image?.startsWith("http") ? image : `${brand.siteUrl}${image || brand.ogImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="icon" href={brand.favicon} />
      <link rel="shortcut icon" href={brand.favicon} />
      <link rel="apple-touch-icon" href={brand.favicon} />
      <meta name="theme-color" content={brand.themeColor} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={brand.siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={imageUrl} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
