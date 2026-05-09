import { isToday, isYesterday, format } from "date-fns";

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  let label: string;
  if (isToday(date)) label = "Today";
  else if (isYesterday(date)) label = "Yesterday";
  else label = format(date, "MMMM d, yyyy");

  return (
    <div className="mx-auto my-3 flex w-full max-w-[520px] items-center gap-3">
      <div className="h-px flex-1 bg-neutral-200/90" />
      <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="h-px flex-1 bg-neutral-200/90" />
    </div>
  );
}
