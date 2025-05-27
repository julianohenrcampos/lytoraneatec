
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BordoType } from "@/types/registroAplicacao";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { RegistroCarga } from "@/types/registroCargas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

interface DadosTecnicosTabProps {
  form: UseFormReturn<RegistroAplicacaoSchema>;
  onNext: () => void;
  onPrevious: () => void;
  calculatedArea: number | string | null;
  calculatedEspessura: number | string | null;
  calculatedToneladaAplicada: number | string | null;
  calculatedEspessuraCalculada: number | string | null;
  espessuraStatusClass: string;
  espessuraCalculadaStatusClass: string;
  registroCarga?: RegistroCarga | null;
  exceededAvailableMass?: boolean;
}

const DadosTecnicosTab: React.FC<DadosTecnicosTabProps> = ({
  form,
  onNext,
  onPrevious,
  calculatedArea,
  calculatedEspessura,
  calculatedToneladaAplicada,
  calculatedEspessuraCalculada,
  espessuraStatusClass,
  espessuraCalculadaStatusClass,
  registroCarga,
  exceededAvailableMass
}) => {
  // Helper function to safely format number values with proper decimal places
  const formatValue = (value: number | string | null): string => {
    if (value === null) return "";
    
    if (typeof value === 'number') {
      return value.toFixed(3);
    }
    
    // Try to convert string to number and format it
    const numValue = parseFloat(value);
    return isNaN(numValue) ? String(value) : numValue.toFixed(3);
  };

  // Format values in the format "X.X t" for toneladas display
  const formatToneladas = (value: number | string | null): string => {
    if (value === null) return "";
    
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) return String(value);
    
    // Format with 1 decimal place for toneladas
    return `${numValue.toFixed(1)}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hora_aplicacao">Hora da Aplicação</Label>
          <Input
            id="hora_aplicacao"
            type="time"
            {...form.register("hora_aplicacao")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temperatura_aplicacao">Temperatura da Aplicação (°C)</Label>
          <Input
            id="temperatura_aplicacao"
            type="number"
            {...form.register("temperatura_aplicacao", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bordo">Bordo</Label>
          <Select
            onValueChange={(value) => form.setValue("bordo", value as BordoType)}
            value={form.watch("bordo")}
          >
            <SelectTrigger id="bordo">
              <SelectValue placeholder="Selecione um bordo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Direito">Direito</SelectItem>
              <SelectItem value="Esquerdo">Esquerdo</SelectItem>
              <SelectItem value="Centro">Centro</SelectItem>
              <SelectItem value="Único">Único</SelectItem>
              <SelectItem value="Embocadura">Embocadura</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estaca_inicial">Estaca Inicial</Label>
          <Input
            id="estaca_inicial"
            type="number"
            {...form.register("estaca_inicial", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comprimento">Comprimento (m)</Label>
          <Input
            id="comprimento"
            type="number"
            {...form.register("comprimento", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="largura_media">Largura Média (m)</Label>
          <Input
            id="largura_media"
            type="number"
            {...form.register("largura_media", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label>Área Calculada (m²)</Label>
          <Input
            type="text"
            value={formatValue(calculatedArea)}
            disabled
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="tonelada_aplicada" className="mr-2">Tonelada Aplicada (t)</Label>
            {exceededAvailableMass && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      O valor calculado excedeu a quantidade disponível e foi ajustado ao máximo permitido
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Input
            id="tonelada_aplicada"
            type="text"
            value={formatToneladas(calculatedToneladaAplicada)}
            className={exceededAvailableMass ? "border-amber-500 bg-amber-50" : ""}
            disabled
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Anterior
        </Button>
        <Button type="button" onClick={onNext}>
          Próximo
        </Button>
      </div>
    </div>
  );
};

export default DadosTecnicosTab;
