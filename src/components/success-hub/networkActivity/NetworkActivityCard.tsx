import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";

type NetworkActivityCardProps = {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

const cardShell =
  "flex min-h-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md";

export function NetworkActivityCard({
  title,
  description,
  icon,
  action,
  className,
  children,
}: NetworkActivityCardProps) {
  return (
    <article className={cn(cardShell, className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn(agentSectionTitle, "flex items-center gap-2 text-[15px]")}>
            {icon}
            {title}
          </h3>
          {description ? (
            <p className={cn(agentSectionDesc, "mt-0.5 text-xs")}>{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 flex-none">{action}</div> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}
