import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormattedInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  format?: "currency" | "number" | "percentage" | "phone";
  decimals?: number;
}

const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
  ({ className, value, onChange, format = "number", decimals = 0, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format the display value
    const formatValue = (val: string): string => {
      if (!val) return "";
      
      // Phone number formatting
      if (format === "phone") {
        const numericValue = val.replace(/\D/g, "");
        if (numericValue.length === 0) return "";
        
        if (numericValue.length <= 3) {
          return `(${numericValue}`;
        } else if (numericValue.length <= 6) {
          return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
        } else {
          return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
        }
      }
      
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
      
      // Extract numeric value (for phone, remove all non-digits)
      const numericValue = format === "phone" 
        ? inputValue.replace(/\D/g, "")
        : inputValue.replace(/[^\d.]/g, "");
      
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
