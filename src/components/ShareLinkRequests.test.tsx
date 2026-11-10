import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ShareLinkRequests } from "./ShareLinkRequests";

const state = vi.hoisted(() => ({ owner: "sharing-agent", verified: true, requests: [] as unknown[], calls: [] as unknown[][], failure: "", error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/hooks/useAuthRole", () => ({ useAuthRole: () => ({ user: { id: "delegate" }, activeOwnerUserId: state.owner, isVerifiedAgent: state.verified }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  state.calls.push(["from", table]);
  let update = false;
  const query: Record<string, unknown> = { then: (resolve: (result: unknown) => unknown) => {
    if (state.failure === (update ? "write" : "read")) throw new Error("offline");
    return resolve({ data: update ? null : state.requests, error: null });
  } };
  for (const method of ["select", "eq", "is", "order", "limit", "update"]) query[method] = (...args: unknown[]) => {
    state.calls.push([method, ...args]); if (method === "update") update = true; return query;
  };
  return query;
} } }));
function Location() { return <output data-testid="path">{useLocation().pathname}</output>; }
const mount = () => render(<MemoryRouter><ShareLinkRequests /><Location /></MemoryRouter>);

beforeEach(() => {
  state.owner = "sharing-agent"; state.verified = true; state.calls = []; state.failure = ""; state.error.mockReset();
  state.requests = [{ id: "request", title: "A buyer requested a new share link", body: "Review seller authorization.", created_at: "2026-11-10T12:00:00Z", metadata: { listing_id: "listing", requester_name: "Buyer Fixture" } }];
});

describe("sharing-agent replacement requests", () => {
  it("displays the sharing account's requests and links to listing management", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Review link requests" }));
    expect(screen.getByText("Buyer Fixture requested a new link")).toBeInTheDocument();
    expect(state.calls).toContainEqual(["eq", "agent_id", "sharing-agent"]);
    expect(state.calls).toContainEqual(["eq", "type", "share_link_request"]);
    fireEvent.click(screen.getByRole("button", { name: "Review listing and links" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/property/listing");
  });
  it("acknowledges requests only after an explicit review action", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Review link requests" }));
    expect(state.calls.some(call => call[0] === "update")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(screen.queryByText("Buyer Fixture requested a new link")).not.toBeInTheDocument());
    expect(state.calls).toContainEqual(["eq", "id", "request"]);
  });
  it("clears another account's requests immediately on context change", async () => {
    const view = mount(); await screen.findByRole("button", { name: "Review link requests" });
    state.owner = "different-agent"; state.requests = [];
    view.rerender(<MemoryRouter><ShareLinkRequests /></MemoryRouter>);
    expect(screen.queryByText("1 new share-link request")).not.toBeInTheDocument();
  });
  it("does not read requests for an unverified account", () => {
    state.verified = false; mount(); expect(state.calls).toEqual([]);
  });
  it("allows retry after a request-loading failure", async () => {
    state.failure = "read"; mount();
    await screen.findByRole("alert");
    state.failure = ""; fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("button", { name: "Review link requests" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("retains a request when marking it reviewed fails", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Review link requests" }));
    state.failure = "write"; fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(screen.getByText("Buyer Fixture requested a new link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeEnabled();
  });
});
