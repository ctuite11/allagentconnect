import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { aacBackLinkClass } from "@/components/layout/AacBackLink";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional class names for the `<h1>` title (e.g. AAC premium scale) */
  titleClassName?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Optional class names for the subtitle paragraph */
  subtitleClassName?: string;
  /** 
   * Explicit parent route to navigate to on back click.
   * If provided, shows back button and navigates to this route.
   * If not provided, no back button is shown (root page behavior).
   */
  backTo?: string;
  /** Optional className for container */
  className?: string;
  /** Optional right-side actions */
  actions?: ReactNode;
  /** Optional icon to display before title */
  icon?: ReactNode;
  /** Softer/smaller back control for compact detail headers */
  compactBack?: boolean;
}

/**
 * Standardized page header with optional inline chevron-left back button.
 * 
 * Back Button Rules:
 * - Root pages (Success Hub, My Listings, Hot Sheets list, etc.): NO back button
 * - Child/Detail pages: Show inline chevron back to parent route
 * 
 * Navigation Behavior:
 * - Prefers explicit parent route navigation (backTo prop)
 * - Falls back to browser history if backTo not provided but back still needed
 */
export function PageHeader({ 
  title, 
  titleClassName,
  subtitle,
  subtitleClassName,
  backTo, 
  className,
  actions,
  icon,
  compactBack = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className={cn("flex items-center", compactBack ? "gap-1.5" : "gap-2")}>
        {/* Inline chevron-left back button - only shown when backTo is provided */}
        {backTo && (
          <button type="button" onClick={handleBack} className={cn(aacBackLinkClass, "-ml-1 shrink-0")}>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            Back
          </button>
        )}
        
        <div className="flex flex-col">
          <h1 className={cn(
            "text-xl font-semibold text-zinc-900 tracking-tight",
            titleClassName,
            icon && "flex items-center gap-3"
          )}>
            {icon}
            {title}
          </h1>
          {subtitle && (
            <p className={cn("text-sm mt-0.5 text-zinc-500", subtitleClassName)}>{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right-side actions */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}
