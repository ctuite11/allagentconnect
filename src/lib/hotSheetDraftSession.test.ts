import { describe, it, expect, vi } from "vitest";
import { createHotSheetDraftSession, draftDisplayName, type HotSheetDraftSnapshot } from "./hotSheetDraftSession";

const snap = (name: string): HotSheetDraftSnapshot => ({
  name,
  sheetType: null,
  criteria: {},
  clientIds: [],
  selectedListingIds: [],
  notifyAgent: true,
  notificationSchedule: "immediately",
});

describe("hot sheet draft session", () => {
  it("creates nothing until the first save", () => {
    const create = vi.fn();
    const s = createHotSheetDraftSession({ create, update: vi.fn() });
    expect(create).not.toHaveBeenCalled();
    expect(s.getDraftId()).toBeNull();
  });

  it("creates once, then updates the same draft (no duplicates)", async () => {
    const create = vi.fn().mockResolvedValue("d1");
    const update = vi.fn().mockResolvedValue(undefined);
    const s = createHotSheetDraftSession({ create, update });
    await s.save(snap("a"));
    await s.save(snap("b"));
    await s.save(snap("c"));
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls.every((c) => c[0] === "d1")).toBe(true);
  });

  it("resuming an existing draft never creates a new one", async () => {
    const create = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const s = createHotSheetDraftSession({ create, update }, "existing");
    await s.save(snap("x"));
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("existing", snap("x"));
  });

  it("never overlaps saves and saves the latest edit last", async () => {
    let release!: () => void;
    const create = vi.fn().mockImplementation(() => new Promise<string>((r) => { release = () => r("d1"); }));
    const update = vi.fn().mockResolvedValue(undefined);
    const s = createHotSheetDraftSession({ create, update });
    const p1 = s.save(snap("1"));
    const p2 = s.save(snap("2"));
    const p3 = s.save(snap("3"));
    expect(create).toHaveBeenCalledTimes(1);
    release();
    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(await p3).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("d1", snap("3"));
  });

  it("reports saved only after server confirmation, error on failure", async () => {
    const statuses: string[] = [];
    const create = vi.fn().mockRejectedValue(new Error("offline"));
    const s = createHotSheetDraftSession({ create, update: vi.fn(), onStatus: (x) => statuses.push(x) });
    expect(await s.save(snap("a"))).toBe(false);
    expect(statuses).toEqual(["saving", "error"]);
    expect(s.getLastSavedKey()).toBeNull();
    expect(s.getDraftId()).toBeNull();
  });

  it("a retry after a lost reply reuses the same id (no second row)", async () => {
    const rows = new Set<string>();
    let fail = true;
    const create = vi.fn().mockImplementation(async (_s: HotSheetDraftSnapshot, id: string) => {
      rows.add(id); // server wrote it...
      if (fail) { fail = false; throw new Error("reply lost"); } // ...but the reply never arrived
      return id;
    });
    const s = createHotSheetDraftSession({ create, update: vi.fn(), newId: () => "fixed-id" });
    expect(await s.save(snap("a"))).toBe(false);
    expect(await s.save(snap("b"))).toBe(true);
    expect(create.mock.calls.map((c) => c[1])).toEqual(["fixed-id", "fixed-id"]);
    expect(rows.size).toBe(1);
    expect(s.getDraftId()).toBe("fixed-id");
  });

  it("labels unnamed drafts", () => {
    expect(draftDisplayName("")).toBe("Untitled draft");
    expect(draftDisplayName("  ")).toBe("Untitled draft");
    expect(draftDisplayName("Back Bay")).toBe("Back Bay");
  });
});
