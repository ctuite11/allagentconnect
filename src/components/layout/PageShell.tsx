import React from "react";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * AAC page wrapper:
 * - ensures consistent top padding under fixed nav (pt-20 = 80px)
 * - enforces consistent horizontal gutters
 * - prevents per-page pt-* drift
 */
export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main className={`pt-6 px-6 pb-6 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}

export default PageShell;
