import { DCMLS_SETTINGS_UI_ENABLED } from "@/config/featureFlags";
import { isDcmlsHost } from "@/lib/host";

/**
 * DCMLS Badge — Small emerald pill shown on listing cards
 * when the listing is published to DCMLS.
 */
const DcmlsBadge = ({ listing }: { listing: { publish_to_dcmls?: boolean; dcmls_status?: string } }) => {
  if (!DCMLS_SETTINGS_UI_ENABLED && !isDcmlsHost()) return null;
  if (listing.publish_to_dcmls !== true || listing.dcmls_status !== "published") return null;
  return (
    <span
      className="absolute top-2 left-2 z-10 inline-flex items-center text-white text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full shadow-sm"
      style={{ backgroundColor: "#0E56F5" }}
    >
      DCMLS
    </span>
  );
};

export default DcmlsBadge;
