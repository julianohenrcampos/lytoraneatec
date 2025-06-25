
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Scale } from "lucide-react";

interface WeightInputProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  isRetorno?: boolean;
}

const WeightInput: React.FC<WeightInputProps> = ({
  form,
  name,
  label,
  isRetorno = false,
}) => {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            {label}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder={isRetorno ? "Ex: 2.540" : "Ex: 28.750"}
              {...field}
              onChange={(e) => {
                // Store the value directly as entered (in tons)
                const value = e.target.value;
                field.onChange(value ? Number(value) : '');
              }}
            />
          </FormControl>
          <FormMessage />
          <p className="text-xs text-muted-foreground">
            {isRetorno 
              ? "Peso do caminhão vazio (opcional)" 
              : "Peso total do caminhão carregado"}
          </p>
        </FormItem>
      )}
    />
  );
};

export default WeightInput;
