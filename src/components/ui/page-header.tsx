import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
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
  subtitle, 
  backTo, 
  className,
  actions,
  icon
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
    <div className={cn("flex items-center justify-between gap-4 mb-8", className)}>
      <div className="flex items-center gap-2">
        {/* Inline chevron-left back button - only shown when backTo is provided */}
        {backTo && (
          <button
            onClick={handleBack}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex flex-col">
          <h1 className={cn(
            "text-3xl font-semibold text-zinc-900 font-display tracking-tight",
            icon && "flex items-center gap-3"
          )}>
            {icon}
            {title}
          </h1>
          {subtitle && (
            <p className="text-zinc-500 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right-side actions */}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
