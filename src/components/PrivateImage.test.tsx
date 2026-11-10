import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PrivateImage, PrivateMediaScope } from "./PrivateImage";

const calls = vi.hoisted(() => ({ sign: vi.fn(), invoke: vi.fn(), session: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ createSignedUrl: calls.sign }) },
  functions: { invoke: calls.invoke }, auth: { getSession: calls.session },
} }));

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://kwfqjnepesiihjkdnxou.supabase.co");
  vi.clearAllMocks();
  calls.invoke.mockReset();
  calls.sign.mockResolvedValue({ data: { signedUrl: "https://kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/sign/listing-photos/fake.png?token=short-storage-signature" }, error: null });
  calls.session.mockResolvedValue({ data: { session: { user: { id: "fake-buyer" } } } });
});

describe("private listing media", () => {
  it("signs an old public reference locally instead of requesting that public URL", async () => {
    render(<PrivateImage alt="Private photo" src="https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/listing-photos/fake/one.png" />);
    expect(screen.getByAltText("Private photo")).toHaveAttribute("src", "/placeholder.svg");
    await waitFor(() => expect(calls.sign).toHaveBeenCalledWith("fake/one.png", 600));
    await waitFor(() => expect(screen.getByAltText("Private photo").getAttribute("src")).toContain("/object/sign/"));
  });
  it("sends a buyer credential in the POST body and shares one media request for a listing", async () => {
    const token = "a".repeat(64);
    calls.invoke.mockResolvedValue({ data: { photos: ["https://local.invalid/signed-one", "https://local.invalid/signed-two"] }, error: null });
    render(<PrivateMediaScope token={token}>
      <PrivateImage alt="Photo one" src="aac-private://00000000-0000-4000-8000-000000000101/photos/0" />
      <PrivateImage alt="Photo two" src="aac-private://00000000-0000-4000-8000-000000000101/photos/1" />
    </PrivateMediaScope>);
    await waitFor(() => expect(screen.getByAltText("Photo two")).toHaveAttribute("src", "https://local.invalid/signed-two"));
    expect(calls.invoke).toHaveBeenCalledTimes(1);
    expect(calls.invoke.mock.calls[0][1].body.token).toBe(token);
    expect(screen.getByAltText("Photo one").getAttribute("src")).not.toContain(token);
  });
  it("clears the previous image while a different credential is being checked", async () => {
    calls.invoke.mockResolvedValueOnce({ data: { photos: ["https://local.invalid/previous"] }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("denied") });
    const marker = "aac-private://00000000-0000-4000-8000-000000000102/photos/0";
    const { rerender } = render(<PrivateMediaScope token={"b".repeat(64)}><PrivateImage alt="Photo" src={marker} /></PrivateMediaScope>);
    await waitFor(() => expect(screen.getByAltText("Photo")).toHaveAttribute("src", "https://local.invalid/previous"));
    rerender(<PrivateMediaScope token={"c".repeat(64)}><PrivateImage alt="Photo" src={marker} /></PrivateMediaScope>);
    expect(screen.getByAltText("Photo")).toHaveAttribute("src", "/placeholder.svg");
    await waitFor(() => expect(calls.invoke).toHaveBeenCalledTimes(2));
    expect(screen.getByAltText("Photo")).toHaveAttribute("src", "/placeholder.svg");
  });
  it("loads authorized DCMLS media without requiring an authenticated session", async () => {
    calls.session.mockResolvedValue({ data: { session: null } });
    calls.invoke.mockResolvedValue({ data: { photos: ["https://local.invalid/public-authorized"] }, error: null });
    render(<PrivateMediaScope dcmls><PrivateImage alt="Public property" src="aac-private://00000000-0000-4000-8000-000000000103/photos/0" /></PrivateMediaScope>);
    await waitFor(() => expect(screen.getByAltText("Public property")).toHaveAttribute("src", "https://local.invalid/public-authorized"));
    expect(calls.invoke).toHaveBeenCalledWith("shared-listing-photos", { body: { listing_id: "00000000-0000-4000-8000-000000000103", dcmls: true } });
    expect(calls.session).not.toHaveBeenCalled();
    expect(calls.sign).not.toHaveBeenCalled();
  });
  it("does not reuse a public media result for a Hot Sheet request", async () => {
    calls.invoke.mockResolvedValueOnce({ data: { photos: ["https://local.invalid/dcmls-only"] }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("not a sheet member") });
    const marker = "aac-private://00000000-0000-4000-8000-000000000104/photos/0";
    const view = render(<PrivateMediaScope dcmls><PrivateImage alt="Scoped photo" src={marker} /></PrivateMediaScope>);
    await waitFor(() => expect(screen.getByAltText("Scoped photo")).toHaveAttribute("src", "https://local.invalid/dcmls-only"));
    view.rerender(<PrivateMediaScope hotSheetId="different-sheet" dcmls={false}><PrivateImage alt="Scoped photo" src={marker} /></PrivateMediaScope>);
    expect(screen.getByAltText("Scoped photo")).toHaveAttribute("src", "/placeholder.svg");
    await waitFor(() => expect(calls.invoke).toHaveBeenCalledTimes(2));
    expect(calls.invoke.mock.calls[1][1].body).toMatchObject({ hot_sheet_id: "different-sheet", listing_id: "00000000-0000-4000-8000-000000000104" });
    expect(screen.getByAltText("Scoped photo")).toHaveAttribute("src", "/placeholder.svg");
  });
  it.each(["/assets/local.png", "/placeholder.svg", "blob:https://local.invalid/fake", "data:image/png;base64,FAKE", "https://kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/public/agent-headshots/fake.png"])("preserves public/local preview %s", src => {
    render(<PrivateImage alt="Preview" src={src} />);
    expect(screen.getByAltText("Preview")).toHaveAttribute("src", src);
    expect(calls.sign).not.toHaveBeenCalled();
  });
});
