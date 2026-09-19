/**
 * Homepage below-the-fold imagery — Vite-imported so production emits
 * hashed `/assets/*` URLs with the existing immutable cache policy.
 *
 * Hero imagery lives in `public/images/home/` and is intentionally separate.
 */
import maskGroup1 from "@/assets/home/mask-group-1.webp";
import maskGroup2 from "@/assets/home/mask-group-2.webp";
import maskGroup3 from "@/assets/home/mask-group-3.webp";
import maskGroup4 from "@/assets/home/mask-group-4.webp";
import maskGroup5 from "@/assets/home/mask-group-5.webp";
import maskGroup7 from "@/assets/home/mask-group-7.webp";
import maskGroup8 from "@/assets/home/mask-group-8.webp";
import maskGroup9 from "@/assets/home/mask-group-9.webp";
import maskGroup10 from "@/assets/home/mask-group-10.webp";

type Tile = { url: string };

export const TILES: Record<string, Tile> = {
  m1: { url: maskGroup1 },
  m2: { url: maskGroup2 },
  m3: { url: maskGroup3 },
  m4: { url: maskGroup4 },
  m5: { url: maskGroup5 },
  m7: { url: maskGroup7 },
  m8: { url: maskGroup8 },
  m9: { url: maskGroup9 },
  m10: { url: maskGroup10 },
};
