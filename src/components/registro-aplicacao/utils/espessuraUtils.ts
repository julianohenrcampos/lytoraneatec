
import { EspessuraStatus } from "@/utils/aplicacaoCalculations";

/**
 * Get CSS class name based on espessura status
 */
export const getEspessuraStatusClass = (status: EspessuraStatus): string => {
  switch (status) {
    case "success":
      return "text-green-600 font-medium";
    case "warning":
      return "text-amber-600 font-medium";
    case "error":
      return "text-red-600 font-medium";
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
      return "Boa";
    case "warning":
      return "Atenção";
    case "error":
      return "Crítica";
    default:
      return "Não calculado";
  }
};

/**
 * Get CSS class name based on espessura calculada status
 */
export const getEspessuraCalculadaStatusClass = (status: EspessuraStatus): string => {
  switch (status) {
    case "success":
      return "text-green-600 font-medium";
    case "warning":
      return "text-amber-600 font-medium";
    case "error":
      return "text-red-600 font-medium";
    default:
      return "";
  }
};

/**
 * Get text description based on espessura calculada status
 */
export const getEspessuraCalculadaStatusText = (status: EspessuraStatus): string => {
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
