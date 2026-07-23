// Auto-authored: pointers to CDN-hosted responsive homepage assets.
// Do not hand-write URLs; every entry is a `.asset.json` pointer generated
// by `lovable-assets create`.
import hero640Avif from "@/assets/home/hero-640.avif.asset.json";
import hero1024Avif from "@/assets/home/hero-1024.avif.asset.json";
import hero1600Avif from "@/assets/home/hero-1600.avif.asset.json";
import hero2000Avif from "@/assets/home/hero-2000.avif.asset.json";
import hero640Webp from "@/assets/home/hero-640.webp.asset.json";
import hero1024Webp from "@/assets/home/hero-1024.webp.asset.json";
import hero1600Webp from "@/assets/home/hero-1600.webp.asset.json";
import hero2000Webp from "@/assets/home/hero-2000.webp.asset.json";

import gci1200Avif from "@/assets/home/gci-globe-1200.avif.asset.json";
import gci1800Avif from "@/assets/home/gci-globe-1800.avif.asset.json";
import gci1200Webp from "@/assets/home/gci-globe-1200.webp.asset.json";
import gci1800Webp from "@/assets/home/gci-globe-1800.webp.asset.json";

import m1Avif from "@/assets/home/mask-group-1.avif.asset.json";
import m1Webp from "@/assets/home/mask-group-1.webp.asset.json";
import m1SmWebp from "@/assets/home/mask-group-1-480.webp.asset.json";
import m2Avif from "@/assets/home/mask-group-2.avif.asset.json";
import m2Webp from "@/assets/home/mask-group-2.webp.asset.json";
import m2SmWebp from "@/assets/home/mask-group-2-480.webp.asset.json";
import m3Avif from "@/assets/home/mask-group-3.avif.asset.json";
import m3Webp from "@/assets/home/mask-group-3.webp.asset.json";
import m3SmWebp from "@/assets/home/mask-group-3-480.webp.asset.json";
import m4Avif from "@/assets/home/mask-group-4.avif.asset.json";
import m4Webp from "@/assets/home/mask-group-4.webp.asset.json";
import m4SmWebp from "@/assets/home/mask-group-4-480.webp.asset.json";
import m5Avif from "@/assets/home/mask-group-5.avif.asset.json";
import m5Webp from "@/assets/home/mask-group-5.webp.asset.json";
import m5SmWebp from "@/assets/home/mask-group-5-480.webp.asset.json";
import m7Avif from "@/assets/home/mask-group-7.avif.asset.json";
import m7Webp from "@/assets/home/mask-group-7.webp.asset.json";
import m7SmWebp from "@/assets/home/mask-group-7-480.webp.asset.json";
import m8Avif from "@/assets/home/mask-group-8.avif.asset.json";
import m8Webp from "@/assets/home/mask-group-8.webp.asset.json";
import m8SmWebp from "@/assets/home/mask-group-8-480.webp.asset.json";
import m9Avif from "@/assets/home/mask-group-9.avif.asset.json";
import m9Webp from "@/assets/home/mask-group-9.webp.asset.json";
import m9SmWebp from "@/assets/home/mask-group-9-480.webp.asset.json";
import m10Avif from "@/assets/home/mask-group-10.avif.asset.json";
import m10Webp from "@/assets/home/mask-group-10.webp.asset.json";
import m10SmWebp from "@/assets/home/mask-group-10-480.webp.asset.json";

// Hero: full-bleed background (LCP candidate). 16:9 source.
export const HERO = {
  width: 1920,
  height: 1080,
  avif: {
    src: hero1024Avif.url,
    srcset: `${hero640Avif.url} 640w, ${hero1024Avif.url} 1024w, ${hero1600Avif.url} 1600w, ${hero2000Avif.url} 2000w`,
  },
  webp: {
    src: hero1024Webp.url,
    srcset: `${hero640Webp.url} 640w, ${hero1024Webp.url} 1024w, ${hero1600Webp.url} 1600w, ${hero2000Webp.url} 2000w`,
  },
  sizes: "100vw",
};

// GCI globe background. Decorative dark globe used as background layer.
export const GCI_GLOBE = {
  avif: { src: gci1200Avif.url, src1800: gci1800Avif.url },
  webp: { src: gci1200Webp.url, src1800: gci1800Webp.url },
};

type Tile = {
  avif: string;
  webp: string;
  webpSmall: string;
};

export const TILES: Record<string, Tile> = {
  m1: { avif: m1Avif.url, webp: m1Webp.url, webpSmall: m1SmWebp.url },
  m2: { avif: m2Avif.url, webp: m2Webp.url, webpSmall: m2SmWebp.url },
  m3: { avif: m3Avif.url, webp: m3Webp.url, webpSmall: m3SmWebp.url },
  m4: { avif: m4Avif.url, webp: m4Webp.url, webpSmall: m4SmWebp.url },
  m5: { avif: m5Avif.url, webp: m5Webp.url, webpSmall: m5SmWebp.url },
  m7: { avif: m7Avif.url, webp: m7Webp.url, webpSmall: m7SmWebp.url },
  m8: { avif: m8Avif.url, webp: m8Webp.url, webpSmall: m8SmWebp.url },
  m9: { avif: m9Avif.url, webp: m9Webp.url, webpSmall: m9SmWebp.url },
  m10: { avif: m10Avif.url, webp: m10Webp.url, webpSmall: m10SmWebp.url },
};