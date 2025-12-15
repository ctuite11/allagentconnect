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
        "aac-card aac-card-1 group relative cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Icon with muted background */}
      <div className="relative w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 transition-all duration-200 group-hover:bg-muted/80">
        <div className="text-muted-foreground">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {description}
      </p>

      {/* Metric Pill */}
      {metricValue !== undefined && metricValue !== 0 && (
        <div className="mb-4">
          <Pill 
            label={metricLabel ? `${metricValue} ${metricLabel}` : String(metricValue)}
            variant="primary"
            size="sm"
          />
        </div>
      )}

      {/* CTA Button with arrow animation */}
      <Button
        variant="ghost"
        size="sm"
        className="group/btn text-primary hover:text-primary hover:bg-muted p-0 h-auto font-medium"
      >
        Open
        <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-300 group-hover/btn:translate-x-2" />
      </Button>
    </div>
  );
};
