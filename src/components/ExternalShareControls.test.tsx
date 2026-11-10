import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExternalShareControls } from "./ExternalShareControls";

const state = vi.hoisted(() => ({ rpc: vi.fn(), verified: true }));
vi.mock("@/lib/privacyApi", () => ({ privacyRpc: state.rpc }));
vi.mock("@/hooks/useAuthRole", () => ({ useAuthRole: () => ({ isVerifiedAgent: state.verified }) }));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicOrigin: () => "https://aac.example.invalid" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); state.verified = true; state.rpc.mockResolvedValue([]); });
describe("external sharing controls", () => {
  it("requires the listing owner's saved authorization before creating links", async () => {
    render(<ExternalShareControls listingId="fixture-listing" isOwner allowed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "External sharing settings" }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByRole("button", { name: "Create link" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save authorization" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Seller authorization and applicable restrictions"), { target: { value: "Seller permits sharing subject to recorded restrictions" } });
    fireEvent.click(screen.getByRole("button", { name: "Save authorization" }));
    await screen.findByRole("button", { name: "Create link" });
    expect(state.rpc).toHaveBeenCalledWith("set_listing_external_sharing", {
      p_listing_id: "fixture-listing", p_allowed: true, p_authorization: "Seller permits sharing subject to recorded restrictions",
    });
  });
  it("shows a new opaque link once and rejects out-of-range expiry in the UI", async () => {
    state.rpc.mockImplementation(async name => name === "create_listing_share_link" ? "a".repeat(64) : []);
    render(<ExternalShareControls listingId="fixture-listing" isOwner={false} allowed />);
    fireEvent.click(screen.getByRole("button", { name: "Share externally" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Expires in days (1–365)"), { target: { value: "366" } });
    expect(screen.getByRole("button", { name: "Create link" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Expires in days (1–365)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    const input = await screen.findByLabelText("Copy this new link before closing");
    expect(input).toHaveValue("https://aac.example.invalid/s/" + "a".repeat(64));
    expect(state.rpc).toHaveBeenCalledWith("create_listing_share_link", { p_listing_id: "fixture-listing", p_recipient_label: null, p_days: 30 });
  });
  it("replaces an existing link using its ID and displays only the replacement token", async () => {
    state.rpc.mockImplementation(async name => name === "replace_listing_share_link" ? "b".repeat(64)
      : [{ id: "fixture-link", recipient_label: "Buyer", created_at: "2026-11-10", expires_at: "2027-01-01", revoked_at: null }]);
    render(<ExternalShareControls listingId="fixture-listing" isOwner={false} allowed />);
    fireEvent.click(screen.getByRole("button", { name: "Share externally" }));
    fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
    await waitFor(() => expect(screen.getByLabelText("Copy this new link before closing")).toHaveValue("https://aac.example.invalid/s/" + "b".repeat(64)));
    expect(state.rpc).toHaveBeenCalledWith("replace_listing_share_link", { p_link_id: "fixture-link", p_days: 90 });
  });
  it("offers no controls to an unverified account or another agent when sharing is off", () => {
    const { rerender } = render(<ExternalShareControls listingId="fixture" isOwner={false} allowed={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    state.verified = false;
    rerender(<ExternalShareControls listingId="fixture" isOwner allowed />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
