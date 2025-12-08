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
  accentColor?: string;
}

export const TechCard = ({
  icon,
  title,
  description,
  metricValue,
  metricLabel,
  onClick,
  className,
  accentColor = "border-l-primary",
}: TechCardProps) => {
  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl border border-border p-6",
        "border-l-4",
        accentColor,
        "shadow-md",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-2 hover:shadow-xl",
        "hover:shadow-primary/20",
        "hover:border-primary/40",
        "cursor-pointer",
        "before:absolute before:inset-0 before:rounded-xl before:opacity-0",
        "before:bg-gradient-to-br before:from-primary/5 before:to-transparent",
        "before:transition-opacity before:duration-300",
        "hover:before:opacity-100",
        className
      )}
      onClick={onClick}
    >
      {/* Icon with animated background */}
      <div className="relative w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
        <div className="text-primary transition-transform duration-300 group-hover:scale-110">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2 transition-colors group-hover:text-primary">{title}</h3>

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
        className="group/btn text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto font-medium"
      >
        Open
        <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-300 group-hover/btn:translate-x-2" />
      </Button>
    </div>
  );
};
