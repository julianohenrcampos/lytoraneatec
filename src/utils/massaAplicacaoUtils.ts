/**
 * Utility functions for mass application calculations
 * Centralized logic for the "Apply All Remaining Mass" toggle
 */

import { validateEspessuraLYTEC, EspessuraStatus } from "./espessuraValidation";

export interface MassaAplicacaoCalculation {
  toneladaAplicada: number;
  espessura: number;
  espessuraStatus: EspessuraStatus;
  massaRemanescente: number;
}

/**
 * Calculate applied tonnage based on toggle state
 * Follows the exact specification for the toggle behavior
 */
export const calculateToneladaAplicada = (
  area: number,
  massaRemanescente: number,
  aplicarTodaMassa: boolean
): number => {
  // PRIORIDADE 1: Se toggle "Aplicar toda massa" estiver marcado, aplicar TODA a massa remanescente
  if (aplicarTodaMassa) {
    console.log(`🔧 calculateToneladaAplicada - MODO APLICAR TODA MASSA: ${massaRemanescente.toFixed(3)}t`);
    return massaRemanescente;
  }
  
  // PRIORIDADE 2: Verificar se há área válida para cálculo padrão
  if (area <= 0) return 0;
  
  // Fórmula padrão: 5cm de espessura
  const volumeM3 = area * 0.05; // metros cúbicos
  const massaKg = volumeM3 * 2400; // kg
  const toneladaPadrao = massaKg / 1000; // toneladas
  const resultado = Math.min(toneladaPadrao, massaRemanescente);
  console.log(`🔧 calculateToneladaAplicada - MODO PADRÃO: ${area}m² × 0.05m × 2400kg/m³ = ${toneladaPadrao.toFixed(3)}t, limitado: ${resultado.toFixed(3)}t`);
  return resultado;
};

/**
 * Calculate thickness based on applied tonnage and area
 * Unified formula: tonelada ÷ área ÷ 2.4
 */
export const calculateEspessuraFromTonelada = (
  toneladaAplicada: number,
  area: number
): number => {
  if (area <= 0 || toneladaAplicada <= 0) return 0;
  
  // Fórmula correta: Espessura(cm) = (Massa(kg) ÷ Densidade(kg/m³) ÷ Área(m²)) × 100
  const massaKg = toneladaAplicada * 1000; // converter toneladas para kg
  const volumeM3 = massaKg / 2400; // volume em m³ (densidade = 2400 kg/m³)
  const espessuraMetros = volumeM3 / area; // espessura em metros
  const espessuraCm = espessuraMetros * 100; // converter para centímetros
  
  // Log para debugging de consistência
  console.log(`🔧 calculateEspessuraFromTonelada: ${toneladaAplicada}t ÷ ${area}m² ÷ 2400kg/m³ = ${espessuraCm.toFixed(2)}cm`);
  
  return Number(espessuraCm.toFixed(2)); // limitar a 2 casas decimais
};

/**
 * Determine thickness status based on calculated thickness using LYTEC standards
 */
export const getEspessuraStatus = (
  espessura: number,
  aplicarTodaMassa: boolean
): EspessuraStatus => {
  if (espessura <= 0) return null;
  
  // Use centralized LYTEC validation
  const validationResult = validateEspessuraLYTEC(espessura);
  return validationResult.status;
};

/**
 * Get status text description
 */
export const getEspessuraStatusText = (
  status: EspessuraStatus,
  aplicarTodaMassa: boolean
): string => {
  if (!status) return "";
  
  // Use centralized LYTEC validation for text
  const baseText = status === 'success' ? "Dentro do Padrão" : "Fora do Padrão";
  
  if (aplicarTodaMassa) {
    return `${baseText} (Massa Total)`;
  } else {
    return baseText;
  }
};

/**
 * Calculate remaining mass after application
 */
export const calculateMassaRemanescenteAfterApplication = (
  massaAtual: number,
  toneladaAplicada: number
): number => {
  const resultado = massaAtual - toneladaAplicada;
  // Round to 3 decimal places to prevent negative values due to floating point precision
  return Math.max(0, Number(resultado.toFixed(3)));
};

/**
 * Complete calculation for mass application
 * Centralized function that handles all the logic
 */
export const calculateMassaAplicacao = (
  comprimento: number | null,
  largura: number | null,
  massaRemanescente: number,
  aplicarTodaMassa: boolean
): MassaAplicacaoCalculation => {
  console.log('🎯 calculateMassaAplicacao - ENTRADA:', {
    comprimento,
    largura,
    massaRemanescente,
    aplicarTodaMassa
  });
  
  // Calculate area
  const area = (comprimento && largura) ? comprimento * largura : 0;
  console.log('📐 Área calculada:', area);
  
  // Calculate applied tonnage
  const toneladaAplicada = calculateToneladaAplicada(area, massaRemanescente, aplicarTodaMassa);
  console.log('⚖️ Tonelada aplicada:', toneladaAplicada);
  
  // Calculate thickness
  const espessura = calculateEspessuraFromTonelada(toneladaAplicada, area);
  console.log('📏 Espessura calculada:', espessura);
  
  // Determine status
  const espessuraStatus = getEspessuraStatus(espessura, aplicarTodaMassa);
  
  // Calculate remaining mass
  const massaRemanescenteAfter = calculateMassaRemanescenteAfterApplication(massaRemanescente, toneladaAplicada);
  console.log('📊 Massa remanescente após aplicação:', massaRemanescenteAfter);
  
  const resultado = {
    toneladaAplicada,
    espessura,
    espessuraStatus,
    massaRemanescente: massaRemanescenteAfter
  };
  
  console.log('✅ calculateMassaAplicacao - RESULTADO:', resultado);
  return resultado;
};