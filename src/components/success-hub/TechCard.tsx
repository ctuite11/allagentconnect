import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

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
        "relative rounded-3xl p-6 cursor-pointer group",
        "shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
        "hover:shadow-[0_14px_34px_rgba(0,0,0,0.10)] hover:-translate-y-1",
        "transition-all duration-200 ease-out",
        className
      )}
      style={{ background: '#FFFFFF' }}
      onClick={onClick}
    >
      {/* Icon top-right with subtle green radial fade */}
      <div className="absolute top-5 right-5">
        <div className="text-emerald-600">{icon}</div>
      </div>

      {/* Title - reduced top margin for better balance */}
      <h3 className="text-base font-semibold tracking-tight text-slate-900 mb-2 mt-6">{title}</h3>

      {/* Description */}
      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{description}</p>

      {/* Metric Pill - emerald accent */}
      {metricValue !== undefined && metricValue !== 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            {metricValue} {metricLabel}
          </span>
        </div>
      )}

      {/* CTA link - AAC green, motion only on hover */}
      <span className="text-sm font-medium text-emerald-600 inline-flex items-center">
        Open
        <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1" />
      </span>
    </div>
  );
};
