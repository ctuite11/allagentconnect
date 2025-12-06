import { LucideIcon } from "lucide-react";
import { Pill, PillVariant } from "@/components/ui/pill";

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
  // Map old variant names to new Pill variants
  const variantMap: Record<string, PillVariant> = {
    default: "neutral",
    primary: "primary",
    success: "success",
    muted: "neutral",
  };

  return (
    <Pill
      label={`${value} ${label}`}
      variant={variantMap[variant] || "neutral"}
      iconLeft={Icon ? <Icon className="w-3.5 h-3.5" /> : undefined}
    />
  );
};
