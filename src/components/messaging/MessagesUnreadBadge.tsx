import { cn } from "@/lib/utils";

export function formatMessagesUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function hasUnreadMessages(count: number | null | undefined): count is number {
  return typeof count === "number" && count > 0;
}

type MessagesUnreadBadgeProps = {
  count: number | null | undefined;
  /** `overlay` — dot on a Messages icon; `inline` — nav row / sidebar pill */
  variant?: "overlay" | "inline";
  className?: string;
};

/**
 * Canonical unread badge for every Messages icon / nav entry in AAC.
 * Renders nothing when count is 0, null, or undefined.
 */
export function MessagesUnreadBadge({
  count,
  variant = "overlay",
  className,
}: MessagesUnreadBadgeProps) {
  if (!hasUnreadMessages(count)) return null;

  const label = formatMessagesUnreadCount(count);

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium leading-none text-primary-foreground",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm",
        className,
      )}
    >
      {label}
    </span>
  );
}
