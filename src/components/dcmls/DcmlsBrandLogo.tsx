import React from "react";
import { Link } from "react-router-dom";
import AACMonogram from "@/components/ui/AACMonogram";
import { cn } from "@/lib/utils";

type DcmlsBrandLogoProps = {
  /** `onDark` = white wordmark (hero). `onLight` = dark wordmark (footer). */
  variant?: "onDark" | "onLight";
  className?: string;
  monogramClassName?: string;
};

/** Blue AAC monogram + Manrope “Direct Connect MLS” wordmark. */
const DcmlsBrandLogo: React.FC<DcmlsBrandLogoProps> = ({
  variant = "onLight",
  className,
  monogramClassName = "h-8 w-8",
}) => {
  const onDark = variant === "onDark";

  return (
    <Link
      to="/"
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Direct Connect MLS home"
    >
      <AACMonogram className={cn(monogramClassName, "shrink-0 text-[#0E56F5]")} />
      <span
        className={cn(
          "font-['Manrope'] text-[15px] font-bold tracking-[-0.02em] sm:text-[17px]",
          onDark ? "text-white" : "text-neutral-950",
        )}
      >
        Direct Connect MLS
      </span>
    </Link>
  );
};

export default DcmlsBrandLogo;
