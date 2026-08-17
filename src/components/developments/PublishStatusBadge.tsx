import { Pill } from "@/components/ui/pill";
import { publishStatusLabel, publishStatusTone } from "@/lib/developments/publishStatus";

export function PublishStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = publishStatusTone(status);
  const variant =
    tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "muted" ? "outline" : "neutral";
  return <Pill label={publishStatusLabel(status)} variant={variant} size="sm" />;
}
