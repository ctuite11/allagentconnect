import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const hotSheetQuery = vi.fn();
const profileCheck = vi.fn();
const dismiss = vi.fn();
let settings: any = { welcome_modal_dismissed: false, preferences_set: false };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        limit: async () => {
          hotSheetQuery();
          return { data: [], error: null };
        },
      };
      return b;
    },
  },
}));

vi.mock("@/hooks/useAgentSettings", () => ({
  // Fresh dismiss function every render, exactly like the real hook.
  useAgentSettings: () => ({
    settings,
    loading: false,
    dismissWelcomeModal: () => dismiss(),
    checkProfileComplete: profileCheck,
  }),
}));

vi.mock("@/lib/setupChecklistWelcomeHandoff", () => ({ consumeSetupChecklistWelcome: () => false }));

import { useAgentProfileOnboarding } from "./useAgentProfileOnboarding";

const user = { id: "u1", email: "a@b.com" } as any;

beforeEach(() => {
  hotSheetQuery.mockClear();
  profileCheck.mockReset().mockResolvedValue(false);
  dismiss.mockClear();
  sessionStorage.clear();
  settings = { welcome_modal_dismissed: false, preferences_set: false };
});

describe("Success Hub setup checklist", () => {
  it("checks once per visit, not on every re-render", async () => {
    const { result, rerender } = renderHook(() => useAgentProfileOnboarding(user));
    await waitFor(() => expect(result.current.visible ?? true).toBeTruthy());
    for (let i = 0; i < 20; i++) rerender();
    await new Promise((r) => setTimeout(r, 50));
    expect(profileCheck).toHaveBeenCalledTimes(1);
    expect(hotSheetQuery).toHaveBeenCalledTimes(1);
  });

  it("re-checks when a setup step (Communications preferences) is completed", async () => {
    const { rerender } = renderHook(() => useAgentProfileOnboarding(user));
    await waitFor(() => expect(profileCheck).toHaveBeenCalledTimes(1));
    settings = { ...settings, preferences_set: true };
    rerender();
    await waitFor(() => expect(profileCheck).toHaveBeenCalledTimes(2));
    expect(hotSheetQuery).toHaveBeenCalledTimes(2);
  });

  it("does not query at all once the checklist was dismissed", async () => {
    settings = { welcome_modal_dismissed: true, preferences_set: true };
    const { rerender } = renderHook(() => useAgentProfileOnboarding(user));
    rerender();
    await new Promise((r) => setTimeout(r, 30));
    expect(profileCheck).not.toHaveBeenCalled();
    expect(hotSheetQuery).not.toHaveBeenCalled();
  });
});
