import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimePicker12hProps {
  value: string; // 24-hour format "HH:mm" for internal storage
  onChange: (value: string) => void;
  placeholder?: string;
}

// Generate all 96 time slots (24 hours × 4 intervals)
const timeSlots: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of ["00", "15", "30", "45"]) {
    const hour24 = `${h.toString().padStart(2, "0")}:${m}`;
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const period = h < 12 ? "AM" : "PM";
    const label = `${displayHour}:${m} ${period}`;
    timeSlots.push({ value: hour24, label });
  }
}

// Convert 24-hour time to display label
function getDisplayLabel(time24: string): string | undefined {
  const slot = timeSlots.find((s) => s.value === time24);
  return slot?.label;
}

export function TimePicker12h({ value, onChange, placeholder = "Select time" }: TimePicker12hProps) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="w-[130px] bg-white border-neutral-200">
        <SelectValue placeholder={placeholder}>
          {value ? getDisplayLabel(value) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-background z-50 max-h-[280px]">
        {timeSlots.map((slot) => (
          <SelectItem key={slot.value} value={slot.value}>
            {slot.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
