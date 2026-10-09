import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { DCMLS_SETTINGS_UI_ENABLED } from "@/config/featureFlags";
import { DcmlsPublishControl } from "@/components/listing/DcmlsPublishControl";
import DcmlsBadge from "@/components/DcmlsBadge";
import { DcmlsPublishingIntroOverlay, DcmlsLaunchingSoonReminder } from "@/components/add-listing/DcmlsPublishingIntroOverlay";
import { AddListingStatusHelpContent } from "@/components/add-listing/AddListingStatusHelpContent";

describe("DCMLS prelaunch UI gate", () => {
  it("keeps the single launch switch off", () => {
    expect(DCMLS_SETTINGS_UI_ENABLED).toBe(false);
  });
  it("hides publishing controls, badges and launch introductions", () => {
    expect(renderToStaticMarkup(<DcmlsPublishControl checked onCheckedChange={() => {}} participation="on" />)).toBe("");
    expect(renderToStaticMarkup(<DcmlsBadge listing={{ publish_to_dcmls: true, dcmls_status: "published" }} />)).toBe("");
    expect(renderToStaticMarkup(<DcmlsPublishingIntroOverlay open onGotIt={() => {}} />)).toBe("");
    expect(renderToStaticMarkup(<DcmlsLaunchingSoonReminder />)).toBe("");
  });
  it("preserves status help while hiding DCMLS copy", () => {
    const html = renderToStaticMarkup(<AddListingStatusHelpContent />);
    expect(html).toContain("Off Market");
    expect(html).not.toMatch(/DCMLS|Direct Connect MLS/);
  });
  it("omits hidden DCMLS fields from both listing save paths", () => {
    for (const path of ["src/pages/AddListing.tsx", "src/pages/EditListing.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("...(!DCMLS_SETTINGS_UI_ENABLED ? {} : dcmlsParticipation");
    }
    expect(readFileSync("src/pages/AddListing.tsx", "utf8")).toContain("!DCMLS_SETTINGS_UI_ENABLED ? null : dcmlsParticipation");
  });
});