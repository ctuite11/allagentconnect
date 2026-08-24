import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Content column for pages under `DeveloperShell`.
 * Must stay in sync with the header: `max-w-6xl` + `px-4 sm:px-6`.
 */
export const DEVELOPER_PORTAL_COLUMN =
  "mx-auto w-full max-w-6xl px-4 sm:px-6";

type DeveloperPortalPageProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

/** Page body aligned to the Developer Portal header grid. */
export function DeveloperPortalPage({ children, className, ...rest }: DeveloperPortalPageProps) {
  return (
    <main className={cn(DEVELOPER_PORTAL_COLUMN, "bg-white pb-12 pt-8 sm:pt-10", "space-y-5", className)} {...rest}>
      {children}
    </main>
  );
}
