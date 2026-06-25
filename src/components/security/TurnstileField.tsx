import type { RefObject } from "react";
import { cn } from "@/lib/utils";

type TurnstileFieldProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  error?: string | null;
  className?: string;
};

/** Managed-mode Cloudflare Turnstile widget container + validation message. */
export function TurnstileField({ containerRef, error, className }: TurnstileFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div ref={containerRef} className="min-h-[65px] w-full" aria-label="Security verification" />
      {error ? (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
