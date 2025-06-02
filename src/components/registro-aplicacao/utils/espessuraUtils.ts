
import { EspessuraStatus } from "@/utils/aplicacaoCalculations";

/**
 * Get CSS class name based on espessura status
 */
export const getEspessuraStatusClass = (status: EspessuraStatus): string => {
  switch (status) {
    case "success":
      return "text-green-600 font-medium border-green-300 bg-green-50";
    case "warning":
      return "text-amber-600 font-medium border-amber-300 bg-amber-50";
    case "error":
      return "text-red-600 font-medium border-red-300 bg-red-50";
    default:
      return "";
  }
};

/**
 * Get text description based on espessura status
 */
export const getEspessuraStatusText = (status: EspessuraStatus): string => {
  switch (status) {
    case "success":
      return "Dentro do Padrão";
    case "warning":
      return "Atenção";
    case "error":
      return "Fora do Padrão";
    default:
      return "Não calculado";
  }
};

/**
 * Get CSS class name based on espessura calculada status (legacy support)
 */
export const getEspessuraCalculadaStatusClass = (status: EspessuraStatus): string => {
  return getEspessuraStatusClass(status);
};

/**
 * Get text description based on espessura calculada status (legacy support)
 */
export const getEspessuraCalculadaStatusText = (status: EspessuraStatus): string => {
  return getEspessuraStatusText(status);
};
