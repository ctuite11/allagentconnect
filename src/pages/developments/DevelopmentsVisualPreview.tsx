/**
 * DEV-only visual harness for New Developments Phase 1 screenshots.
 * Not registered in production routes.
 */
import { DevelopmentCard } from "@/components/developments/DevelopmentCard";
import { DevelopmentGalleryPreview } from "@/components/developments/DevelopmentGalleryPreview";
import { DevelopmentHero } from "@/components/developments/DevelopmentHero";
import { DevelopmentSubNav } from "@/components/developments/DevelopmentSubNav";
import type { DevelopmentBrowseCard, DevelopmentDetailBundle, DevelopmentMediaRow } from "@/lib/developments/types";

const mockDevelopment = {
  id: "00000000-0000-4000-8000-000000000001",
  account_id: "00000000-0000-4000-8000-000000000010",
  name: "Harbor House Residences",
  slug: "harbor-house-residences",
  lifecycle_status: "under_construction",
  publish_status: "published",
  logo_url: null,
  address: "100 Atlantic Ave",
  city: "Boston",
  state: "MA",
  postal_code: "02110",
  neighborhood: "Seaport",
  neighborhood_description: "Waterfront living steps from the Harborwalk.",
  developer_name: "North Pier Partners",
  architect_name: "Studio Lumen",
  interior_designer_name: "Atelier Reed",
  estimated_completion: "2027-06-01",
  delivery_from: "2027-03-01",
  delivery_to: "2027-09-01",
  total_units: 86,
  total_buildings: 1,
  stories: 12,
  year_built: 2027,
  construction_type: "Concrete",
  building_details: { ceiling_heights: "9–11 ft", lobby: "Staffed" },
  amenities: ["Rooftop terrace", "Fitness studio", "Residents lounge", "Package room"],
  parking_description: "Deedable garage spaces available",
  parking_included: false,
  pet_policy: "Pets welcome with registration",
  hoa_fees: "$0.85 / sqft est.",
  hoa_fee_min: null,
  hoa_fee_max: null,
  hoa_fee_includes: null,
  deposit_structure: "10% at contract · 5% at framing · balance at closing",
  incentives: "Seller credit toward closing costs on select residences",
  buyer_agent_compensation: "2.5% to buyer’s broker",
  buyer_agent_compensation_notes: null,
  description:
    "Harbor House Residences is a boutique Seaport condominium with expansive glass, private outdoor space, and a curated amenity level designed for everyday luxury.",
  highlights: ["Seaport waterfront", "Private outdoor space on most homes", "Deedable parking"],
  tier: "premium",
  latitude: null,
  longitude: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
  admin_notes: null,
  archived_at: null,
  created_by: null,
  updated_by: null,
  paused_at: null,
  published_by: null,
  slug_locked_at: null,
  submitted_at: null,
} as DevelopmentBrowseCard["development"];

function svgUrl(label: string, c1: string, c2: string) {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#g)"/>
        <circle cx="1280" cy="240" r="200" fill="#ffffff" opacity="0.12"/>
        <text x="72" y="880" fill="#f8fafc" font-family="Georgia, serif" font-size="48">${label}</text>
      </svg>`,
    )
  );
}

const heroUrl = svgUrl("Harbor House Residences", "#1e293b", "#0f172a");
const galleryUrls = [
  svgUrl("Lobby", "#334155", "#1e293b"),
  svgUrl("Residence", "#475569", "#334155"),
  svgUrl("Kitchen", "#64748b", "#475569"),
  svgUrl("Terrace", "#0f766e", "#115e59"),
  svgUrl("Amenity", "#1d4ed8", "#1e3a8a"),
];

function photo(id: string, url: string, opts?: Partial<DevelopmentMediaRow>): DevelopmentMediaRow {
  return {
    id,
    account_id: mockDevelopment.account_id,
    development_id: mockDevelopment.id,
    floor_plan_id: null,
    unit_id: null,
    update_id: null,
    kind: "photo",
    source_type: "external",
    storage_bucket: null,
    storage_path: null,
    external_url: url,
    is_hero: false,
    width: 1600,
    height: 1000,
    alt: mockDevelopment.name,
    caption: null,
    mime_type: "image/svg+xml",
    duration_seconds: null,
    sort_order: 0,
    created_by: null,
    updated_by: null,
    created_at: mockDevelopment.created_at,
    updated_at: mockDevelopment.updated_at,
    ...opts,
  };
}

const browseCard: DevelopmentBrowseCard = {
  development: mockDevelopment,
  heroUrl,
  startingPrice: 1295000,
  availableUnitCount: 12,
};

const media: DevelopmentMediaRow[] = [
  photo("hero-1", heroUrl, { is_hero: true, sort_order: 0 }),
  photo("g1", galleryUrls[0], { sort_order: 1 }),
  photo("g2", galleryUrls[1], { sort_order: 2 }),
  photo("g3", galleryUrls[2], { sort_order: 3 }),
  photo("g4", galleryUrls[3], { sort_order: 4 }),
  photo("g5", galleryUrls[4], { sort_order: 5 }),
];

const mediaUrls = Object.fromEntries(media.map((m) => [m.id, m.external_url!]));

const bundle: DevelopmentDetailBundle = {
  development: mockDevelopment,
  hero: media[0],
  media,
  mediaUrls,
  phases: [],
  floorPlans: [],
  units: [],
  documents: [],
  salesContacts: [],
  updates: [],
  startingPrice: 1295000,
  availableUnitCount: 12,
};

export default function DevelopmentsVisualPreview() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">DEV preview</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-zinc-900">
            New Developments — gallery-first overview
          </h1>
        </div>

        <section className="space-y-4" data-preview="browse">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Browse card</h2>
          <div className="max-w-xl">
            <DevelopmentCard card={browseCard} />
          </div>
        </section>

        <section className="space-y-4" data-preview="detail-gallery">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Hero → Photos → subnav
          </h2>
          <DevelopmentHero bundle={bundle} />
          <DevelopmentSubNav slug={mockDevelopment.slug} />
          <DevelopmentGalleryPreview
            developmentName={mockDevelopment.name}
            media={media}
            mediaUrls={mediaUrls}
          />
          <div id="overview" className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
            Overview section follows photography (placeholder for screenshot framing).
          </div>
        </section>
      </div>
    </div>
  );
}
