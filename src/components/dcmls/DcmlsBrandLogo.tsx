import React from "react";
import { Link } from "react-router-dom";
import AACMonogram from "@/components/ui/AACMonogram";
import { cn } from "@/lib/utils";

type DcmlsBrandLogoProps = {
  /** `onDark` = white wordmark (hero). `onLight` = dark wordmark (footer). */
  variant?: "onDark" | "onLight";
  /** Hero lockup is ~18% larger than the default footer lockup. */
  size?: "default" | "hero";
  className?: string;
  monogramClassName?: string;
};

/** Blue AAC monogram + Manrope “Direct Connect MLS” wordmark. */
const DcmlsBrandLogo: React.FC<DcmlsBrandLogoProps> = ({
  variant = "onLight",
  size = "default",
  className,
  monogramClassName,
}) => {
  const onDark = variant === "onDark";
  const hero = size === "hero";

  return (
    <Link
      to="/"
      className={cn("inline-flex items-center", hero ? "gap-3" : "gap-2.5", className)}
      aria-label="Direct Connect MLS home"
    >
      <AACMonogram
        className={cn(
          "shrink-0 text-[#0E56F5]",
          monogramClassName ?? (hero ? "h-10 w-10 sm:h-11 sm:w-11" : "h-8 w-8"),
        )}
      />
      <span
        className={cn(
          "font-['Manrope'] font-bold tracking-[-0.02em]",
          hero ? "text-[18px] sm:text-[20px]" : "text-[15px] sm:text-[17px]",
          onDark ? "text-white" : "text-neutral-950",
        )}
      >
        Direct Connect MLS
      </span>
    </Link>
  );
};

export default DcmlsBrandLogo;
