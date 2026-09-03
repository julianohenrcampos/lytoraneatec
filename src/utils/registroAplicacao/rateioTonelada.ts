/**
 * Rateio de tonelada por área para o Registro Manual de Aplicação (Fase A.1).
 * Frontend-only. Nenhuma alteração no banco.
 *
 * Regra:
 *   Quando `totalCargaT > 0`, a tonelada de cada buraco é proporcional à sua
 *   área para que a soma feche EXATAMENTE em `totalCargaT`.
 *   O resíduo de arredondamento é aplicado no buraco de MAIOR ÁREA
 *   (fallback determinístico: último por `sequenciaAplicacao`).
 *   Sem `totalCargaT`, usa fallback pela espessura padrão só para preview.
 *
 * Precisão numérica interna preservada — arredondar apenas para exibição/persistência.
 */

export const DENSIDADE_PADRAO = 2.4; // t/m³
export const ESPESSURA_PADRAO_CM = 5;

export interface BuracoInput {
  areaCalculada?: number | null;
}
export interface RuaInput {
  buracos: BuracoInput[];
}

export function computeAreaBuraco(b: BuracoInput): number {
  const a = Number(b?.areaCalculada) || 0;
  return a > 0 ? a : 0;
}

export function computeAreaRua(rua: RuaInput): number {
  if (!rua?.buracos?.length) return 0;
  return rua.buracos.reduce((s, b) => s + computeAreaBuraco(b), 0);
}

export function computeAreaTotal(ruas: RuaInput[]): number {
  if (!ruas?.length) return 0;
  return ruas.reduce((s, r) => s + computeAreaRua(r), 0);
}

export function computeToneladaBuracoRateada(
  b: BuracoInput,
  ruas: RuaInput[],
  totalCargaT: number
): number {
  const carga = Number(totalCargaT) || 0;
  if (carga <= 0) return 0;
  const areaTotal = computeAreaTotal(ruas);
  const areaB = computeAreaBuraco(b);
  if (areaTotal <= 0 || areaB <= 0) return 0;
  return carga * (areaB / areaTotal);
}

export function computeToneladaRuaRateada(
  rua: RuaInput,
  ruas: RuaInput[],
  totalCargaT: number
): number {
  const carga = Number(totalCargaT) || 0;
  if (carga <= 0) return 0;
  const areaTotal = computeAreaTotal(ruas);
  const areaR = computeAreaRua(rua);
  if (areaTotal <= 0 || areaR <= 0) return 0;
  return carga * (areaR / areaTotal);
}

export function computeEspessuraMediaCm(
  ruas: RuaInput[],
  totalCargaT: number,
  densidade: number = DENSIDADE_PADRAO
): number {
  const carga = Number(totalCargaT) || 0;
  const dens = Number(densidade) || DENSIDADE_PADRAO;
  const areaTotal = computeAreaTotal(ruas);
  if (carga <= 0 || areaTotal <= 0 || dens <= 0) return 0;
  return (carga * 100) / (areaTotal * dens);
}

/**
 * Espessura média a partir de totais agregados (área total + carga total).
 * Fórmula: espessura_cm = (totalCargaT * 100) / (areaTotalM2 * densidade)
 */
export function computeEspessuraMediaCmFromTotais(
  totalCargaT: number,
  areaTotalM2: number,
  densidade: number = DENSIDADE_PADRAO
): number {
  const carga = Number(totalCargaT) || 0;
  const area = Number(areaTotalM2) || 0;
  const dens = Number(densidade) || DENSIDADE_PADRAO;
  if (carga <= 0 || area <= 0 || dens <= 0) return 0;
  return (carga * 100) / (area * dens);
}

// ============================================================================
// Classificação visual da espessura média (frontend-only)
// ============================================================================

export type EspessuraStatus =
  | "sem_dados"
  | "critico_baixo"
  | "ok"
  | "alerta_alto"
  | "critico_alto";

export type EspessuraTone = "muted" | "success" | "warning" | "destructive";

export interface EspessuraClassificacao {
  status: EspessuraStatus;
  label: string;
  mensagem: string;
  tone: EspessuraTone;
}

/**
 * Classifica a espessura média (em cm) segundo a faixa operacional LYTEC:
 *   <= 0 / NaN → Sem dados
 *   < 3       → Crítico baixo
 *   3 a 5     → Dentro da faixa
 *   > 5 a 6   → Alerta alto
 *   > 6       → Crítico alto
 */
export function classificarEspessuraMedia(
  espessuraCm: number | null | undefined
): EspessuraClassificacao {
  const v = Number(espessuraCm);
  if (!Number.isFinite(v) || v <= 0) {
    return {
      status: "sem_dados",
      label: "Sem dados",
      mensagem: "Sem dados suficientes para calcular a espessura média.",
      tone: "muted",
    };
  }
  if (v < 3) {
    return {
      status: "critico_baixo",
      label: "Crítico baixo",
      mensagem: "Espessura abaixo de 3 cm.",
      tone: "destructive",
    };
  }
  if (v <= 5) {
    return {
      status: "ok",
      label: "Dentro da faixa",
      mensagem: "Espessura dentro da faixa operacional.",
      tone: "success",
    };
  }
  if (v <= 6) {
    return {
      status: "alerta_alto",
      label: "Alerta alto",
      mensagem: "Espessura acima de 5 cm.",
      tone: "warning",
    };
  }
  return {
    status: "critico_alto",
    label: "Crítico alto",
    mensagem: "Espessura muito acima da faixa operacional.",
    tone: "destructive",
  };
}


/** Fallback só para preview: quando não há totalCargaT, estima pela espessura padrão. */
export function computeToneladaPreviewPorEspessura(
  areaM2: number,
  espessuraCm: number = ESPESSURA_PADRAO_CM,
  densidade: number = DENSIDADE_PADRAO
): number {
  const a = Number(areaM2) || 0;
  const espM = (Number(espessuraCm) || 0) / 100;
  const dens = Number(densidade) || DENSIDADE_PADRAO;
  if (a <= 0 || espM <= 0 || dens <= 0) return 0;
  return a * espM * dens;
}

// ============================================================================
// Rateio estrito com resíduo — soma dos buracos = totalCargaT (bit-a-bit).
// ============================================================================

export interface BuracoRateioRef {
  idLocal: string;
  ruaIdLocal: string;
  sequenciaAplicacao: number;
  areaCalculada: number;
}

/**
 * Distribui `totalCargaT` proporcionalmente à `areaCalculada` de cada buraco,
 * arredonda para `decimals` casas e aplica o resíduo no buraco de maior área
 * (fallback: maior `sequenciaAplicacao`). Retorna um mapa idLocal → tonelada.
 *
 * Se `totalCargaT <= 0` ou a área total for 0, todas as toneladas retornam 0.
 */
export function computeToneladasBuracosComResiduo(
  buracos: BuracoRateioRef[],
  totalCargaT: number,
  decimals: number = 3
): Record<string, number> {
  const out: Record<string, number> = {};
  const carga = Number(totalCargaT) || 0;
  if (!buracos.length) return out;

  const areas = buracos.map((b) => (Number(b.areaCalculada) || 0));
  const areaTotal = areas.reduce((s, a) => s + a, 0);
  if (carga <= 0 || areaTotal <= 0) {
    buracos.forEach((b) => (out[b.idLocal] = 0));
    return out;
  }

  const factor = Math.pow(10, decimals);
  const round = (n: number) => Math.round(n * factor) / factor;

  // Rateio proporcional bruto e arredondado
  const brutos = buracos.map((b, i) => {
    const areaB = areas[i];
    return areaB > 0 ? carga * (areaB / areaTotal) : 0;
  });
  const arredondados = brutos.map(round);

  const somaArred = arredondados.reduce((s, x) => s + x, 0);
  const residuo = round(carga - somaArred);

  // Aplica resíduo no buraco de MAIOR área (desempate: maior sequenciaAplicacao)
  if (residuo !== 0) {
    let alvo = 0;
    for (let i = 1; i < buracos.length; i++) {
      const areaA = areas[alvo];
      const areaI = areas[i];
      if (areaI > areaA) alvo = i;
      else if (areaI === areaA && buracos[i].sequenciaAplicacao > buracos[alvo].sequenciaAplicacao) alvo = i;
    }
    arredondados[alvo] = round(arredondados[alvo] + residuo);
  }

  buracos.forEach((b, i) => (out[b.idLocal] = arredondados[i]));
  return out;
}
