
import { EspessuraStatus } from "@/utils/aplicacaoCalculations";

export const getEspessuraStatusClass = (espessuraStatus: EspessuraStatus): string => {
  switch (espessuraStatus) {
    case "success":
      return "text-green-500";
    case "warning":
      return "text-amber-500";
    case "error":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
};

export const getEspessuraStatusText = (espessuraStatus: EspessuraStatus): string => {
  switch (espessuraStatus) {
    case "success":
      return "Dentro do padrão";
    case "warning":
      return "Atenção";
    case "error":
      return "Fora do padrão";
    default:
      return "Não calculado";
  }
};
