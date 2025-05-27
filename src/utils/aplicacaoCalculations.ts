
/**
 * Utility functions for registro aplicacao calculations
 */

/**
 * Calculate area based on comprimento and largura
 */
export const calculateArea = (
  comprimento: number | null, 
  largura: number | null
): number | null => {
  if (comprimento && largura) {
    return comprimento * largura;
  }
  return null;
};

/**
 * Calculate tonelada aplicada based on area
 * area_calculada × 0.05 × 2.4
 */
export const calculateToneladaAplicada = (
  area: number | null
): number | null => {
  if (!area) {
    return null;
  }
  return area * 0.05 * 2.4;
};

/**
 * Adjust tonelada aplicada based on available mass
 * If calculated tonelada_aplicada > qtd_massa, use qtd_massa instead
 */
export const adjustToneladaAplicada = (
  calculatedToneladaAplicada: number | null,
  qtdMassa: number | string | null | undefined
): number | null => {
  if (calculatedToneladaAplicada === null || !qtdMassa) {
    return calculatedToneladaAplicada;
  }
  
  const qtdMassaNum = typeof qtdMassa === 'string' 
    ? parseFloat(qtdMassa) 
    : qtdMassa;
    
  if (isNaN(qtdMassaNum)) {
    return calculatedToneladaAplicada;
  }
  
  // If calculated value exceeds available mass, use available mass instead
  return calculatedToneladaAplicada > qtdMassaNum ? qtdMassaNum : calculatedToneladaAplicada;
};

/**
 * Calculate espessura based on tonelada_aplicada and area
 * Formula: (tonelada_aplicada ÷ area) ÷ 2.4 = espessura em cm
 * This now correctly uses the tonelada_aplicada value instead of tonelada_real
 */
export const calculateEspessura = (
  tonelada_aplicada: number | string | null | undefined, 
  area: number | null
): number | null => {
  if (!tonelada_aplicada || !area) {
    return null;
  }
  
  const tonelada = typeof tonelada_aplicada === 'string' 
    ? parseFloat(tonelada_aplicada) 
    : tonelada_aplicada;
    
  if (isNaN(tonelada)) {
    return null;
  }
  
  // Correct formula: tonelada / area / 2.4 (to get cm)
  return tonelada / area / 2.4;
};

/**
 * Calculate espessura calculada based on tonelada_aplicada and area
 * (tonelada_aplicada ÷ área_calculada) ÷ 2.4
 */
export const calculateEspessuraCalculada = (
  tonelada_aplicada: number | null,
  area: number | null
): number | null => {
  if (!tonelada_aplicada || !area) {
    return null;
  }
  
  return tonelada_aplicada / area / 2.4;
};

/**
 * Calculate massa remanescente based on tonelada_real and tonelada_aplicada
 * If tonelada_aplicada > tonelada_real, return 0
 * Otherwise, return tonelada_real - tonelada_aplicada
 */
export const calculateMassaRemanescente = (
  tonelada_real: number | string | null | undefined,
  tonelada_aplicada: number | null
): number | null => {
  if (!tonelada_real || tonelada_aplicada === null) {
    return null;
  }
  
  const tonelada = typeof tonelada_real === 'string' 
    ? parseFloat(tonelada_real) 
    : tonelada_real;
    
  if (isNaN(tonelada)) {
    return null;
  }
  
  // If tonelada_aplicada exceeds tonelada_real, remaining mass is 0
  return tonelada_aplicada > tonelada ? 0 : tonelada - tonelada_aplicada;
};

/**
 * Determine status based on espessura value
 */
export type EspessuraStatus = "success" | "warning" | "error" | null;

/**
 * Updated espessura status logic with new requirements
 * < 0.035 cm or > 0.05 cm → "Crítica" (error)
 * Between 0.035 and 0.05, inclusive → "Boa" (success)
 */
export const getEspessuraStatus = (espessura: number | null): EspessuraStatus => {
  if (!espessura) return null;
  
  if (espessura < 0.035 || espessura > 0.05) {
    return "error";
  } else {
    return "success";
  }
};

/**
 * New espessura status logic
 * < 0.035 cm ou > 0.05 cm → "Fora do Padrão" (error)
 * Between 0.035 and 0.05, inclusive → "Dentro do Padrão" (success)
 */
export const getEspessuraCalculadaStatus = (espessura: number | null): EspessuraStatus => {
  if (!espessura) return null;
  
  if (espessura < 0.035 || espessura > 0.05) {
    return "error";
  } else {
    return "success";
  }
};

/**
 * Get text description for espessura status
 */
export const getEspessuraCalculadaStatusText = (status: EspessuraStatus): string => {
  switch (status) {
    case "success":
      return "Dentro do Padrão";
    case "error":
      return "Fora do Padrão";
    default:
      return "Não calculado";
  }
};
