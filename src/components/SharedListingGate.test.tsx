import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_AGENT_ID = "33333333-3333-3333-3333-333333333333";

const WALL_TEXT = /create a free account to keep exploring/i;
const CHILD_TEXT = "protected child content";

// Scriptable supabase mock. Each test sets `listingResult` / `profileResult`.
let listingResult: { data: unknown; error: unknown } = { data: null, error: null };
let profileResult: { data: unknown; error: unknown } = { data: null, error: null };
let listingPromise: Promise<unknown> | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "listings_public") throw new Error(`unexpected table: ${table}`);
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => listingPromise ?? Promise.resolve(listingResult),
      };
      return builder;
    },
    rpc: (fn: string) => {
      if (fn !== "get_public_agent_profile") throw new Error(`unexpected rpc: ${fn}`);
      return Promise.resolve(profileResult);
    },
  },
}));

vi.mock("@/hooks/useAuthRole", () => ({
  useAuthRole: () => ({ user: null, loading: false }),
}));

vi.mock("@/contexts/SharedListingGuestContext", () => ({
  useSharedListingGuest: () => ({
    isGuest: true,
    allowedListingId: LISTING_ID,
    registerGuestListing: () => {},
    clearGuest: () => {},
  }),
}));

import { SharedListingGate } from "./SharedListingGate";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SharedListingGate>
        <div>{CHILD_TEXT}</div>
      </SharedListingGate>
    </MemoryRouter>,
  );
}

function expectWallVisible() {
  expect(screen.getByText(WALL_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();
}

beforeEach(() => {
  listingResult = { data: null, error: null };
  profileResult = { data: null, error: null };
  listingPromise = null;
});

describe("SharedListingGate guest agent-profile exception", () => {
  it("allows the listing agent's profile when the guest listing matches (UUID route)", async () => {
    listingResult = { data: { agent_id: AGENT_ID, status: "active" }, error: null };
    renderAt(`/agent/${AGENT_ID}`);

    // Authorization happens in an async effect — wait for it to resolve.
    expect(await screen.findByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(WALL_TEXT)).not.toBeInTheDocument();
  });

  it("blocks a different agent's profile", async () => {
    listingResult = { data: { agent_id: OTHER_AGENT_ID, status: "active" }, error: null };
    profileResult = { data: { id: OTHER_AGENT_ID }, error: null };
    renderAt(`/agent/${AGENT_ID}`);

    // Give the async check a chance to (not) resolve in the guest's favor.
    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });

  it("ignores query-string listing manipulation and stays blocked", async () => {
    listingResult = { data: { agent_id: AGENT_ID, status: "active" }, error: null };
    // Attacker tries to point the gate at a different listing via query string;
    // the gate must only use the stored first-write-wins listing id.
    renderAt(`/agent/${OTHER_AGENT_ID}?listing=${LISTING_ID}`);

    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });

  it("fails closed when the public-listing lookup errors", async () => {
    listingResult = { data: null, error: { message: "permission denied" } };
    renderAt(`/agent/${AGENT_ID}`);

    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });

  it("does not expose the profile while the lookup is still pending", async () => {
    listingPromise = new Promise(() => {}); // never resolves
    renderAt(`/agent/${AGENT_ID}`);

    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });

  it("blocks a draft listing's agent profile", async () => {
    listingResult = { data: { agent_id: AGENT_ID, status: "draft" }, error: null };
    renderAt(`/agent/${AGENT_ID}`);

    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });

  it("resolves an AAC-code route via get_public_agent_profile and allows on id match", async () => {
    listingResult = { data: { agent_id: AGENT_ID, status: "active" }, error: null };
    profileResult = { data: { id: AGENT_ID }, error: null };
    renderAt("/agent/AAC-0639");

    expect(await screen.findByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(WALL_TEXT)).not.toBeInTheDocument();
  });

  it("blocks an AAC-code route when the profile id does not match the listing agent", async () => {
    listingResult = { data: { agent_id: AGENT_ID, status: "active" }, error: null };
    profileResult = { data: { id: OTHER_AGENT_ID }, error: null };
    renderAt("/agent/AAC-0639");

    await waitFor(() => expect(screen.getByText(WALL_TEXT)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 20));
    expectWallVisible();
  });
});
