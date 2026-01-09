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
}

export const TechCard = ({
  icon,
  title,
  description,
  metricValue,
  metricLabel,
  onClick,
  className,
}: TechCardProps) => {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 cursor-pointer group",
        "border border-zinc-200",
        "shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        "transition hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)]",
        className
      )}
      style={{ background: '#FFFFFF' }}
      onClick={onClick}
    >
      {/* Icon top-right - ALL icons blue (brand), no green */}
      <div className="absolute top-5 right-5">
        <span className="h-7 w-7 text-blue-500">{icon}</span>
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

      {/* CTA pill button - black + green */}
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-sm transition hover:bg-zinc-800">
        Open
        <ArrowRight className="h-4 w-4 text-emerald-300" />
      </span>
    </div>
  );
};
