
import { useMemo } from "react";
import { RegistroCarga } from "@/types/registroCargas";
import { EspessuraStatus } from "@/utils/aplicacaoCalculations";

/**
 * Custom hook for handling calculations in the registro aplicacao form
 */
export const useCalculations = (
  comprimento: number | null | undefined,
  largura: number | null | undefined,
  registroCarga: RegistroCarga | null,
  entregaMassaRemanescente?: number
) => {
  // Calculate area
  const calculatedArea = useMemo(() => {
    if (!comprimento || !largura) return null;
    return comprimento * largura;
  }, [comprimento, largura]);

  // Calculate tonelada aplicada based on calculated area and disponible mass
  const calculatedToneladaAplicada = useMemo(() => {
    if (!calculatedArea || !registroCarga?.tonelada_real) return null;
    
    // Calculate based on area and density (assuming 2.4 t/m³ density and 5cm thickness)
    const calculatedTonelada = calculatedArea * 0.05 * 2.4;
    
    // Use the minimum between calculated and available mass
    const massaDisponivel = entregaMassaRemanescente ?? registroCarga.tonelada_real;
    
    return Math.min(calculatedTonelada, massaDisponivel);
  }, [calculatedArea, registroCarga?.tonelada_real, entregaMassaRemanescente]);

  // Calculate thickness (espessura)
  const calculatedEspessura = useMemo(() => {
    if (!calculatedToneladaAplicada || !calculatedArea) return null;
    
    // Espessura = (Tonelada / Area) / 2.4 (densidade)
    const espessura = (calculatedToneladaAplicada / calculatedArea) / 2.4;
    return Number(espessura.toFixed(3));
  }, [calculatedToneladaAplicada, calculatedArea]);

  // Calculate theoretical thickness (espessura calculada)
  const calculatedEspessuraCalculada = useMemo(() => {
    if (!calculatedToneladaAplicada || !calculatedArea) return null;
    
    // This is the same calculation for now, but could have different logic
    const espessuraCalculada = (calculatedToneladaAplicada / calculatedArea) / 2.4;
    return Number(espessuraCalculada.toFixed(3));
  }, [calculatedToneladaAplicada, calculatedArea]);

  // Calculate remaining mass after this application
  const massaRemanescente = useMemo(() => {
    if (!registroCarga?.tonelada_real || !calculatedToneladaAplicada) {
      return entregaMassaRemanescente ?? registroCarga?.tonelada_real ?? 0;
    }
    
    const massaDisponivel = entregaMassaRemanescente ?? registroCarga.tonelada_real;
    return Math.max(0, massaDisponivel - calculatedToneladaAplicada);
  }, [registroCarga?.tonelada_real, calculatedToneladaAplicada, entregaMassaRemanescente]);

  // Check if the applied mass exceeds available mass
  const exceededAvailableMass = useMemo(() => {
    if (!calculatedToneladaAplicada || !registroCarga?.tonelada_real) return false;
    
    const massaDisponivel = entregaMassaRemanescente ?? registroCarga.tonelada_real;
    return calculatedToneladaAplicada > massaDisponivel;
  }, [calculatedToneladaAplicada, registroCarga?.tonelada_real, entregaMassaRemanescente]);

  // Status for espessura (thickness) - returning proper EspessuraStatus type
  const espessuraStatus: EspessuraStatus = useMemo(() => {
    if (!calculatedEspessura) return null;
    
    if (calculatedEspessura < 0.03) return 'warning'; // Less than 3cm
    if (calculatedEspessura > 0.08) return 'error';  // More than 8cm
    return 'success';
  }, [calculatedEspessura]);

  // Status for espessura calculada - returning proper EspessuraStatus type
  const espessuraCalculadaStatus: EspessuraStatus = useMemo(() => {
    if (!calculatedEspessuraCalculada) return null;
    
    if (calculatedEspessuraCalculada < 0.035 || calculatedEspessuraCalculada > 0.05) {
      return 'error';
    }
    return 'success';
  }, [calculatedEspessuraCalculada]);

  return {
    calculatedArea,
    calculatedToneladaAplicada,
    calculatedEspessura,
    calculatedEspessuraCalculada,
    massaRemanescente,
    espessuraStatus,
    espessuraCalculadaStatus,
    exceededAvailableMass
  };
};
