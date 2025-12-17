import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimePicker12hProps {
  value: string; // 24-hour format "HH:mm" for internal storage
  onChange: (value: string) => void;
  placeholder?: string;
}

// Convert 24-hour time to 12-hour format for display
function to12Hour(time24: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!time24) return { hour: "12", minute: "00", period: "AM" };
  
  const [hours, minutes] = time24.split(":");
  const hourNum = parseInt(hours, 10);
  const period: "AM" | "PM" = hourNum >= 12 ? "PM" : "AM";
  let displayHour = hourNum % 12;
  if (displayHour === 0) displayHour = 12;
  
  return {
    hour: displayHour.toString(),
    minute: minutes || "00",
    period,
  };
}

// Convert 12-hour format back to 24-hour for storage
function to24Hour(hour: string, minute: string, period: "AM" | "PM"): string {
  let hourNum = parseInt(hour, 10);
  
  if (period === "AM") {
    if (hourNum === 12) hourNum = 0;
  } else {
    if (hourNum !== 12) hourNum += 12;
  }
  
  return `${hourNum.toString().padStart(2, "0")}:${minute}`;
}

export function TimePicker12h({ value, onChange, placeholder = "Select time" }: TimePicker12hProps) {
  const { hour, minute, period } = to12Hour(value);

  const handleChange = (newHour: string, newMinute: string, newPeriod: "AM" | "PM") => {
    const time24 = to24Hour(newHour, newMinute, newPeriod);
    onChange(time24);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="flex gap-1.5 items-center">
      {/* Hour */}
      <Select
        value={value ? hour : ""}
        onValueChange={(h) => handleChange(h, minute, period)}
      >
        <SelectTrigger className="w-[70px] bg-white border-neutral-200">
          <SelectValue placeholder="Hr" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">:</span>

      {/* Minute */}
      <Select
        value={value ? minute : ""}
        onValueChange={(m) => handleChange(hour, m, period)}
      >
        <SelectTrigger className="w-[70px] bg-white border-neutral-200">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM/PM */}
      <Select
        value={value ? period : ""}
        onValueChange={(p) => handleChange(hour, minute, p as "AM" | "PM")}
      >
        <SelectTrigger className="w-[70px] bg-white border-neutral-200">
          <SelectValue placeholder="AM" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
