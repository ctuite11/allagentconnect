import { Briefcase, Upload, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const STAT_SHELL =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md";

function formatLastImport(iso: string | null): { display: string; hint: string } {
  if (!iso) {
    return { display: "—", hint: "No CSV import yet" };
  }
  const imported = new Date(iso);
  if (Number.isNaN(imported.getTime())) {
    return { display: "—", hint: "No CSV import yet" };
  }
  const now = new Date();
  const sameDay = imported.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = imported.toDateString() === yesterday.toDateString();

  let display: string;
  if (sameDay) display = "Today";
  else if (wasYesterday) display = "Yesterday";
  else {
    display = imported.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: imported.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  const time = imported.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { display, hint: sameDay ? `Imported ${time}` : "Last CSV import" };
}

export type MyContactsStatsStripProps = {
  totalContacts: number;
  buyerCount: number;
  agentCount: number;
  lastImportAt: string | null;
  activeTypeFilter?: string;
  onFilterAll?: () => void;
  onFilterBuyers?: () => void;
  onFilterAgents?: () => void;
  className?: string;
};

export function MyContactsStatsStrip({
  totalContacts,
  buyerCount,
  agentCount,
  lastImportAt,
  activeTypeFilter = "all",
  onFilterAll,
  onFilterBuyers,
  onFilterAgents,
  className,
}: MyContactsStatsStripProps) {
  const lastImport = formatLastImport(lastImportAt);

  const stats: Array<{
    key: string;
    label: string;
    value: string;
    hint: string;
    icon: typeof Users;
    iconClass: string;
    active: boolean;
    onClick?: () => void;
  }> = [
    {
      key: "total",
      label: "Total Contacts",
      value: String(totalContacts),
      hint: "In your roster",
      icon: Users,
      iconClass: "text-emerald-600",
      active: activeTypeFilter === "all",
      onClick: onFilterAll,
    },
    {
      key: "buyers",
      label: "Buyers",
      value: String(buyerCount),
      hint: buyerCount === 1 ? "Buyer contact" : "Buyer contacts",
      icon: UserRound,
      iconClass: "text-indigo-600",
      active: activeTypeFilter === "buyer",
      onClick: onFilterBuyers,
    },
    {
      key: "agents",
      label: "Agents",
      value: String(agentCount),
      hint: agentCount === 1 ? "Agent contact" : "Agent contacts",
      icon: Briefcase,
      iconClass: "text-sky-600",
      active: activeTypeFilter === "agent",
      onClick: onFilterAgents,
    },
    {
      key: "import",
      label: "Last Import",
      value: lastImport.display,
      hint: lastImport.hint,
      icon: Upload,
      iconClass: "text-neutral-500",
      active: false,
    },
  ];

  return (
    <section
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
      aria-label="Contact summary"
    >
      {stats.map(({ key, label, value, hint, icon: Icon, iconClass, active, onClick }) => {
        const interactive = Boolean(onClick);
        const Tag = interactive ? "button" : "div";
        return (
          <Tag
            key={key}
            type={interactive ? "button" : undefined}
            onClick={onClick}
            className={cn(
              STAT_SHELL,
              interactive && "cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2",
              active && "border-emerald-200/90 ring-1 ring-emerald-100",
            )}
          >
            <Icon className={cn("h-4 w-4", iconClass)} aria-hidden />
            <div className="mt-2 text-xl font-semibold tracking-tight text-neutral-900 tabular-nums">{value}</div>
            <div className="mt-0.5 text-sm font-medium text-neutral-500">{label}</div>
            <div className="mt-1 text-xs text-neutral-400">{hint}</div>
          </Tag>
        );
      })}
    </section>
  );
}

export const MY_CONTACTS_LAST_IMPORT_KEY = "aac:my-contacts:last-import";

export function readLastContactsImport(userId: string): string | null {
  try {
    return window.localStorage.getItem(`${MY_CONTACTS_LAST_IMPORT_KEY}:${userId}`);
  } catch {
    return null;
  }
}

export function writeLastContactsImport(userId: string, iso = new Date().toISOString()): void {
  try {
    window.localStorage.setItem(`${MY_CONTACTS_LAST_IMPORT_KEY}:${userId}`, iso);
  } catch {
    /* ignore quota / private mode */
  }
}
