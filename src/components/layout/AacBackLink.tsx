import * as React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** AAC standard back control: black text/icon, no underline, no hover. */
export const aacBackLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2";

/** Icon-only back control (e.g. beside a sticky page title). */
export const aacBackIconButtonClass =
  "inline-flex shrink-0 items-center justify-center text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2";

export type AacBackLinkProps = Omit<LinkProps, "className"> & {
  className?: string;
  children: React.ReactNode;
  showIcon?: boolean;
};

export function AacBackLink({ className, children, showIcon = true, ...props }: AacBackLinkProps) {
  return (
    <Link className={cn(aacBackLinkClass, className)} {...props}>
      {showIcon ? <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} /> : null}
      {children}
    </Link>
  );
}

export type AacBackButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  showIcon?: boolean;
};

export function AacBackButton({ className, children, showIcon = true, type = "button", ...props }: AacBackButtonProps) {
  return (
    <button type={type} className={cn(aacBackLinkClass, className)} {...props}>
      {showIcon ? <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} /> : null}
      {children}
    </button>
  );
}
