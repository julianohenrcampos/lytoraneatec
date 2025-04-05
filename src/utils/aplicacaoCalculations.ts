
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
 * Calculate espessura based on tonelada_real and area
 */
export const calculateEspessura = (
  tonelada_real: number | null | undefined, 
  area: number | null
): number | null => {
  if (tonelada_real && area) {
    // Convert to cm: (tonelada_real * 1000) / (area * 2.4)
    return (tonelada_real * 1000) / (area * 2.4);
  }
  return null;
};

/**
 * Determine status based on espessura value
 */
export type EspessuraStatus = "success" | "warning" | "error" | null;

export const getEspessuraStatus = (espessura: number | null): EspessuraStatus => {
  if (!espessura) return null;
  
  if (espessura <= 4.8) {
    return "success";
  } else if (espessura > 4.8 && espessura <= 5.8) {
    return "warning";
  } else {
    return "error";
  }
};
