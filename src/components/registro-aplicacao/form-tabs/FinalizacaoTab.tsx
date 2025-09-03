
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { RegistroCarga } from "@/types/registroCargas";

interface FinalizacaoTabProps {
  form: UseFormReturn<RegistroAplicacaoSchema>;
  onPrevious: () => void;
  onClose: () => void;
  isLoading: boolean;
  registroCarga?: RegistroCarga | null;
}

const FinalizacaoTab: React.FC<FinalizacaoTabProps> = ({
  form,
  onPrevious,
  onClose,
  isLoading,
  registroCarga
}) => {
  const horaSaidaValue = form.watch("hora_saida_caminhao");
  const isHoraSaidaPreenchida = horaSaidaValue && horaSaidaValue.trim() !== '';

  return (
    <div className="space-y-4">
      {/* Indicador de Status da Finalização */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          {isHoraSaidaPreenchida ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          <h3 className="font-medium text-gray-900">
            Status da Finalização
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          {isHoraSaidaPreenchida 
            ? "✅ Aplicação pronta para finalização - Status será atualizado para 'Entregue' automaticamente"
            : "⚠️ Preencha a hora de saída do caminhão para finalizar a aplicação"
          }
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hora_saida_caminhao" className="flex items-center gap-2">
            Hora de Saída do Caminhão
            {isHoraSaidaPreenchida && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </Label>
          <Input
            id="hora_saida_caminhao"
            type="time"
            {...form.register("hora_saida_caminhao")}
            className={isHoraSaidaPreenchida ? "border-green-500" : ""}
          />
          <p className="text-xs text-gray-500">
            Esta hora será sincronizada automaticamente e finalizará a aplicação
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estaca_final">Estaca Final</Label>
          <Input
            id="estaca_final"
            type="number"
            {...form.register("estaca_final", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="anotacoes_apontador">Anotações do Apontador</Label>
        <Textarea
          id="anotacoes_apontador"
          placeholder="Observações sobre a aplicação..."
          {...form.register("anotacoes_apontador")}
          rows={4}
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-500 hover:bg-blue-600" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Salvando...
              </>
            ) : (
              "Salvar Apontamento"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FinalizacaoTab;
