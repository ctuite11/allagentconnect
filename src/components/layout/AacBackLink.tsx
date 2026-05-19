import * as React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** AAC standard back control: arrow + “Back” only (no destination in label). */
export const aacBackLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2";

/** @deprecated Use {@link aacBackLinkClass} with arrow + “Back” label. */
export const aacBackIconButtonClass = aacBackLinkClass;

export type AacBackLinkProps = Omit<LinkProps, "className" | "children"> & {
  className?: string;
  showIcon?: boolean;
};

export function AacBackLink({ className, showIcon = true, ...props }: AacBackLinkProps) {
  return (
    <Link
      className={cn(aacBackLinkClass, className)}
      aria-label={props["aria-label"] ?? "Go back"}
      {...props}
    >
      {showIcon ? <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} /> : null}
      Back
    </Link>
  );
}

export type AacBackButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  showIcon?: boolean;
};

export function AacBackButton({
  className,
  showIcon = true,
  type = "button",
  ...props
}: AacBackButtonProps) {
  return (
    <button
      type={type}
      className={cn(aacBackLinkClass, className)}
      aria-label={props["aria-label"] ?? "Go back"}
      {...props}
    >
      {showIcon ? <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} /> : null}
      Back
    </button>
  );
}
