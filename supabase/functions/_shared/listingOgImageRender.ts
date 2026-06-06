import { decodeJPEG, decodePNG, Image, TextLayout } from "jsr:@matmen/imagescript@1.3.1";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PLACEHOLDER_IMAGE_URL = "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";
const FONT_BOLD_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_18pt-Bold.ttf";
const FONT_REGULAR_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_18pt-Regular.ttf";

let boldFontBytes: Uint8Array | null = null;
let regularFontBytes: Uint8Array | null = null;

export type ListingOgInput = {
  address: string;
  city: string;
  state: string;
  price: number | null;
  listing_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photoUrl: string;
};

export function resolveListingPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return "";
  const first = photos[0] as unknown;
  if (typeof first === "string") return first.trim();
  if (first && typeof first === "object") {
    const row = first as Record<string, unknown>;
    return String(row.url || row.publicUrl || "").trim();
  }
  return "";
}

function formatPrice(listing: Pick<ListingOgInput, "price" | "listing_type">): string {
  const amount = Number(listing.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  const formatted = `$${Math.round(amount).toLocaleString("en-US")}`;
  return listing.listing_type === "for_rent" ? `${formatted}/mo` : formatted;
}

function formatDetails(listing: Pick<ListingOgInput, "bedrooms" | "bathrooms" | "square_feet">): string {
  const beds = listing.bedrooms ?? "—";
  const baths = listing.bathrooms ?? "—";
  const sqft =
    listing.square_feet && listing.square_feet > 0
      ? `${listing.square_feet.toLocaleString("en-US")} sq ft`
      : null;
  const core = `${beds} bd • ${baths} ba`;
  return sqft ? `${core} • ${sqft}` : core;
}

async function loadFontBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load font: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function getBoldFontBytes(): Promise<Uint8Array> {
  if (!boldFontBytes) {
    boldFontBytes = await loadFontBytes(FONT_BOLD_URL);
  }
  return boldFontBytes;
}

async function getRegularFontBytes(): Promise<Uint8Array> {
  if (!regularFontBytes) {
    regularFontBytes = await loadFontBytes(FONT_REGULAR_URL);
  }
  return regularFontBytes;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return null;
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function decodeImage(bytes: Uint8Array, url: string): Promise<Image | null> {
  try {
    if (url.toLowerCase().includes(".png")) {
      return await decodePNG(bytes);
    }
    return await decodeJPEG(bytes);
  } catch {
    try {
      return await decodePNG(bytes);
    } catch {
      return null;
    }
  }
}

function coverFit(image: Image, width: number, height: number): Image {
  const scale = Math.max(width / image.width, height / image.height);
  const resized = image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  const x = Math.round((width - resized.width) / 2);
  const y = Math.round((height - resized.height) / 2);
  const canvas = new Image(width, height);
  canvas.fill(0x111317ff);
  canvas.composite(resized, x, y);
  return canvas;
}

function drawGradientOverlay(image: Image): void {
  const overlay = new Image(OG_WIDTH, OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const progress = y / OG_HEIGHT;
    const alpha = Math.round(
      progress < 0.35
        ? 25 + progress * 80
        : 25 + progress * 210,
    );
    const color = Image.rgbaToColor(0, 0, 0, Math.min(220, alpha));
    for (let x = 0; x < OG_WIDTH; x++) {
      overlay.setPixelAt(x + 1, y + 1, color);
    }
  }
  image.composite(overlay, 0, 0);
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trim()}…`;
}

async function compositeText(
  canvas: Image,
  fontBytes: Uint8Array,
  text: string,
  size: number,
  x: number,
  y: number,
  color = 0xffffffff,
): Promise<void> {
  const layout = new TextLayout({ maxWidth: OG_WIDTH - x - 48, wrapHardBreaks: false });
  const layer = await Image.renderText(fontBytes, size, text, color, layout);
  canvas.composite(layer, x, y);
}

async function buildBrandedFallback(): Promise<Image> {
  const canvas = new Image(OG_WIDTH, OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const t = y / OG_HEIGHT;
    const r = Math.round(14 + t * 8);
    const g = Math.round(20 + t * 12);
    const b = Math.round(28 + t * 16);
    const color = Image.rgbaToColor(r, g, b, 255);
    for (let x = 0; x < OG_WIDTH; x++) {
      canvas.setPixelAt(x + 1, y + 1, color);
    }
  }

  const placeholderBytes = await fetchImageBytes(PLACEHOLDER_IMAGE_URL);
  if (placeholderBytes) {
    const decoded = await decodeImage(placeholderBytes, PLACEHOLDER_IMAGE_URL);
    if (decoded) {
      const fitted = coverFit(decoded, OG_WIDTH, OG_HEIGHT);
      canvas.composite(fitted, 0, 0);
    }
  }

  drawGradientOverlay(canvas);
  return canvas;
}

export async function renderListingOgImage(listing: ListingOgInput): Promise<Uint8Array> {
  const boldFont = await getBoldFontBytes();
  const regularFont = await getRegularFontBytes();

  let canvas: Image | null = null;
  const photoBytes = await fetchImageBytes(listing.photoUrl);
  if (photoBytes) {
    const decoded = await decodeImage(photoBytes, listing.photoUrl);
    if (decoded) {
      canvas = coverFit(decoded, OG_WIDTH, OG_HEIGHT);
    }
  }

  if (!canvas) {
    canvas = await buildBrandedFallback();
  } else {
    drawGradientOverlay(canvas);
  }

  const priceText = formatPrice(listing);
  const addressText = truncateText(listing.address, 42);
  const locationText = truncateText(`${listing.city}, ${listing.state}`.trim(), 48);
  const detailsText = formatDetails(listing);

  await compositeText(canvas, boldFont, priceText, 54, 48, 420);
  await compositeText(canvas, boldFont, addressText, 40, 48, 500);
  await compositeText(canvas, regularFont, locationText, 28, 48, 552);
  await compositeText(canvas, regularFont, detailsText, 24, 48, 592);
  await compositeText(canvas, regularFont, "All Agent Connect", 20, OG_WIDTH - 320, 42, 0xffffffcc);

  const accent = new Image(OG_WIDTH, 4);
  accent.fill(0x22c55eff);
  canvas.composite(accent, 0, OG_HEIGHT - 4);

  return await canvas.encodeJPEG(90);
}
