/**
 * LOCKED regression tests — Hot Sheet Contacts behavior in the EXISTING
 * Create and Edit dialogs (tested separately on purpose; do not refactor the
 * dialogs into a shared component just to satisfy these tests).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const tableData: Record<string, unknown> = {};
let searchResults: any[] = [];

function chain(table: string): any {
  const result = () => Promise.resolve({ data: tableData[table] ?? [], error: null, count: 0 });
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res: any, rej: any) => result().then(res, rej);
      if (prop === "single" || prop === "maybeSingle")
        return () => Promise.resolve({ data: null, error: null });
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => chain(t),
    rpc: () => Promise.resolve({ data: false, error: null }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "agent-1" } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    channel: () => ({ on: function () { return this; }, subscribe: () => ({}) }),
    removeChannel: () => {},
  },
}));

vi.mock("@/lib/contactSearch", () => ({
  searchClientContacts: vi.fn(() => Promise.resolve(searchResults)),
  fetchAllAgentContacts: vi.fn(() => Promise.resolve([])),
  invalidateAgentContactsCache: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }) }));

import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";

const buyer = { id: "c-buyer", first_name: "Kerri", last_name: "Buyer", email: "kerri@example.com", phone: null };
const extra = { id: "c-extra", first_name: "Sam", last_name: "Second", email: "sam@example.com", phone: null };

beforeEach(() => {
  for (const k of Object.keys(tableData)) delete tableData[k];
  searchResults = [extra];
  // jsdom lacks these; Radix uses them
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

const results = () => screen.queryByTestId("contact-search-results");

async function typeSearch(input: HTMLElement, q = "sa") {
  fireEvent.change(input, { target: { value: q } });
  await waitFor(() => expect(results()).toBeInTheDocument(), { timeout: 2000 });
}

function renderCreateFromBuyer() {
  return render(
    <CreateHotSheetDialog
      open
      onOpenChange={() => {}}
      userId="agent-1"
      onSuccess={() => {}}
      clientId={buyer.id}
      clientName="Kerri Buyer"
      preSelectedClients={[buyer]}
      lockedToClient
    />,
  );
}

async function openCreatePicker() {
  renderCreateFromBuyer();
  fireEvent.click(await screen.findByRole("button", { name: /Add Additional Contact/i }));
  return screen.getByLabelText("Search Existing Contact");
}

describe("Create Hot Sheet — contacts (locked)", () => {
  it("shows Add Additional Contact when opened from a buyer", async () => {
    renderCreateFromBuyer();
    expect(await screen.findByRole("button", { name: /Add Additional Contact/i })).toBeInTheDocument();
  });

  it("shows Add Additional Contact on a fresh Create once a contact is selected", async () => {
    render(<CreateHotSheetDialog open onOpenChange={() => {}} userId="agent-1" onSuccess={() => {}} preSelectedClients={[buyer]} />);
    expect(await screen.findByRole("button", { name: /Add Additional Contact/i })).toBeInTheDocument();
  });

  it("original buyer cannot be removed; an added secondary contact can", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    fireEvent.click(screen.getByRole("button", { name: /Sam Second/ }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("sam@example.com")).not.toBeInTheDocument());
    expect(screen.getByText("kerri@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("search closes on selection", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    fireEvent.click(screen.getByRole("button", { name: /Sam Second/ }));
    await waitFor(() => expect(results()).not.toBeInTheDocument());
  });

  it("search closes on Escape", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(results()).not.toBeInTheDocument();
  });

  it("search closes on blur / click-away", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    fireEvent.blur(input);
    await waitFor(() => expect(results()).not.toBeInTheDocument(), { timeout: 1000 });
  });

  it("no-results search shows no dropdown", async () => {
    searchResults = [];
    const input = await openCreatePicker();
    fireEvent.change(input, { target: { value: "zzz" } });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(results()).not.toBeInTheDocument();
  });

  it("manual add never has search results floating over it", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    fireEvent.click(screen.getByRole("button", { name: /add a new contact manually/i }));
    await waitFor(() => expect(screen.getByLabelText(/First Name/)).toBeInTheDocument());
    expect(results()).not.toBeInTheDocument();
    // typing a new query while manual add is open still must not show results
    fireEvent.change(input, { target: { value: "sam" } });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(results()).not.toBeInTheDocument();
  });

  it("results list is in normal flow, not an absolute overlay", async () => {
    const input = await openCreatePicker();
    await typeSearch(input);
    expect(results()!.className).not.toMatch(/\babsolute\b/);
  });
});

async function openEdit(contacts = [buyer]) {
  tableData["hot_sheet_clients"] = contacts.map((c) => ({ client_id: c.id, clients: c }));
  render(
    <EditHotsheetCriteriaDialog open onOpenChange={() => {}} hotSheetId="hs-1" initialCriteria={{ state: "MA" }} onUpdate={() => {}} />,
  );
  return screen.findByRole("button", { name: /Add Additional Contact/i });
}

async function openEditPicker() {
  fireEvent.click(await openEdit());
  return screen.getByLabelText("Search Existing Contact");
}

describe("Edit Hot Sheet — contacts (locked)", () => {
  it("shows the attached contacts and Add Additional Contact", async () => {
    expect(await openEdit()).toBeInTheDocument();
    expect(screen.getByText("kerri@example.com")).toBeInTheDocument();
  });

  it("the last remaining contact cannot be removed", async () => {
    await openEdit();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("an added secondary contact can be removed", async () => {
    const input = await openEditPicker();
    await typeSearch(input);
    fireEvent.click(screen.getByRole("button", { name: /Sam Second/ }));
    await waitFor(() => expect(screen.getByText("sam@example.com")).toBeInTheDocument());
    const removes = screen.getAllByRole("button", { name: "Remove" });
    expect(removes).toHaveLength(2);
    fireEvent.click(removes[1]);
    await waitFor(() => expect(screen.queryByText("sam@example.com")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("search closes on selection", async () => {
    const input = await openEditPicker();
    await typeSearch(input);
    fireEvent.click(screen.getByRole("button", { name: /Sam Second/ }));
    await waitFor(() => expect(results()).not.toBeInTheDocument());
  });

  it("search closes on Escape", async () => {
    const input = await openEditPicker();
    await typeSearch(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(results()).not.toBeInTheDocument();
  });

  it("search closes on blur / click-away", async () => {
    const input = await openEditPicker();
    await typeSearch(input);
    fireEvent.blur(input);
    await waitFor(() => expect(results()).not.toBeInTheDocument(), { timeout: 1000 });
  });

  it("no-results search shows no dropdown", async () => {
    searchResults = [];
    const input = await openEditPicker();
    fireEvent.change(input, { target: { value: "zzz" } });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(results()).not.toBeInTheDocument();
  });

  it("results list is in normal flow, not an absolute overlay", async () => {
    const input = await openEditPicker();
    await typeSearch(input);
    expect(results()!.className).not.toMatch(/\babsolute\b/);
  });
});
