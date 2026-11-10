import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SharedListingGate } from "./SharedListingGate";

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, role: null as null | string, loading: false, isVerifiedAgent: false, isAdmin: false }));
const host = vi.hoisted(() => ({ dcmls: false }));
vi.mock("@/lib/host", () => ({ isDcmlsHost: () => host.dcmls }));
vi.mock("@/hooks/useAuthRole", () => ({ useAuthRole: () => auth }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/components/LoadingScreen", () => ({ LoadingScreen: () => <p>Checking access</p> }));
vi.mock("@/lib/privacyApi", () => ({ privacyRpc: vi.fn() }));

function LocationProbe() { const location = useLocation(); return <output data-testid="location">{JSON.stringify(location)}</output>; }
const mount = (path: string, state?: unknown) => render(<MemoryRouter initialEntries={[{ pathname: path.split("?")[0], search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }]}><LocationProbe /><Routes>
  <Route path="/client/shared-property/:id" element={<p>Scoped buyer page</p>} />
  <Route path="*" element={<SharedListingGate><p>Private child</p></SharedListingGate>} />
</Routes></MemoryRouter>);

beforeEach(() => {
  Object.assign(auth, { user: null, role: null, loading: false, isVerifiedAgent: false, isAdmin: false });
  host.dcmls = false;
  localStorage.clear();
});

describe("privacy route enforcement", () => {
  it.each(["/property/fixture", "/consumer-property/fixture", "/agent/fixture", "/our-agents", "/browse", "/search"])("blocks signed-out access to %s before children mount", path => {
    mount(path);
    expect(screen.queryByText("Private child")).not.toBeInTheDocument();
    expect(screen.getByText("This link is no longer available.")).toBeInTheDocument();
  });
  it("ignores forged browser guest permission and URL IDs", () => {
    localStorage.setItem("aac_shared_listing_guest", "fixture");
    mount("/property/fixture?agent_id=someone");
    expect(screen.queryByText("Private child")).not.toBeInTheDocument();
  });
  it("keeps children unmounted while role verification is pending", () => {
    auth.loading = true; mount("/property/fixture");
    expect(screen.getByText("Checking access")).toBeInTheDocument();
    expect(screen.queryByText("Private child")).not.toBeInTheDocument();
  });
  it("blocks signed-in unverified accounts", () => {
    auth.user = { id: "unverified" }; auth.role = "agent"; mount("/property/fixture");
    expect(screen.queryByText("Private child")).not.toBeInTheDocument();
  });
  it("permits a verified network account", () => {
    auth.user = { id: "verified" }; auth.role = "agent"; auth.isVerifiedAgent = true; mount("/property/fixture");
    expect(screen.getByText("Private child")).toBeInTheDocument();
  });
  it("routes authenticated buyers through a server-scoped lookup", () => {
    auth.user = { id: "buyer" }; auth.role = "buyer"; mount("/property/fixture");
    expect(screen.getByText("Scoped buyer page")).toBeInTheDocument();
    expect(screen.queryByText("Private child")).not.toBeInTheDocument();
  });
  it("preserves the Hot Sheet, return path and navigation state for buyers", () => {
    auth.user = { id: "buyer" }; auth.role = "buyer";
    mount("/consumer-property/fixture?sheet=own-sheet&returnTo=%2Ffavorites", { from: "/hot-sheets" });
    const location = JSON.parse(screen.getByTestId("location").textContent!);
    expect(location.pathname).toBe("/client/shared-property/fixture");
    expect(new URLSearchParams(location.search).get("sheet")).toBe("own-sheet");
    expect(new URLSearchParams(location.search).get("returnTo")).toBe("/favorites");
    expect(location.state).toEqual({ from: "/hot-sheets" });
  });
  it.each(["/browse", "/search", "/consumer-property/published", "/agent/published-agent"])("allows the separately gated DCMLS surface %s", path => {
    host.dcmls = true; mount(path);
    expect(screen.getByText("Private child")).toBeInTheDocument();
  });
  it("routes DCMLS property IDs to its consumer lookup without an AAC fallback", () => {
    host.dcmls = true; mount("/property/published?dcmls=1");
    expect(JSON.parse(screen.getByTestId("location").textContent!).pathname).toBe("/consumer-property/published");
  });
  it.each(["/", "/about", "/s/opaque-token", "/invite/opaque-token", "/auth/callback", "/activate"])("preserves %s for its own checks", path => {
    mount(path); expect(screen.getByText("Private child")).toBeInTheDocument();
  });
});
