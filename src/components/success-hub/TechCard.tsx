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
      style={{
        background: `linear-gradient(270deg, rgba(22,163,74,0.02) 0%, rgba(22,163,74,0.01) 35%, rgba(255,255,255,0) 70%), #FFFFFF`
      }}
      onClick={onClick}
    >
      {/* Icon top-right with subtle green radial fade */}
      <div className="absolute top-5 right-5">
        <div 
          className="relative h-10 w-10 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(111, 184, 63, 0.05) 0%, transparent 70%)'
          }}
        >
          <div className="text-emerald-600">{icon}</div>
        </div>
      </div>

      {/* Title - add top margin to account for icon position */}
      <h3 className="text-base font-semibold tracking-tight text-slate-900 mb-2 mt-8">{title}</h3>

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

      {/* CTA link - slate to emerald on hover */}
      <span className="text-sm font-medium text-slate-700 inline-flex items-center group-hover:text-emerald-600 transition-colors duration-200">
        Open
        <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1" />
      </span>
    </div>
  );
};
