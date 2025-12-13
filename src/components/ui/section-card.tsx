import * as React from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  description?: string;
};

export function SectionCard({
  title,
  icon,
  rightSlot,
  description,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <section
      className={cn(
        // surface
        "rounded-2xl bg-background",
        // border + structure
        "border border-border border-l-[6px] border-l-primary",
        // density
        "p-4",
        className
      )}
      {...props}
    >
      {(title || rightSlot || description) ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <div className="flex items-center gap-2">
                {icon ? (
                  <span className="text-primary [&_svg]:h-4 [&_svg]:w-4">
                    {icon}
                  </span>
                ) : null}
                <h3 className="text-sm font-semibold tracking-wide text-foreground">
                  {title}
                </h3>
              </div>
            ) : null}

            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </header>
      ) : null}

      {children}
    </section>
  );
}
