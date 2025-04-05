
import { useState, useEffect } from "react";
import { RegistroCarga } from "@/types/registroCargas";
import { 
  calculateArea, 
  calculateEspessura, 
  getEspessuraStatus,
  type EspessuraStatus 
} from "@/utils/aplicacaoCalculations";

/**
 * Custom hook for handling form calculations 
 * for registro aplicacao
 */
export const useCalculations = (
  comprimento: number | null,
  largura: number | null,
  registroCarga: RegistroCarga | null
) => {
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null);
  const [calculatedEspessura, setCalculatedEspessura] = useState<number | null>(null);
  const [espessuraStatus, setEspessuraStatus] = useState<EspessuraStatus>(null);
  
  // Calculate area and espessura when values change
  useEffect(() => {
    const area = calculateArea(comprimento, largura);
    setCalculatedArea(area);
    
    if (area && registroCarga?.tonelada_real) {
      const espessura = calculateEspessura(registroCarga.tonelada_real, area);
      setCalculatedEspessura(espessura);
      setEspessuraStatus(getEspessuraStatus(espessura));
    } else {
      setCalculatedEspessura(null);
      setEspessuraStatus(null);
    }
  }, [comprimento, largura, registroCarga]);

  return {
    calculatedArea,
    calculatedEspessura,
    espessuraStatus
  };
};
