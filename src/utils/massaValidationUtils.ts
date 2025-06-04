
/**
 * Utility functions for mass validation and consistency checks
 */

export interface MassaValidationResult {
  isValid: boolean;
  percentualAplicado: number;
  exceededMass: boolean;
  message?: string;
}

/**
 * Validate if total applied mass doesn't exceed total mass
 */
export const validateMassaAplicada = (
  totalAplicado: number,
  massaTotal: number
): MassaValidationResult => {
  const percentualAplicado = massaTotal > 0 ? (totalAplicado / massaTotal) * 100 : 0;
  const exceededMass = totalAplicado > massaTotal;
  
  return {
    isValid: !exceededMass,
    percentualAplicado: Math.min(percentualAplicado, 100), // Cap at 100% for display
    exceededMass,
    message: exceededMass 
      ? `Total aplicado (${totalAplicado.toFixed(2)}t) excede massa total (${massaTotal.toFixed(2)}t)`
      : undefined
  };
};

/**
 * Check if a new application would exceed available mass
 */
export const validateNovaAplicacao = (
  toneladaAplicar: number,
  massaRemanescente: number
): { isValid: boolean; message?: string } => {
  if (toneladaAplicar > massaRemanescente) {
    return {
      isValid: false,
      message: `Aplicação de ${toneladaAplicar.toFixed(2)}t excede massa remanescente de ${massaRemanescente.toFixed(2)}t`
    };
  }
  
  return { isValid: true };
};

/**
 * Get status class based on mass validation
 */
export const getMassaStatusClass = (validation: MassaValidationResult): string => {
  if (validation.exceededMass) {
    return "text-red-600 bg-red-50 border-red-200";
  }
  if (validation.percentualAplicado >= 90) {
    return "text-orange-600 bg-orange-50 border-orange-200";
  }
  return "text-green-600 bg-green-50 border-green-200";
};

/**
 * Get progress bar color based on validation
 */
export const getProgressBarColor = (validation: MassaValidationResult): string => {
  if (validation.exceededMass) {
    return "bg-red-500";
  }
  if (validation.percentualAplicado >= 90) {
    return "bg-orange-500";
  }
  return "bg-green-500";
};
