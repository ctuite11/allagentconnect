// TEMPORARY FALLBACK MANIFEST
//
// The optimized AVIF/WebP variants live at `/__l5e/assets-v1/…`, which is
// only proxied on Lovable-hosted `.lovable.app` origins. Our production
// custom domain (allagentconnect.com) is fronted by Netlify and does NOT
// proxy that prefix, so every optimized image 404s to the SPA fallback
// (HTML), leaving homepage images blank for real visitors.
//
// Until a Netlify rewrite for `/__l5e/*` is in place, this manifest returns
// the known-public `c.animaapp.com` PNG URLs for every variant. Every
// `<picture>` `<source>` and `<img>` therefore resolves to the same working
// PNG. Type mismatch (source labeled `image/avif` but responding with
// `image/png`) is harmless — browsers use the response's actual Content-Type
// to decode. The `.asset.json` pointer files remain in the repo so we can
// flip back to optimized delivery in one commit once hosting is fixed.

const A = "https://c.animaapp.com/mmm3cgevnH1M3s/img";
const HERO_PNG = `${A}/group-1707484446.png`;
const GCI_PNG = `${A}/mask-group.png`;
const TILE = (n: number) => `${A}/mask-group-${n}.png`;

export const HERO = {
  width: 1920,
  height: 1080,
  avif: { src: HERO_PNG, srcset: HERO_PNG },
  webp: { src: HERO_PNG, srcset: HERO_PNG },
  sizes: "100vw",
};

export const GCI_GLOBE = {
  avif: { src: GCI_PNG, src1800: GCI_PNG },
  webp: { src: GCI_PNG, src1800: GCI_PNG },
};

type Tile = { url: string };

const tile = (n: number): Tile => ({ url: TILE(n) });

export const TILES: Record<string, Tile> = {
  m1: tile(1),
  m2: tile(2),
  m3: tile(3),
  m4: tile(4),
  m5: tile(5),
  m7: tile(7),
  m8: tile(8),
  m9: tile(9),
  m10: tile(10),
};