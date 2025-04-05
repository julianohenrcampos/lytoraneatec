
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

interface DadosTecnicosTabProps {
  form: UseFormReturn<RegistroAplicacaoSchema>;
  onNext: () => void;
  onPrevious: () => void;
  calculatedArea: number | null;
  calculatedEspessura: number | null;
  espessuraStatusClass: string;
}

const DadosTecnicosTab: React.FC<DadosTecnicosTabProps> = ({
  form,
  onNext,
  onPrevious,
  calculatedArea,
  calculatedEspessura,
  espessuraStatusClass,
}) => {
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
            value={calculatedArea ? calculatedArea.toFixed(2) : ""}
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label>Espessura Calculada (cm)</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={calculatedEspessura ? calculatedEspessura.toFixed(2) : ""}
              disabled
              className={calculatedEspessura ? espessuraStatusClass : ""}
            />
          </div>
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
