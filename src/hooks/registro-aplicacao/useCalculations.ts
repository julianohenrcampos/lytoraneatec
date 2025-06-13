
import { useMemo } from "react";
import { RegistroCarga } from "@/types/registroCargas";
import { EspessuraStatus } from "@/utils/aplicacaoCalculations";

/**
 * Hook customizado para lidar com cálculos no formulário de registro de aplicação
 */
export const useCalculations = (
  comprimento: number | null | undefined,
  largura: number | null | undefined,
  registroCarga: RegistroCarga | null,
  entregaMassaRemanescente?: number,
  usarMassaTotal?: boolean,
  massaRemanescenteCarga?: number // Nova propriedade para massa remanescente específica da carga
) => {
  // Calcular área
  const calculatedArea = useMemo(() => {
    if (!comprimento || !largura) return null;
    return comprimento * largura;
  }, [comprimento, largura]);

  // Calcular tonelada aplicada baseada na área calculada e massa disponível
  const calculatedToneladaAplicada = useMemo(() => {
    if (!calculatedArea || !registroCarga?.tonelada_real) return null;
    
    // Calcular baseado na área e densidade (assumindo densidade de 2.4 t/m³ e espessura de 5cm)
    const calculatedTonelada = calculatedArea * 0.05 * 2.4;
    
    // Usar o mínimo entre calculado e massa disponível
    // Priorizar massa remanescente da carga se disponível
    const massaDisponivel = massaRemanescenteCarga ?? entregaMassaRemanescente ?? registroCarga.tonelada_real;
    
    return Math.min(calculatedTonelada, massaDisponivel);
  }, [calculatedArea, registroCarga?.tonelada_real, entregaMassaRemanescente, massaRemanescenteCarga]);

  // Calcular espessura com lógica condicional - FÓRMULA CORRIGIDA
  const calculatedEspessura = useMemo(() => {
    if (!calculatedArea || !registroCarga?.tonelada_real) return null;
    
    if (usarMassaTotal) {
      // Quando checkbox marcado: usar massa remanescente da carga ou massa total
      const massaParaCalculo = massaRemanescenteCarga ?? registroCarga.tonelada_real;
      // Fórmula: espessura = (massa / área) / 2.4 / 1000 (para converter para metros)
      const espessura = (massaParaCalculo / calculatedArea) / 2.4;
      return Number(espessura.toFixed(3));
    } else {
      // Fórmula tradicional: (ToneladaAplicada / Area) / 2.4
      if (!calculatedToneladaAplicada) return null;
      const espessura = (calculatedToneladaAplicada / calculatedArea) / 2.4;
      return Number(espessura.toFixed(3));
    }
  }, [calculatedArea, calculatedToneladaAplicada, registroCarga?.tonelada_real, usarMassaTotal, massaRemanescenteCarga]);

  // Calcular massa remanescente após esta aplicação - FÓRMULA CORRIGIDA
  const massaRemanescente = useMemo(() => {
    if (!registroCarga?.tonelada_real || !calculatedToneladaAplicada) {
      return massaRemanescenteCarga ?? entregaMassaRemanescente ?? registroCarga?.tonelada_real ?? 0;
    }
    
    // Usar massa remanescente da carga se disponível, caso contrário usar massa total
    const massaAtual = massaRemanescenteCarga ?? entregaMassaRemanescente ?? registroCarga.tonelada_real;
    // Nova massa remanescente = massa atual - massa que será aplicada agora
    return Math.max(0, massaAtual - calculatedToneladaAplicada);
  }, [registroCarga?.tonelada_real, calculatedToneladaAplicada, entregaMassaRemanescente, massaRemanescenteCarga]);

  // Verificar se a massa aplicada excede a massa disponível
  const exceededAvailableMass = useMemo(() => {
    if (!calculatedToneladaAplicada || !registroCarga?.tonelada_real) return false;
    
    const massaDisponivel = massaRemanescenteCarga ?? entregaMassaRemanescente ?? registroCarga.tonelada_real;
    return calculatedToneladaAplicada > massaDisponivel;
  }, [calculatedToneladaAplicada, registroCarga?.tonelada_real, entregaMassaRemanescente, massaRemanescenteCarga]);

  // Status para espessura - lógica baseada no método de cálculo
  const espessuraStatus: EspessuraStatus = useMemo(() => {
    if (!calculatedEspessura) return null;
    
    if (usarMassaTotal) {
      // Nova lógica: < 0.035 cm ou > 0.05 cm → "Fora do Padrão" (error)
      // Entre 0.035 e 0.05, inclusive → "Dentro do Padrão" (success)
      if (calculatedEspessura < 0.035 || calculatedEspessura > 0.05) {
        return 'error';
      } else {
        return 'success';
      }
    } else {
      // Lógica original: < 0.03 cm → warning, > 0.08 cm → error, resto → success
      if (calculatedEspessura < 0.03) return 'warning';
      if (calculatedEspessura > 0.08) return 'error';
      return 'success';
    }
  }, [calculatedEspessura, usarMassaTotal]);

  return {
    calculatedArea,
    calculatedToneladaAplicada,
    calculatedEspessura,
    massaRemanescente,
    espessuraStatus,
    exceededAvailableMass
  };
};
