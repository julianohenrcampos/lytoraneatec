
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
  // Função para validar se é um número válido
  const isValidNumber = (value: any): boolean => {
    return value !== null && value !== undefined && !isNaN(Number(value)) && Number(value) > 0;
  };

  // Função para converter kg para toneladas com validação
  const handleWeightChange = (value: string, onChange: (value: number | null) => void) => {
    console.log("WeightInput - Input recebido:", value);
    
    if (!value || value.trim() === "") {
      console.log("WeightInput - Valor vazio, definindo como null/0");
      onChange(isRetorno ? null : 0);
      return;
    }

    // Remove caracteres não numéricos exceto ponto e vírgula
    const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    
    if (cleanValue === "") {
      onChange(isRetorno ? null : 0);
      return;
    }

    const kgValue = parseFloat(cleanValue);
    
    if (isNaN(kgValue) || kgValue < 0) {
      console.warn("WeightInput - Valor inválido:", cleanValue);
      onChange(isRetorno ? null : 0);
      return;
    }

    // Converte kg para toneladas (divide por 1000)
    const toneladaValue = kgValue / 1000;
    console.log("WeightInput - Convertendo:", kgValue, "kg para", toneladaValue, "toneladas");
    onChange(toneladaValue);
  };

  // Função para formatar o valor de exibição com validação - campo sempre limpo para Saída(t)
  const formatDisplayValue = (value: any): string => {
    // Para o campo de saída, sempre iniciar limpo
    if (name === "tonelada_saida" && (!value || value === 0)) {
      return '';
    }

    if (!isValidNumber(value)) {
      return '';
    }

    try {
      const numValue = Number(value);
      if (isNaN(numValue)) return '';
      
      // Converte toneladas para kg para exibição
      const kgValue = numValue * 1000;
      return kgValue.toString();
    } catch (error) {
      console.error("WeightInput - Erro ao formatar valor:", error);
      return '';
    }
  };

  // Função para formatar texto de conversão com validação - formato 1 casa decimal
  const formatConversionText = (value: any): string => {
    if (!isValidNumber(value)) {
      return 'Digite o peso em kg para converter automaticamente';
    }

    try {
      const numValue = Number(value);
      if (isNaN(numValue)) return 'Valor inválido';
      
      // Formato correto: 1 casa decimal
      return `Convertido: ${numValue.toFixed(1)} toneladas`;
    } catch (error) {
      console.error("WeightInput - Erro ao formatar texto de conversão:", error);
      return 'Erro na conversão';
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
              min="0"
              placeholder={placeholder}
              onChange={(e) => handleWeightChange(e.target.value, field.onChange)}
              value={formatDisplayValue(field.value)}
            />
          </FormControl>
          <FormMessage />
          <p className="text-xs text-muted-foreground">
            {formatConversionText(field.value)}
          </p>
        </FormItem>
      )}
    />
  );
};

export default WeightInput;
