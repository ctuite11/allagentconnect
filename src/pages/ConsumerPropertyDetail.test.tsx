import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import ConsumerPropertyDetail from "./ConsumerPropertyDetail";

const state = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), insert: vi.fn(), sticky: vi.fn(), dcmls: false,
  user: { id: "fixture-buyer" }, schedule: vi.fn(), message: vi.fn(), dcmlsListing: vi.fn(), dcmlsAgent: vi.fn(),
}));
vi.mock("@/hooks/useAuthRole", () => ({ useAuthRole: () => ({ user: state.user, role: "buyer", loading: false }) }));
vi.mock("@/lib/privacyApi", () => ({ privacyRpc: state.rpc }));
vi.mock("@/lib/host", () => ({ isDcmlsHost: () => state.dcmls }));
vi.mock("@/lib/dcmlsListing", () => ({ fetchDcmlsListing: state.dcmlsListing, fetchDcmlsListingAgent: state.dcmlsAgent }));
vi.mock("@/utils/agentTracking", () => ({ syncStickyFromDB: state.sticky }));
vi.mock("@/contexts/SharedListingGuestContext", () => ({ useSharedListingGuest: () => ({ registerGuestListing: vi.fn() }) }));
vi.mock("@/hooks/useListingView", () => ({ useListingView: vi.fn() }));
vi.mock("@/hooks/useAgentLastSeen", () => ({ useAgentLastSeen: () => ({ isOnline: false }) }));
vi.mock("@/components/PropertyMetaTags", () => ({ PropertyMetaTags: () => null }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/components/PropertyMap", () => ({ default: () => <p>Authorized property map</p> }));
vi.mock("@/components/AdBanner", () => ({ default: () => null }));
vi.mock("@/components/BuyerAgentShowcase", () => ({ BuyerAgentShowcase: () => null }));
vi.mock("@/components/dcmls/DcmlsConsumerHeader", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ScheduleShowingDialog", () => ({ default: (props: unknown) => <button onClick={() => state.schedule(props)}>Schedule Showing</button> }));
vi.mock("@/components/ListingMessageDialog", () => ({
  listingMessageRecipientFromProfile: (profile: { id: string; first_name: string; last_name: string }) => ({ id: profile.id, name: `${profile.first_name} ${profile.last_name}` }),
  ListingMessageDialog: (props: { open: boolean; recipient: { id: string; name: string } }) => {
    state.message(props); return props.open ? <div role="dialog">Message to {props.recipient.name}</div> : null;
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  from: (table: string) => {
    state.from(table);
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }), insert: (value: unknown) => { state.insert(table, value); return Promise.resolve({ error: null }); } };
    return query;
  },
} }));

const listing = { id: "fixture-listing", address: "123 Authorized Home", city: "Testville", state: "MA", zip_code: "00000", price: 500000,
  status: "active", listing_type: "for_sale", property_type: "single_family", description: "Authorized property description", year_built: 2000,
  bedrooms: 3, bathrooms: 2, square_feet: 1600, photos: [], floor_plans: [], property_features: ["Fireplace"] };
const agent = { id: "sharing-agent", first_name: "Sharing", last_name: "Agent", email: "sharing@example.invalid", company: "Fixture Brokerage" };
const mount = () => render(<MemoryRouter initialEntries={["/client/shared-property/fixture-listing?sheet=own-sheet&returnTo=%2Ffavorites"]}>
  <TooltipProvider><Routes><Route path="/client/shared-property/:id" element={<ConsumerPropertyDetail />} /><Route path="/favorites" element={<p>Returned to favorites</p>} /></Routes></TooltipProvider>
</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks(); state.dcmls = false; state.user = { id: "fixture-buyer" };
  state.sticky.mockResolvedValue(null); state.rpc.mockResolvedValue({ listing, agent });
  state.dcmlsListing.mockResolvedValue(listing); state.dcmlsAgent.mockResolvedValue(null);
});

describe("authorized buyer property detail", () => {
  it("retains property sections and uses only scoped data and the sharing-agent card", async () => {
    mount(); await screen.findByText("Authorized property description");
    expect(state.rpc).toHaveBeenCalledWith("get_buyer_listing", { p_listing_id: "fixture-listing", p_hot_sheet_id: "own-sheet" });
    expect(screen.getByText("Your Agent / Shared by")).toBeInTheDocument();
    expect(screen.getByText("Sharing Agent")).toBeInTheDocument();
    expect(screen.getByText("Authorized property map")).toBeInTheDocument();
    expect(state.from).not.toHaveBeenCalledWith("listings");
    expect(state.from).not.toHaveBeenCalledWith("agent_profiles");
    expect(state.sticky).not.toHaveBeenCalled();
  });
  it("retains favorite, showing, messaging and return actions", async () => {
    mount(); await screen.findByText("Authorized property description");
    const favorite = screen.getByRole("button", { name: "Add to favorites" });
    await waitFor(() => expect(state.from).toHaveBeenCalledWith("favorites"));
    fireEvent.click(favorite);
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith("favorites", { user_id: "fixture-buyer", listing_id: "fixture-listing" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule Showing" }));
    expect(state.schedule).toHaveBeenCalledWith(expect.objectContaining({ listingId: "fixture-listing", hotSheetId: "own-sheet", preview: expect.objectContaining({ address: listing.address }) }));
    fireEvent.click(screen.getByRole("button", { name: "Message your agent" }));
    await screen.findByRole("dialog");
    expect(state.message).toHaveBeenLastCalledWith(expect.objectContaining({ recipient: expect.objectContaining({ id: "sharing-agent" }), open: true }));
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText("Returned to favorites")).toBeInTheDocument();
  });
  it("returns a neutral page when membership or seller permission is absent", async () => {
    state.rpc.mockResolvedValue(null); mount();
    await screen.findByText("This link is no longer available.");
    expect(screen.queryByText(listing.address)).not.toBeInTheDocument();
    expect(state.from).not.toHaveBeenCalledWith("listings");
  });
  it("clears the previous buyer's data immediately on account change", async () => {
    const view = mount(); await screen.findByText("Authorized property description");
    state.user = { id: "different-buyer" }; state.rpc.mockResolvedValue(null);
    view.rerender(<MemoryRouter initialEntries={["/client/shared-property/fixture-listing"]}><Routes><Route path="/client/shared-property/:id" element={<ConsumerPropertyDetail />} /></Routes></MemoryRouter>);
    expect(screen.queryByText("Authorized property description")).not.toBeInTheDocument();
    await screen.findByText("This link is no longer available.");
  });
});
