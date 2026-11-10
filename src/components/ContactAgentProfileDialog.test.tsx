import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContactAgentProfileDialog from "./ContactAgentProfileDialog";

const state = vi.hoisted(() => ({ dcmls: false, invoke: vi.fn(), token: vi.fn(), reset: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock("@/lib/host", () => ({ isDcmlsHost: () => state.dcmls }));
vi.mock("@/lib/currentSenderProfile", () => ({ getCurrentSenderProfile: async () => null }));
vi.mock("@/hooks/useTurnstile", () => ({ useTurnstile: () => ({ containerRef: { current: null }, error: null, getFreshToken: state.token, reset: state.reset }) }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
const agentId = "00000000-0000-4000-8000-000000000401";

beforeEach(() => {
  vi.clearAllMocks(); state.dcmls = false;
  state.invoke.mockResolvedValue({ data: { success: true }, error: null });
  state.token.mockResolvedValue("offline-check");
});
async function submit() {
  render(<ContactAgentProfileDialog agentId={agentId} agentEmail="agent@example.invalid" agentName="Agent Fixture" />);
  fireEvent.click(screen.getByRole("button", { name: "Contact Agent" }));
  await screen.findByRole("dialog");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sender Fixture" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sender@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Fixture subject" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Fixture message" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
describe("authorized profile correspondence", () => {
  it("uses the agent ID and preserves the network contact form", async () => {
    await submit(); await waitFor(() => expect(state.success).toHaveBeenCalled());
    expect(state.invoke).toHaveBeenCalledWith("send-agent-profile-contact", expect.objectContaining({ body: expect.objectContaining({ agentId, dcmls: false }) }));
    expect(state.token).not.toHaveBeenCalled();
  });
  it("keeps the form open and reports an SDK rejection", async () => {
    state.invoke.mockResolvedValue({ error: new Error("not authorized") });
    await submit(); await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(state.success).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("requires a fresh verification token for a public DCMLS inquiry", async () => {
    state.dcmls = true; state.token.mockResolvedValue(null);
    await submit(); await waitFor(() => expect(state.token).toHaveBeenCalled());
    expect(state.invoke).not.toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Security verification")).toBeInTheDocument();
  });
  it("sends the verified publication scope on a DCMLS inquiry", async () => {
    state.dcmls = true; await submit(); await waitFor(() => expect(state.success).toHaveBeenCalled());
    expect(state.invoke).toHaveBeenCalledWith("send-agent-profile-contact", expect.objectContaining({ body: expect.objectContaining({ agentId, dcmls: true, turnstile_token: "offline-check" }) }));
  });
});
