import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormattedInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  format?: "currency" | "number" | "percentage";
  decimals?: number;
}

const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
  ({ className, value, onChange, format = "number", decimals = 0, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format the display value
    const formatValue = (val: string): string => {
      if (!val) return "";
      
      // Remove all non-numeric characters except decimal point
      const numericValue = val.replace(/[^\d.]/g, "");
      
      // Parse to number
      const num = parseFloat(numericValue);
      if (isNaN(num)) return "";

      // Format based on type
      if (format === "currency") {
        return "$" + num.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      } else if (format === "percentage") {
        return num.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) + "%";
      } else {
        return num.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      }
    };

    // Update display value when value prop changes
    React.useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value, format, decimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Extract numeric value
      const numericValue = inputValue.replace(/[^\d.]/g, "");
      
      // Update the actual value (unformatted)
      onChange(numericValue);
      
      // Update display value (formatted)
      setDisplayValue(formatValue(numericValue));
    };

    const handleBlur = () => {
      // Reformat on blur to ensure proper formatting
      setDisplayValue(formatValue(value));
    };

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
      />
    );
  }
);

FormattedInput.displayName = "FormattedInput";

export { FormattedInput };
