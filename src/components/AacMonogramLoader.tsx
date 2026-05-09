import AACMonogram from "@/components/ui/AACMonogram";
import { cn } from "@/lib/utils";

export type AacMonogramLoaderProps = {
  /** Shown below the monogram unless `hideMessage` */
  message?: string;
  hideMessage?: boolean;
  className?: string;
  /** Monogram Tailwind classes (defaults to neutral for white / light gray backgrounds) */
  monogramClassName?: string;
  variant?: "fullscreen" | "section" | "inline";
};

/**
 * AAC command-square monogram with a slow opacity pulse (no spin, no house mark).
 * Use for full-page and major-section loading; keep button-level UI on `Loader2` when tiny.
 */
export function AacMonogramLoader({
  message = "Loading...",
  hideMessage = false,
  className,
  monogramClassName,
  variant = "section",
}: AacMonogramLoaderProps) {
  const root =
    variant === "fullscreen"
      ? "flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4"
      : variant === "section"
        ? "flex min-h-[36vh] flex-col items-center justify-center gap-3 py-10 px-4 sm:min-h-[40vh]"
        : "inline-flex flex-col items-center justify-center gap-2";

  return (
    <div
      className={cn(root, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-aac-monogram-breathe text-neutral-800">
        <AACMonogram className={cn("h-8 w-8 sm:h-9 sm:w-9", monogramClassName)} />
      </div>
      {!hideMessage && message ? (
        <p className="max-w-sm text-center text-sm text-neutral-500">{message}</p>
      ) : null}
    </div>
  );
}

export default AacMonogramLoader;
