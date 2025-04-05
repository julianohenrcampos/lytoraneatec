
import React from "react";
import { Label } from "@/components/ui/label";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";

interface EntregaSummaryProps {
  entrega: ListaProgramacaoEntrega;
  calculatedEspessura: number | null;
  espessuraStatusClass: string;
  getEspessuraStatusText: () => string;
}

const EntregaSummary: React.FC<EntregaSummaryProps> = ({
  entrega,
  calculatedEspessura,
  espessuraStatusClass,
  getEspessuraStatusText,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <Label className="font-medium">Logradouro:</Label>
        <p>{entrega.logradouro}</p>
      </div>
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
        <p>{entrega.quantidade_massa} toneladas</p>
      </div>
      <div>
        <Label className="font-medium">Lançamento:</Label>
        <p>{entrega.tipo_lancamento}</p>
      </div>
      <div>
        <Label className="font-medium">Status Espessura:</Label>
        <p className={espessuraStatusClass}>
          {calculatedEspessura ? (
            <>
              {getEspessuraStatusText()} ({calculatedEspessura} cm)
            </>
          ) : (
            "Não calculado"
          )}
        </p>
      </div>
    </div>
  );
};

export default EntregaSummary;
