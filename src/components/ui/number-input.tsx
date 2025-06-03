
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number;
  onChange?: (value: number) => void;
  decimalPlaces?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimalPlaces = 0, placeholder, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Format number with thousand separators - only when not typing
    const formatNumber = (num: number): string => {
      if (isNaN(num) || num === 0) return "";
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      });
    };

    // Parse formatted string back to number
    const parseNumber = (str: string): number => {
      if (!str) return 0;
      // Remove thousand separators and convert decimal comma to dot
      const cleaned = str.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Update display value when external value changes
    useEffect(() => {
      if (value !== undefined && !isTyping) {
        setDisplayValue(value === 0 ? "" : formatNumber(value));
      }
    }, [value, decimalPlaces, isTyping]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setIsTyping(true);
      
      // Allow only numbers and decimal separators during typing
      const filteredValue = inputValue.replace(/[^\d,]/g, '');
      
      // Show raw input while typing (no formatting)
      setDisplayValue(filteredValue);
      
      // Parse and send numeric value to parent
      const numericValue = parseNumber(filteredValue);
      if (onChange) {
        onChange(numericValue);
      }
    };

    const handleFocus = () => {
      setIsTyping(true);
      // Show raw number when focused for easier editing
      if (value && value > 0) {
        setDisplayValue(value.toString());
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsTyping(false);
      
      // Format the number when user leaves the field
      const numericValue = parseNumber(displayValue);
      const formattedValue = numericValue === 0 ? "" : formatNumber(numericValue);
      setDisplayValue(formattedValue);
      
      if (props.onBlur) {
        props.onBlur(e);
      }
    };

    return (
      <Input
        ref={ref}
        className={cn("text-right", className)}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || "26750"}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
