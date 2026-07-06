/**
 * Utilitários compartilhados de agrupamento e cálculo de exibição
 * do Relatório AP's — B.3.5-E4-B.
 *
 * Sem side-effects. Sem acesso a Supabase. Puros.
 */
import type { RelatorioApsLinha } from "@/types/relatorioAps";

export interface GrupoLinhas {
  logradouro: string;
  rotulo: string;
  linhas: RelatorioApsLinha[];
  somaArea: number;
  somaTotalT: number;
}

/** Agrupa linhas por logradouro preservando ordem de sequência. */
export function agruparPorLogradouro(linhas: RelatorioApsLinha[]): GrupoLinhas[] {
  const ordem: string[] = [];
  const map = new Map<string, RelatorioApsLinha[]>();
  for (const l of linhas) {
    const key = l.logradouro || "—";
    if (!map.has(key)) {
      map.set(key, []);
      ordem.push(key);
    }
    map.get(key)!.push(l);
  }
  return ordem.map((key) => {
    const grupo = map.get(key)!;
    const situacao = (grupo[0]?.situacao || "").trim().toUpperCase();
    return {
      logradouro: key,
      rotulo: situacao || "APLICAÇÃO",
      linhas: grupo,
      somaArea: grupo.reduce((acc, l) => acc + (l.areaAplicada || 0), 0),
      somaTotalT: grupo.reduce((acc, l) => acc + (l.totalKg || 0) / 1000, 0),
    };
  });
}

/**
 * Espessura de exibição em metros:
 * - se `espessura` (cm) existe, converte para m dividindo por 100;
 * - senão, calcula: total_t / (area_m² × peso_t_m³);
 * - fallback 0.
 * Não grava nada. Apenas exibição.
 */
export function espessuraExibicaoM(l: RelatorioApsLinha): number {
  if (l.espessura != null) return l.espessura / 100;
  const t = (l.totalKg || 0) / 1000;
  const a = l.areaAplicada || 0;
  const p = l.pesoKgM2 || 0;
  if (a > 0 && p > 0) return t / (a * p);
  return 0;
}
