import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SummaryPillProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  variant?: "default" | "primary" | "success" | "muted";
}

export const SummaryPill = ({
  icon: Icon,
  label,
  value,
  variant = "default",
}: SummaryPillProps) => {
  const variantClasses = {
    default: "bg-muted/50 text-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-accent/10 text-accent border-accent/20",
    muted: "bg-muted/30 text-muted-foreground border-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border",
        variantClasses[variant]
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="font-medium">{value}</span>
      <span className="text-xs opacity-75">{label}</span>
    </div>
  );
};
