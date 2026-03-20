
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number;
  onChange?: (value: number) => void;
}

const formatBRL = (num: number): string => {
  if (isNaN(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseBRL = (str: string): number => {
  if (!str) return 0;
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, placeholder = "0,00", ...props }, ref) => {
    const [display, setDisplay] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setDisplay(value && value !== 0 ? formatBRL(value) : "");
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d,]/g, "");
      // Allow only one comma
      const parts = raw.split(",");
      const sanitized = parts.length > 2
        ? parts[0] + "," + parts.slice(1).join("")
        : raw;
      setDisplay(sanitized);
      onChange?.(parseBRL(sanitized));
    };

    const handleFocus = () => {
      setIsFocused(true);
      if (value && value !== 0) {
        // Show raw value with comma for decimal
        setDisplay(value.toFixed(2).replace(".", ","));
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      const num = parseBRL(display);
      setDisplay(num === 0 ? "" : formatBRL(num));
      onChange?.(num);
      props.onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        className={cn("text-right", className)}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        inputMode="decimal"
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
