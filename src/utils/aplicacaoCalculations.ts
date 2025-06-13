
/**
 * Funções utilitárias para cálculos de registro de aplicação
 */

/**
 * Calcula área baseada no comprimento e largura
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
 * Calcula tonelada aplicada baseada na área
 * Fórmula: area_calculada × 0.05 × 2.4
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
 * Ajusta tonelada aplicada baseada na massa disponível
 * Se tonelada_aplicada calculada > qtd_massa, usa qtd_massa
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
  
  // Se o valor calculado excede a massa disponível, usa a massa disponível
  return calculatedToneladaAplicada > qtdMassaNum ? qtdMassaNum : calculatedToneladaAplicada;
};

/**
 * Calcula espessura baseada na tonelada_aplicada e área
 * Fórmula: (tonelada_aplicada ÷ area) ÷ 2.4 = espessura em cm
 * Agora usa corretamente o valor tonelada_aplicada ao invés de tonelada_real
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
  
  // Fórmula correta: tonelada / area / 2.4 (para obter cm)
  return tonelada / area / 2.4;
};

/**
 * Calcula espessura calculada baseada na tonelada_aplicada e área
 * Fórmula: (tonelada_aplicada ÷ área_calculada) ÷ 2.4
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
 * Calcula massa remanescente baseada na tonelada_real e tonelada_aplicada
 * Se tonelada_aplicada > tonelada_real, retorna 0
 * Caso contrário, retorna tonelada_real - tonelada_aplicada
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
  
  // Se tonelada_aplicada excede tonelada_real, massa remanescente é 0
  return tonelada_aplicada > tonelada ? 0 : tonelada - tonelada_aplicada;
};

/**
 * Determina status baseado no valor da espessura
 */
export type EspessuraStatus = "success" | "warning" | "error" | null;

/**
 * Lógica atualizada de status da espessura com novos requisitos
 * < 0.035 cm ou > 0.05 cm → "Crítica" (error)
 * Entre 0.035 e 0.05, inclusive → "Boa" (success)
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
 * Nova lógica de status da espessura
 * < 0.035 cm ou > 0.05 cm → "Fora do Padrão" (error)
 * Entre 0.035 e 0.05, inclusive → "Dentro do Padrão" (success)
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
 * Obtém descrição textual para o status da espessura
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
