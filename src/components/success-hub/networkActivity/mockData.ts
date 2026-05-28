/** Stub feed data for Network Activity — replace with live queries later. */

export type BuyerDemandItem = {
  id: string;
  buyerLabel: string;
  location: string;
  priceRange: string;
  propertyType: string;
  timestamp: string;
  isNew?: boolean;
};

export type ListingActivityItem = {
  id: string;
  address: string;
  city: string;
  price: number;
  statusLabel: "New listing" | "Pre-market" | "Shared opportunity";
  agentName: string;
  brokerage: string;
  neighborhood: string;
  timestamp: string;
  photoUrl?: string;
};

export type NetworkBroadcastItem = {
  id: string;
  authorName: string;
  authorInitials: string;
  category: "Referral" | "Off-market" | "Market intel" | "Rental request";
  preview: string;
  timestamp: string;
};

export type VerifiedAgentItem = {
  id: string;
  name: string;
  brokerage: string;
  market: string;
};

export type ShowingPulseItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  kind: "showing" | "open_house" | "pulse";
};

export const MOCK_BUYER_DEMAND: BuyerDemandItem[] = [
  {
    id: "bd-1",
    buyerLabel: "Buyer need · Seaport loft",
    location: "Boston, MA · Seaport",
    priceRange: "$1.2M – $1.6M",
    propertyType: "Condo · 2+ bed",
    timestamp: "18m ago",
    isNew: true,
  },
  {
    id: "bd-2",
    buyerLabel: "Buyer need · Newton family",
    location: "Newton, MA · South",
    priceRange: "$1.4M – $1.9M",
    propertyType: "Single-family",
    timestamp: "1h ago",
    isNew: true,
  },
  {
    id: "bd-3",
    buyerLabel: "Buyer need · Cambridge walkable",
    location: "Cambridge, MA",
    priceRange: "$850K – $1.1M",
    propertyType: "Condo · 1–2 bed",
    timestamp: "3h ago",
  },
  {
    id: "bd-4",
    buyerLabel: "Buyer need · Marblehead water",
    location: "Marblehead, MA",
    priceRange: "$1.8M – $2.4M",
    propertyType: "Waterfront",
    timestamp: "Yesterday",
  },
];

export const MOCK_LISTING_ACTIVITY: ListingActivityItem[] = [
  {
    id: "la-1",
    address: "33 Sleeper St #508",
    city: "Boston",
    price: 1375000,
    statusLabel: "Pre-market",
    agentName: "Charles Joseph",
    brokerage: "Compass",
    neighborhood: "Seaport",
    timestamp: "32m ago",
    photoUrl:
      "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/listing-photos/be8d4e9a-798d-456b-8b7b-152b7f3d43a6/0.7267744968741802.jpg",
  },
  {
    id: "la-2",
    address: "118 Commonwealth Ave",
    city: "Newton",
    price: 1250000,
    statusLabel: "New listing",
    agentName: "Sarah Mitchell",
    brokerage: "Coldwell Banker",
    neighborhood: "Newton Centre",
    timestamp: "2h ago",
  },
  {
    id: "la-3",
    address: "7 Harbor Ln",
    city: "Marblehead",
    price: 725000,
    statusLabel: "Shared opportunity",
    agentName: "James O'Brien",
    brokerage: "William Raveis",
    neighborhood: "Old Town",
    timestamp: "4h ago",
  },
];

export const MOCK_NETWORK_BROADCASTS: NetworkBroadcastItem[] = [
  {
    id: "nb-1",
    authorName: "Elena Vasquez",
    authorInitials: "EV",
    category: "Off-market",
    preview: "Pocket listing in Back Bay — 2 bed, deeded parking, owner relocating end of month.",
    timestamp: "45m ago",
  },
  {
    id: "nb-2",
    authorName: "Marcus Rivera",
    authorInitials: "MR",
    category: "Referral",
    preview: "Qualified buyer relocating from NYC; prefers Brookline or Newton, pre-approved to $2.1M.",
    timestamp: "2h ago",
  },
  {
    id: "nb-3",
    authorName: "Aisha Patel",
    authorInitials: "AP",
    category: "Market intel",
    preview: "Inventory tightening in Cambridge 02139 — three coming-soon units expected this week.",
    timestamp: "5h ago",
  },
  {
    id: "nb-4",
    authorName: "David Kim",
    authorInitials: "DK",
    category: "Rental request",
    preview: "Corporate relocation — 3-bed rental in Seaport or South End, 12-month lease preferred.",
    timestamp: "Yesterday",
  },
];

export const MOCK_VERIFIED_AGENTS: VerifiedAgentItem[] = [
  { id: "ag-1", name: "Charles Joseph", brokerage: "Compass", market: "Boston · Seaport" },
  { id: "ag-2", name: "Sarah Mitchell", brokerage: "Coldwell Banker", market: "Newton · Brookline" },
  { id: "ag-3", name: "James O'Brien", brokerage: "William Raveis", market: "North Shore" },
  { id: "ag-4", name: "Emily Tran", brokerage: "Keller Williams", market: "Cambridge" },
  { id: "ag-5", name: "Aisha Patel", brokerage: "Compass", market: "Boston · Back Bay" },
  { id: "ag-6", name: "David Kim", brokerage: "RE/MAX", market: "South Shore" },
];

export const MOCK_SHOWING_PULSE: ShowingPulseItem[] = [
  {
    id: "sp-1",
    label: "Upcoming showing",
    detail: "33 Sleeper St #508 · Tomorrow 10:30 AM",
    timestamp: "Scheduled",
    kind: "showing",
  },
  {
    id: "sp-2",
    label: "Open house",
    detail: "118 Commonwealth Ave · Sun 12:00–2:00 PM",
    timestamp: "This week",
    kind: "open_house",
  },
  {
    id: "sp-3",
    label: "Network pulse",
    detail: "14 new listings shared in your coverage areas today",
    timestamp: "Live",
    kind: "pulse",
  },
  {
    id: "sp-4",
    label: "Recent activity",
    detail: "6 buyer needs matched to pre-market inventory in Seaport",
    timestamp: "3h ago",
    kind: "pulse",
  },
];
