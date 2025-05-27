
import React from "react";
import { Label } from "@/components/ui/label";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { formatNumber } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface EntregaSummaryProps {
  entrega: ListaProgramacaoEntrega;
  calculatedEspessura?: number | string | null;
  calculatedEspessuraCalculada?: number | string | null;
  calculatedToneladaAplicada?: number | string | null;
  massaRemanescente?: number | string | null;
  espessuraStatusClass: string;
  espessuraCalculadaStatusClass?: string;
  getEspessuraStatusText: () => string;
  getEspessuraCalculadaStatusText?: () => string;
  logradouroAplicado?: string | null;
  registroCarga?: RegistroCarga | null;
  exceededAvailableMass?: boolean;
}

const EntregaSummary: React.FC<EntregaSummaryProps> = ({
  entrega,
  calculatedEspessura,
  calculatedEspessuraCalculada,
  calculatedToneladaAplicada,
  massaRemanescente,
  espessuraStatusClass,
  espessuraCalculadaStatusClass,
  getEspessuraStatusText,
  getEspessuraCalculadaStatusText,
  logradouroAplicado,
  registroCarga,
  exceededAvailableMass,
}) => {
  // Function to safely format values with proper decimal formatting
  const formatValue = (value: number | string | null): string => {
    if (value === null) return "Não calculado";
    
    if (typeof value === 'number') {
      // Format with proper decimal places
      return value.toFixed(3);
    }
    
    // Try to convert string to number and format it
    const numValue = parseFloat(value);
    return isNaN(numValue) ? String(value) : numValue.toFixed(3);
  };

  // Format values in the format "X.X t" for toneladas display
  const formatToneladas = (value: number | string | null): string => {
    if (value === null) return "Não calculado";
    
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) return String(value);
    
    // Format with 1 decimal place for toneladas
    return `${numValue.toFixed(1)} t`;
  };

  // Always use the registro carga tonelada_saida as the primary mass quantity if available
  const massQuantity = registroCarga ? registroCarga.tonelada_saida : entrega.quantidade_massa;

  return (
    <div className="space-y-4 mb-4">
      {exceededAvailableMass && (
        <Alert className="bg-amber-50 border-amber-300 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            A tonelada aplicada calculada excede a quantidade disponível. 
            O valor foi ajustado automaticamente para o máximo disponível.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="font-medium">Caminhão:</Label>
          <p>{entrega.caminhao ? `${entrega.caminhao.placa} - ${entrega.caminhao.modelo}` : "N/A"}</p>
        </div>
        <div>
          <Label className="font-medium">Equipe:</Label>
          <p>{entrega.equipe ? entrega.equipe.nome_equipe : "N/A"}</p>
        </div>
        <div>
          <Label className="font-medium">Qtd. Massa:</Label>
          <p>{massQuantity} toneladas</p>
        </div>
        <div>
          <Label className="font-medium">Lançamento:</Label>
          <p>{entrega.tipo_lancamento}</p>
        </div>

        {logradouroAplicado && (
          <div>
            <Label className="font-medium">Logradouro Aplicado:</Label>
            <p>{logradouroAplicado}</p>
          </div>
        )}

        {calculatedToneladaAplicada && (
          <div>
            <Label className="font-medium">Tonelada Aplicada:</Label>
            <p className={exceededAvailableMass ? "text-amber-600 font-medium" : ""}>
              {formatToneladas(calculatedToneladaAplicada)}
              {exceededAvailableMass && " (ajustado)"}
            </p>
          </div>
        )}

        {massaRemanescente !== null && massaRemanescente !== undefined && (
          <div>
            <Label className="font-medium">Massa Remanescente:</Label>
            <p className={parseFloat(String(massaRemanescente)) <= 0 ? "text-red-600" : "text-green-600"}>
              {formatToneladas(massaRemanescente)}
            </p>
          </div>
        )}

        <div>
          <Label className="font-medium">Status Espessura:</Label>
          <p className={espessuraStatusClass}>
            {calculatedEspessura ? (
              <>
                {getEspessuraStatusText()} ({formatValue(calculatedEspessura)} cm)
              </>
            ) : (
              "Não calculado"
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EntregaSummary;
