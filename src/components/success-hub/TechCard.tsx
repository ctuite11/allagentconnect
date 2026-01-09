import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { aacStyles } from "@/ui/aacStyles";

interface TechCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  metricValue?: string | number;
  metricLabel?: string;
  onClick: () => void;
  className?: string;
  iconTone?: "green" | "blue";
}

export const TechCard = ({
  icon,
  title,
  description,
  metricValue,
  metricLabel,
  onClick,
  className,
  iconTone = "green",
}: TechCardProps) => {
  const toneClass = iconTone === "blue" ? "text-blue-600" : "text-emerald-600";
  
  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 cursor-pointer group",
        "border border-zinc-200 hover:border-zinc-300",
        "shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        "hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)]",
        "transition-shadow transition-colors duration-200 ease-out",
        className
      )}
      style={{ background: '#FFFFFF' }}
      onClick={onClick}
    >
      {/* Icon top-right - section anchor, not utility glyph */}
      <div className="absolute top-5 right-5">
        <span className={cn("h-7 w-7", toneClass)}>{icon}</span>
      </div>

      {/* Title - uses aacStyles.cardTitle */}
      <h3 className={cn("text-base font-bold tracking-tight mb-2 mt-6", aacStyles.cardTitle)}>{title}</h3>

      {/* Description - uses aacStyles.cardDesc */}
      <p className={cn("mb-4 line-clamp-2", aacStyles.cardDesc)}>{description}</p>

      {/* Metric Pill - emerald accent */}
      {metricValue !== undefined && metricValue !== 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            {metricValue} {metricLabel}
          </span>
        </div>
      )}

      {/* CTA link - black authority + green arrow */}
      <span className="group/cta inline-flex items-center gap-1.5 text-sm font-semibold text-black transition-colors hover:text-emerald-600">
        Open
        <ArrowRight className="w-4 h-4 text-emerald-500 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
      </span>
    </div>
  );
};
