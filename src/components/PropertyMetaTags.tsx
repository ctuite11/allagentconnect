import { Helmet } from 'react-helmet-async';

interface PropertyMetaTagsProps {
  address: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photo: string | null;
  listingType: string;
}

export const PropertyMetaTags = ({
  address,
  city,
  state,
  price,
  bedrooms,
  bathrooms,
  description,
  photo,
  listingType,
}: PropertyMetaTagsProps) => {
  const title = `${address}, ${city}, ${state} - Agent Connect`;
  const priceText = listingType === 'for_rent' 
    ? `$${price.toLocaleString()}/month` 
    : `$${price.toLocaleString()}`;
  
  const metaDescription = description 
    ? `${priceText} - ${bedrooms} bed, ${bathrooms} bath. ${description.substring(0, 120)}...`
    : `${priceText} - ${bedrooms} bed, ${bathrooms} bath property in ${city}, ${state}`;

  const imageUrl = photo || 'https://lovable.dev/opengraph-image-p98pqg.png';
  const url = window.location.href;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`Photo of ${address}`} />
      <meta property="og:site_name" content="Agent Connect" />
      <meta property="og:locale" content="en_US" />
      <meta property="fb:app_id" content="758660681756022" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`Photo of ${address}`} />
    </Helmet>
  );
};
