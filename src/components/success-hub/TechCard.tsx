import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
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
        "group relative bg-card rounded-[10px] border border-border p-6",
        "shadow-custom-md hover:shadow-custom-lg",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-primary/50",
        "hover:shadow-[0_0_20px_hsl(var(--electric-blue)/0.3)]",
        "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <div className="text-primary">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {description}
      </p>

      {/* Metric Pill */}
      {metricValue !== undefined && (
        <div className="mb-4">
          <Pill 
            label={metricLabel ? `${metricValue} ${metricLabel}` : String(metricValue)}
            variant="primary"
            size="sm"
          />
        </div>
      )}

      {/* CTA Button */}
      <Button
        variant="ghost"
        size="sm"
        className="group/btn text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto font-medium"
      >
        Open
        <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
      </Button>
    </div>
  );
};
