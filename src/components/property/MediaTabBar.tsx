import type { ReactNode } from "react";
import { Images, Video, Maximize2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { propertyMediaTabsRow } from "./propertyTokens";

export type MediaTab = "photos" | "video" | "tour" | "website";

export interface MediaTabBarProps {
  active: MediaTab;
  onChange: (tab: MediaTab) => void;
  hasVideo?: boolean;
  hasTour?: boolean;
  hasWebsite?: boolean;
  /**
   * If true, "3D Tour" and "Website" act as outbound links via onChange
   * (parent decides). If false, they only become tabs when active.
   */
  className?: string;
  /** Renders after Photos / Video / 3D Tour / Website (e.g. share control) */
  trailing?: ReactNode;
  /** Consumer-style tabs: neutral active state (no primary blue) */
  neutralTone?: boolean;
}

/**
 * Pill-style media tabs used below the hero image on both property pages.
 * Each tab only renders if the corresponding data exists.
 */
export function MediaTabBar({
  active,
  onChange,
  hasVideo,
  hasTour,
  hasWebsite,
  className,
  trailing,
  neutralTone = false,
}: MediaTabBarProps) {
  const variantFor = (tab: MediaTab) =>
    neutralTone ? "outline" : active === tab ? "default" : "outline";

  const toneTab = (tab: MediaTab) =>
    neutralTone
      ? cn(
          "rounded-full border-neutral-200 text-[13px] font-medium",
          active === tab
            ? "!border-neutral-900 !bg-neutral-900 !text-white hover:!bg-neutral-800"
            : "bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50",
        )
      : "rounded-full";

  return (
    <div className={cn(propertyMediaTabsRow, className)}>
      <Button
        variant={variantFor("photos")}
        size="sm"
        onClick={() => onChange("photos")}
        className={toneTab("photos")}
      >
        <Images className="mr-2 h-4 w-4" />
        Photos
      </Button>
      {hasVideo && (
        <Button
          variant={variantFor("video")}
          size="sm"
          onClick={() => onChange("video")}
          className={toneTab("video")}
        >
          <Video className="mr-2 h-4 w-4" />
          Video
        </Button>
      )}
      {hasTour && (
        <Button
          variant={variantFor("tour")}
          size="sm"
          onClick={() => onChange("tour")}
          className={toneTab("tour")}
        >
          <Maximize2 className="mr-2 h-4 w-4" />
          3D Tour
        </Button>
      )}
      {hasWebsite && (
        <Button
          variant={variantFor("website")}
          size="sm"
          onClick={() => onChange("website")}
          className={toneTab("website")}
        >
          <Globe className="mr-2 h-4 w-4" />
          Website
        </Button>
      )}
      {trailing}
    </div>
  );
}

export default MediaTabBar;
