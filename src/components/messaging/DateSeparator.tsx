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
    <div className="mx-auto my-2 flex w-full max-w-[520px] items-center gap-3">
      <div className="h-px flex-1 bg-zinc-300" />
      <span className="whitespace-nowrap text-[12px] font-medium text-zinc-500">{label}</span>
      <div className="h-px flex-1 bg-zinc-300" />
    </div>
  );
}
