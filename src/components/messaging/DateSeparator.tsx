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
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-zinc-300" />
      <span className="text-[12px] font-medium text-zinc-500 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-zinc-300" />
    </div>
  );
}
