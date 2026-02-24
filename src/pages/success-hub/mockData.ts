/**
 * Static mock data for Success Hub v2 scaffold.
 * All IDs are stable URL-safe slugs. Statuses use fixed enums.
 */

// ── Status enums ──────────────────────────────────────────────
export type BuyerStatus = "active" | "pending" | "new";
export type ListingMockStatus = "active" | "pending" | "under_agreement";

// ── Buyers ────────────────────────────────────────────────────
export interface MockBuyer {
  buyerId: string;
  name: string;
  email: string;
  status: BuyerStatus;
  hotSheets: number;
  favorites: number;
  lastActive: string; // ISO date
}

export const mockBuyers: MockBuyer[] = [
  { buyerId: "b_001", name: "Sarah Chen", email: "sarah.chen@example.com", status: "active", hotSheets: 3, favorites: 12, lastActive: "2026-02-23" },
  { buyerId: "b_002", name: "Marcus Rivera", email: "m.rivera@example.com", status: "active", hotSheets: 2, favorites: 8, lastActive: "2026-02-22" },
  { buyerId: "b_003", name: "Emily Tran", email: "emily.t@example.com", status: "pending", hotSheets: 1, favorites: 4, lastActive: "2026-02-20" },
  { buyerId: "b_004", name: "James O'Brien", email: "jobrien@example.com", status: "new", hotSheets: 0, favorites: 0, lastActive: "2026-02-24" },
  { buyerId: "b_005", name: "Aisha Patel", email: "aisha.p@example.com", status: "active", hotSheets: 4, favorites: 19, lastActive: "2026-02-24" },
  { buyerId: "b_006", name: "David Kim", email: "dkim@example.com", status: "pending", hotSheets: 1, favorites: 2, lastActive: "2026-02-18" },
];

// ── Listings ──────────────────────────────────────────────────
export interface MockListing {
  listingId: string;
  address: string;
  city: string;
  state: string;
  price: number;
  status: ListingMockStatus;
  metrics: { matches: number; likes: number; shares: number; saves: number };
  events: { date: string; label: string }[];
}

export const mockListings: MockListing[] = [
  {
    listingId: "l_001", address: "42 Beacon St", city: "Boston", state: "MA", price: 895000, status: "active",
    metrics: { matches: 14, likes: 8, shares: 3, saves: 6 },
    events: [
      { date: "2026-02-24", label: "Viewed by 3 agents" },
      { date: "2026-02-22", label: "Shared to hot sheet" },
      { date: "2026-02-20", label: "Listed" },
    ],
  },
  {
    listingId: "l_002", address: "118 Commonwealth Ave", city: "Newton", state: "MA", price: 1250000, status: "active",
    metrics: { matches: 22, likes: 15, shares: 7, saves: 11 },
    events: [
      { date: "2026-02-23", label: "Price updated" },
      { date: "2026-02-19", label: "Listed" },
    ],
  },
  {
    listingId: "l_003", address: "7 Harbor Ln", city: "Marblehead", state: "MA", price: 725000, status: "pending",
    metrics: { matches: 9, likes: 4, shares: 1, saves: 3 },
    events: [
      { date: "2026-02-21", label: "Offer received" },
      { date: "2026-02-15", label: "Listed" },
    ],
  },
  {
    listingId: "l_004", address: "201 Main St", city: "Brookline", state: "MA", price: 1450000, status: "under_agreement",
    metrics: { matches: 31, likes: 20, shares: 12, saves: 18 },
    events: [
      { date: "2026-02-24", label: "Under agreement" },
      { date: "2026-02-18", label: "Open house held" },
      { date: "2026-02-10", label: "Listed" },
    ],
  },
  {
    listingId: "l_005", address: "55 Elm St", city: "Cambridge", state: "MA", price: 975000, status: "active",
    metrics: { matches: 17, likes: 10, shares: 5, saves: 9 },
    events: [
      { date: "2026-02-23", label: "New match from hot sheet" },
      { date: "2026-02-17", label: "Listed" },
    ],
  },
  {
    listingId: "l_006", address: "330 Atlantic Ave", city: "Boston", state: "MA", price: 2100000, status: "active",
    metrics: { matches: 8, likes: 3, shares: 2, saves: 4 },
    events: [
      { date: "2026-02-24", label: "Listed" },
    ],
  },
];

// ── Communications Feed ───────────────────────────────────────
export type FeedType = "buyer_need" | "email" | "market_signal" | "agent_post";

export interface MockFeedItem {
  feedId: string;
  type: FeedType;
  title: string;
  preview: string;
  timestamp: string;
}

export const mockCommunications: MockFeedItem[] = [
  { feedId: "f_001", type: "buyer_need", title: "New buyer need posted", preview: "Looking for 3BR in Brookline under $1.2M", timestamp: "2026-02-24T14:30:00Z" },
  { feedId: "f_002", type: "email", title: "Hot sheet invite accepted", preview: "Sarah Chen accepted your hot sheet invite", timestamp: "2026-02-24T12:15:00Z" },
  { feedId: "f_003", type: "market_signal", title: "Price reduction nearby", preview: "118 Commonwealth Ave reduced to $1.15M", timestamp: "2026-02-24T10:00:00Z" },
  { feedId: "f_004", type: "agent_post", title: "New listing from network", preview: "Marcus Rivera listed 7 Harbor Ln in Marblehead", timestamp: "2026-02-23T16:45:00Z" },
  { feedId: "f_005", type: "buyer_need", title: "Buyer need matched", preview: "Your listing matches 3 active buyer needs", timestamp: "2026-02-23T14:00:00Z" },
  { feedId: "f_006", type: "email", title: "Showing request received", preview: "Showing requested for 42 Beacon St on Feb 26", timestamp: "2026-02-23T11:30:00Z" },
  { feedId: "f_007", type: "market_signal", title: "Market report available", preview: "Q1 2026 Boston metro housing report", timestamp: "2026-02-22T09:00:00Z" },
  { feedId: "f_008", type: "agent_post", title: "Open house announced", preview: "Emily Tran hosting open house at 201 Main St", timestamp: "2026-02-22T08:00:00Z" },
  { feedId: "f_009", type: "email", title: "Client feedback received", preview: "James O'Brien commented on 55 Elm St", timestamp: "2026-02-21T15:00:00Z" },
  { feedId: "f_010", type: "buyer_need", title: "Urgent buyer need", preview: "Cash buyer seeking condo in Back Bay, any price", timestamp: "2026-02-21T10:00:00Z" },
];

// ── Messages ──────────────────────────────────────────────────
export interface MockThread {
  threadId: string;
  contactName: string;
  lastMessage: string;
  unread: number;
  timestamp: string;
}

export const mockMessages: MockThread[] = [
  { threadId: "t_001", contactName: "Sarah Chen", lastMessage: "Thanks for the hot sheet update!", unread: 2, timestamp: "2026-02-24T14:00:00Z" },
  { threadId: "t_002", contactName: "Marcus Rivera", lastMessage: "Can we schedule a showing for Friday?", unread: 1, timestamp: "2026-02-24T11:00:00Z" },
  { threadId: "t_003", contactName: "Emily Tran", lastMessage: "I'll review the comps tonight", unread: 0, timestamp: "2026-02-23T16:00:00Z" },
  { threadId: "t_004", contactName: "Aisha Patel", lastMessage: "Loved the new listing on Beacon St", unread: 0, timestamp: "2026-02-23T09:00:00Z" },
  { threadId: "t_005", contactName: "David Kim", lastMessage: "Is the open house still on?", unread: 3, timestamp: "2026-02-22T14:00:00Z" },
];

// ── Metrics ───────────────────────────────────────────────────
export const mockMetrics = {
  pendingInvites: 4,
  activeBuyers: 3,
  activeListings: 4,
  unreadMessages: 6,
};

// ── Buyer-detail mock sub-data ────────────────────────────────
export interface MockHotSheet {
  id: string;
  name: string;
  criteria: string;
  lastSent: string;
}

export interface MockActivityEvent {
  id: string;
  date: string;
  label: string;
}

export const mockBuyerHotSheets: Record<string, MockHotSheet[]> = {
  b_001: [
    { id: "hs_001", name: "Back Bay Condos", criteria: "2+ BR, $800K–$1.2M, Back Bay", lastSent: "2026-02-23" },
    { id: "hs_002", name: "Brookline SFH", criteria: "3+ BR, $1M–$1.5M, Brookline", lastSent: "2026-02-20" },
    { id: "hs_003", name: "Waterfront Any", criteria: "Any type, waterfront, $1M+", lastSent: "2026-02-18" },
  ],
  b_002: [
    { id: "hs_004", name: "Newton Starter Homes", criteria: "2–3 BR, $600K–$900K, Newton", lastSent: "2026-02-22" },
    { id: "hs_005", name: "Cambridge Condos", criteria: "1+ BR, $500K–$800K, Cambridge", lastSent: "2026-02-19" },
  ],
  b_003: [
    { id: "hs_006", name: "Marblehead Coastal", criteria: "3+ BR, $700K+, Marblehead", lastSent: "2026-02-15" },
  ],
  b_005: [
    { id: "hs_007", name: "Luxury Boston", criteria: "2+ BR, $1.5M+, Boston", lastSent: "2026-02-24" },
    { id: "hs_008", name: "Investment Props", criteria: "Multi-family, $800K–$2M, metro", lastSent: "2026-02-22" },
    { id: "hs_009", name: "South End Condos", criteria: "1+ BR, $600K–$1M, South End", lastSent: "2026-02-20" },
    { id: "hs_010", name: "Beacon Hill", criteria: "Any, $1M+, Beacon Hill", lastSent: "2026-02-18" },
  ],
  b_006: [
    { id: "hs_011", name: "First-time Buyer", criteria: "2 BR, $400K–$600K, any", lastSent: "2026-02-10" },
  ],
};

export const mockBuyerActivity: Record<string, MockActivityEvent[]> = {
  b_001: [
    { id: "a_001", date: "2026-02-23", label: "Accepted hot sheet invite" },
    { id: "a_002", date: "2026-02-22", label: "Favorited 42 Beacon St" },
    { id: "a_003", date: "2026-02-20", label: "Viewed 3 listings" },
    { id: "a_004", date: "2026-02-18", label: "Invited to hot sheet" },
  ],
  b_002: [
    { id: "a_005", date: "2026-02-22", label: "Favorited 118 Commonwealth Ave" },
    { id: "a_006", date: "2026-02-19", label: "Accepted invite" },
  ],
  b_003: [
    { id: "a_007", date: "2026-02-20", label: "Invited — awaiting response" },
  ],
  b_004: [
    { id: "a_008", date: "2026-02-24", label: "Added as new buyer" },
  ],
  b_005: [
    { id: "a_009", date: "2026-02-24", label: "Viewed 5 listings" },
    { id: "a_010", date: "2026-02-23", label: "Favorited 201 Main St" },
    { id: "a_011", date: "2026-02-22", label: "Accepted hot sheet invite" },
    { id: "a_012", date: "2026-02-20", label: "Invited" },
  ],
  b_006: [
    { id: "a_013", date: "2026-02-18", label: "Invited — awaiting response" },
  ],
};
