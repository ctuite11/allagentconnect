import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScheduleShowingDialog from "./ScheduleShowingDialog";

const state = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn(), preview: vi.fn(), success: vi.fn(), error: vi.fn(), dcmls: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "fixture-buyer" } } }) }, functions: { invoke: state.invoke }, from: state.from } }));
vi.mock("@/lib/currentSenderProfile", () => ({ getCurrentSenderProfile: async () => ({ name: "Fixture Buyer", email: "buyer@example.invalid" }) }));
vi.mock("@/lib/fetchListingPreview", () => ({ fetchListingPreview: state.preview }));
vi.mock("@/lib/host", () => ({ isDcmlsHost: () => state.dcmls }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/components/share/ListingPreviewCard", () => ({ ListingPreviewCard: () => <p>Authorized preview</p> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => <select data-testid="time" value={value} onChange={event => onValueChange(event.target.value)}><option value="">Select a time</option>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));
beforeEach(() => { vi.clearAllMocks(); state.dcmls = false; state.invoke.mockResolvedValue({ error: null }); });

async function submit() {
  render(<ScheduleShowingDialog listingId="listing" hotSheetId="sheet" listingAddress="Authorized Home" preview={{ address: "Authorized Home", cityStateZip: "Testville, MA" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Schedule Showing" }));
  await screen.findByText("Authorized preview");
  await waitFor(() => expect(document.querySelector("#requester_name")).toBeNull());
  fireEvent.change(document.querySelector("#preferred_date")!, { target: { value: "2099-01-01" } });
  fireEvent.change(screen.getByTestId("time"), { target: { value: "10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));
}

describe("authorized showing submission", () => {
  it("passes the Hot Sheet context to the server without an unauthenticated table insert", async () => {
    await submit(); await waitFor(() => expect(state.success).toHaveBeenCalled());
    expect(state.invoke).toHaveBeenCalledWith("send-showing-request-email", expect.objectContaining({ body: expect.objectContaining({ listingId: "listing", hotSheetId: "sheet", dcmls: false, requesterEmail: "buyer@example.invalid", preferredTime: "10:00" }) }));
    expect(state.from).not.toHaveBeenCalled(); expect(state.preview).not.toHaveBeenCalled();
  });
  it("keeps the dialog open and reports a rejected server request", async () => {
    state.invoke.mockResolvedValue({ error: new Error("not authorized") });
    await submit(); await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(state.success).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
