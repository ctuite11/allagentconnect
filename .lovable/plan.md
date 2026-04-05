

# Cache-Bust OG Image URL for Facebook

## Changes

### 1. `index.html`
Update three meta tags to use versioned URL `https://allagentconnect.com/og-image.jpg?v=20260404-2`:
- `og:image`
- `og:image:secure_url`
- `twitter:image`

### 2. `src/components/Seo.tsx`
Update `DEFAULT_IMAGE` constant:
```
const DEFAULT_IMAGE = "https://allagentconnect.com/og-image.jpg?v=20260404-2";
```

### Not changed
- Listing-specific OG image logic
- Any other meta tags or SEO configuration

### After publish
1. View source on live site → confirm `?v=20260404-2` in meta tags
2. Open `https://allagentconnect.com/og-image.jpg?v=20260404-2` directly → confirm newest image
3. Facebook Sharing Debugger → Scrape Again twice

