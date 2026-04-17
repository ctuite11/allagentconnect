import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { propertySectionCard } from "./propertyTokens";

interface SectionWrapperProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional right-side action (e.g. "View all") */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Standard editorial section card used in the body of both property pages.
 * Provides shared border-radius, header rhythm and typography hierarchy.
 */
export function SectionWrapper({
  title,
  icon,
  action,
  children,
  className,
  contentClassName,
}: SectionWrapperProps) {
  return (
    <Card className={cn(propertySectionCard, className)}>
      {title && (
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
          {action}
        </CardHeader>
      )}
      <CardContent
        className={cn(
          "text-sm leading-relaxed text-foreground",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

export default SectionWrapper;
