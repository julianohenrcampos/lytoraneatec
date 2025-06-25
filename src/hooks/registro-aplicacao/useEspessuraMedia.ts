
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

    // Primeira tentativa: usar espessura_aplicada salva no banco (converter metros para centímetros)
    const aplicacoesComEspessuraSalva = aplicacoes.filter(app => 
      app.espessura_aplicada && app.espessura_aplicada > 0
    );

    let espessuraMediaCm = 0;
    let numeroAplicacoesUsadas = 0;

    if (aplicacoesComEspessuraSalva.length > 0) {
      console.log("📏 useEspessuraMedia: Usando espessura_aplicada salva (convertendo m → cm)");
      const somaEspessuras = aplicacoesComEspessuraSalva.reduce(
        (soma, app) => {
          const espessuraCm = (app.espessura_aplicada || 0) * 100; // Converter metros para centímetros
          console.log(`📏 useEspessuraMedia: ${app.espessura_aplicada}m = ${espessuraCm}cm`);
          return soma + espessuraCm;
        }, 
        0
      );
      
      espessuraMediaCm = somaEspessuras / aplicacoesComEspessuraSalva.length;
      numeroAplicacoesUsadas = aplicacoesComEspessuraSalva.length;
    } else {
      // Segunda tentativa: calcular usando fórmula (tonelada / área / 2.4) * 100
      console.log("📏 useEspessuraMedia: Calculando espessura usando fórmula");
      const aplicacoesCalculaveis = aplicacoes.filter(app => 
        (app.tonelada_aplicada && app.tonelada_aplicada > 0) && 
        (app.area_aplicada && app.area_aplicada > 0)
      );

      if (aplicacoesCalculaveis.length > 0) {
        const somaEspessuras = aplicacoesCalculaveis.reduce(
          (soma, app) => {
            const espessuraCalculada = ((app.tonelada_aplicada || 0) / (app.area_aplicada || 0) / 2.4) * 100;
            console.log(`📏 useEspessuraMedia: Calculada: ${app.tonelada_aplicada}t / ${app.area_aplicada}m² / 2.4 = ${espessuraCalculada.toFixed(2)}cm`);
            return soma + espessuraCalculada;
          }, 
          0
        );
        
        espessuraMediaCm = somaEspessuras / aplicacoesCalculaveis.length;
        numeroAplicacoesUsadas = aplicacoesCalculaveis.length;
      } else {
        return {
          espessuraMedia: 0,
          numeroAplicacoes: aplicacoes.length,
          statusEspessura: null,
          descricaoStatus: "Dados insuficientes para calcular espessura"
        };
      }
    }

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

    console.log(`📏 useEspessuraMedia: Resultado final: ${espessuraMediaCm.toFixed(1)}cm (${numeroAplicacoesUsadas} aplicações)`);

    return {
      espessuraMedia: Number(espessuraMediaCm.toFixed(1)),
      numeroAplicacoes: numeroAplicacoesUsadas,
      statusEspessura,
      descricaoStatus
    };
  }, [aplicacoes]);
};
