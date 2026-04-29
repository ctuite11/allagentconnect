import { useState } from "react";
import AACMonogram from "@/components/ui/AACMonogram";

/** Listing photo or AAC monogram — same behavior as the original `ClientDashboard` helper. */
export function DashboardListingImage({
  photoUrl,
  alt,
  imageClassName = "h-full w-full object-cover",
}: {
  photoUrl: string;
  alt: string;
  imageClassName?: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const useMonogram = !photoUrl || photoUrl === "/placeholder.svg" || loadFailed;
  if (useMonogram) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-[#0E56F5]" aria-hidden>
        <AACMonogram className="h-7 w-7" size={28} />
      </div>
    );
  }
  return (
    <img
      src={photoUrl}
      alt={alt}
      className={imageClassName}
      onError={() => setLoadFailed(true)}
    />
  );
}
