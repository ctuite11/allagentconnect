import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SecureSharedListing from "./SecureSharedListing";

const state = vi.hoisted(() => ({ rpc: vi.fn(), user: null as null | { id: string }, role: null as null | string }));
vi.mock("@/lib/privacyApi", () => ({ privacyRpc: state.rpc }));
vi.mock("@/hooks/useAuthRole", () => ({ useAuthRole: () => ({ user: state.user, role: state.role }) }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/components/LoadingScreen", () => ({ LoadingScreen: () => <p>Loading secure link</p> }));
vi.mock("@/components/PrivateImage", () => ({ PrivateMediaScope: ({ children }: { children: React.ReactNode }) => <>{children}</>, PrivateImage: () => null, PrivateFileLink: () => null }));
const token = "f".repeat(64);
const mount = () => render(<MemoryRouter initialEntries={[`/s/${token}`]}><Routes><Route path="/s/:token" element={<SecureSharedListing />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); state.user = null; state.role = null; });

describe("secure listing recipient page", () => {
  it("shows only the authorized listing and sharing agent card", async () => {
    state.rpc.mockResolvedValue({ listing: { id: "fake", address: "123 Authorized Street", city: "Test", state: "MA", price: 500000, photos: [], floor_plans: [] }, agent: { first_name: "Sharing", last_name: "Agent", email: "sharing@example.invalid" } });
    mount();
    await waitFor(() => expect(screen.getByText("123 Authorized Street")).toBeInTheDocument());
    expect(screen.getByText("Your Agent · Shared by")).toBeInTheDocument();
    expect(screen.getByText("Sharing Agent")).toBeInTheDocument();
    expect(screen.queryByText("Listing Agent")).not.toBeInTheDocument();
    expect(state.rpc).toHaveBeenCalledWith("get_shared_listing", { p_token: token });
  });
  it.each([null, "error"])("returns a neutral page for invalid/expired/revoked responses: %s", async response => {
    if (response === "error") state.rpc.mockRejectedValue(new Error("denied")); else state.rpc.mockResolvedValue(response);
    mount();
    await waitFor(() => expect(screen.getByText("This link is no longer available.")).toBeInTheDocument());
    expect(screen.queryByText(/Sharing Agent|123 Authorized Street/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request new link" })).not.toBeInTheDocument();
  });
  it("allows a signed-in buyer to request replacement without revealing the agent", async () => {
    state.user = { id: "fake-buyer" };
    state.rpc.mockResolvedValueOnce(null).mockResolvedValueOnce(true);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Request new link" }));
    await screen.findByRole("button", { name: "Request received" });
    expect(state.rpc).toHaveBeenLastCalledWith("request_new_listing_share_link", { p_token: token });
    expect(screen.queryByText(/Sharing Agent/)).not.toBeInTheDocument();
  });
  it("opens the full buyer workspace from an emailed Hot Sheet only after verifying membership", async () => {
    state.user = { id: "fixture-buyer" }; state.role = "buyer";
    const listing = { id: "listing", address: "Authorized Home", city: "Test", state: "MA", price: 500000, photos: [], floor_plans: [] };
    const agent = { id: "sharing-agent", first_name: "Sharing", last_name: "Agent" };
    state.rpc.mockResolvedValueOnce({ hot_sheet: { id: "sheet" }, listings: [listing], agent }).mockResolvedValueOnce({ listing, agent });
    function BuyerPage() { return <p>Buyer workspace {useLocation().search}</p>; }
    render(<MemoryRouter initialEntries={[`/s/${token}?kind=hotsheet&listing=listing`]}><Routes>
      <Route path="/s/:token" element={<SecureSharedListing />} /><Route path="/client/shared-property/:id" element={<BuyerPage />} />
    </Routes></MemoryRouter>);
    const page = await screen.findByText(/Buyer workspace/);
    expect(page).toHaveTextContent("sheet=sheet");
    expect(page).toHaveTextContent("returnTo=%2Fclient%2Fhot-sheets%2Fsheet");
    expect(state.rpc).toHaveBeenLastCalledWith("get_buyer_listing", { p_listing_id: "listing", p_hot_sheet_id: "sheet" });
  });
  it.each(["non-member", "network failure"])("keeps a valid token read-only when the membership check returns %s", async reason => {
    state.user = { id: "other-buyer" }; state.role = "buyer";
    const listing = { id: "listing", address: "Token-authorized Home", city: "Test", state: "MA", price: 500000, photos: [], floor_plans: [] };
    state.rpc.mockResolvedValueOnce({ hot_sheet: { id: "sheet" }, listings: [listing], agent: { id: "sharing-agent", first_name: "Sharing", last_name: "Agent" } });
    if (reason === "network failure") state.rpc.mockRejectedValueOnce(new Error("offline"));
    else state.rpc.mockResolvedValueOnce(null);
    render(<MemoryRouter initialEntries={[`/s/${token}?kind=hotsheet&listing=listing`]}><Routes>
      <Route path="/s/:token" element={<SecureSharedListing />} /><Route path="/client/shared-property/:id" element={<p>Buyer workspace</p>} />
    </Routes></MemoryRouter>);
    await screen.findByText("Token-authorized Home");
    expect(screen.queryByText("Buyer workspace")).not.toBeInTheDocument();
  });
});
