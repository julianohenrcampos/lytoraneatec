
import { useMemo } from "react";
import { RegistroAplicacaoDetalhes } from "@/types/registroAplicacaoDetalhes";

export interface EspessuraMediaInfo {
  espessuraMedia: number;
  numeroAplicacoes: number;
  statusEspessura: 'success' | 'warning' | 'error' | null;
  descricaoStatus: string;
}

export const useEspessuraMedia = (aplicacoes: RegistroAplicacaoDetalhes[]): EspessuraMediaInfo => {
  return useMemo(() => {
    if (!aplicacoes || aplicacoes.length === 0) {
      return {
        espessuraMedia: 0,
        numeroAplicacoes: 0,
        statusEspessura: null,
        descricaoStatus: "Nenhuma aplicação registrada"
      };
    }

    // Filtrar aplicações que têm espessura aplicada
    const aplicacoesComEspessura = aplicacoes.filter(app => 
      app.espessura_aplicada && app.espessura_aplicada > 0
    );

    if (aplicacoesComEspessura.length === 0) {
      return {
        espessuraMedia: 0,
        numeroAplicacoes: aplicacoes.length,
        statusEspessura: null,
        descricaoStatus: "Espessuras não informadas"
      };
    }

    // Calcular espessura média em centímetros
    const somaEspessuras = aplicacoesComEspessura.reduce(
      (soma, app) => soma + (app.espessura_aplicada || 0), 
      0
    );
    
    const espessuraMediaMetros = somaEspessuras / aplicacoesComEspessura.length;
    const espessuraMediaCm = espessuraMediaMetros * 100; // Converter para centímetros

    // Determinar status baseado na espessura média
    let statusEspessura: 'success' | 'warning' | 'error';
    let descricaoStatus: string;

    if (espessuraMediaCm >= 3 && espessuraMediaCm <= 8) {
      statusEspessura = 'success';
      descricaoStatus = "Dentro do padrão técnico";
    } else if (espessuraMediaCm >= 2 && espessuraMediaCm < 3) {
      statusEspessura = 'warning';
      descricaoStatus = "Abaixo do recomendado";
    } else if (espessuraMediaCm > 8 && espessuraMediaCm <= 10) {
      statusEspessura = 'warning';
      descricaoStatus = "Acima do recomendado";
    } else {
      statusEspessura = 'error';
      descricaoStatus = "Fora do padrão técnico";
    }

    return {
      espessuraMedia: Number(espessuraMediaCm.toFixed(1)),
      numeroAplicacoes: aplicacoesComEspessura.length,
      statusEspessura,
      descricaoStatus
    };
  }, [aplicacoes]);
};
