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
}: MediaTabBarProps) {
  const variantFor = (tab: MediaTab) =>
    active === tab ? "default" : "outline";

  return (
    <div className={cn(propertyMediaTabsRow, className)}>
      <Button
        variant={variantFor("photos")}
        size="sm"
        onClick={() => onChange("photos")}
        className="rounded-full"
      >
        <Images className="w-4 h-4 mr-2" />
        Photos
      </Button>
      {hasVideo && (
        <Button
          variant={variantFor("video")}
          size="sm"
          onClick={() => onChange("video")}
          className="rounded-full"
        >
          <Video className="w-4 h-4 mr-2" />
          Video
        </Button>
      )}
      {hasTour && (
        <Button
          variant={variantFor("tour")}
          size="sm"
          onClick={() => onChange("tour")}
          className="rounded-full"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          3D Tour
        </Button>
      )}
      {hasWebsite && (
        <Button
          variant={variantFor("website")}
          size="sm"
          onClick={() => onChange("website")}
          className="rounded-full"
        >
          <Globe className="w-4 h-4 mr-2" />
          Website
        </Button>
      )}
      {trailing}
    </div>
  );
}

export default MediaTabBar;
