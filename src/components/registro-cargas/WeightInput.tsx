
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";

interface WeightInputProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  placeholder?: string;
  isRetorno?: boolean;
}

const WeightInput: React.FC<WeightInputProps> = ({
  form,
  name,
  label,
  placeholder = "Digite o peso em kg",
  isRetorno = false,
}) => {
  // Função para converter kg para toneladas
  const handleWeightChange = (value: string, onChange: (value: number | null) => void) => {
    if (value) {
      const kgValue = parseFloat(value);
      if (!isNaN(kgValue)) {
        // Converte kg para toneladas (divide por 1000)
        const toneladaValue = kgValue / 1000;
        onChange(toneladaValue);
      }
    } else {
      onChange(isRetorno ? null : 0);
    }
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              step="1"
              placeholder={placeholder}
              onChange={(e) => handleWeightChange(e.target.value, field.onChange)}
              value={field.value ? (field.value * 1000).toString() : ''}
            />
          </FormControl>
          <FormMessage />
          <p className="text-xs text-muted-foreground">
            {field.value ? `Convertido: ${field.value.toFixed(3)} toneladas` : 'Digite o peso em kg para converter automaticamente'}
          </p>
        </FormItem>
      )}
    />
  );
};

export default WeightInput;
