// =====================================================
// useMediaPresencaFds
// Calcula a média de presenças reais dos 2 últimos
// finais de semana anteriores ao período selecionado,
// para o Centro de Custo.
//
// Fonte: vw_relatorio_diarias_folha (mesma usada pelo
// Dashboard/Relatório/Folha) com filtros equivalentes a
// "executado": presenca_status='true' e hora_saida NOT NULL.
//
// Sem alterações em banco/RPC/RLS/triggers/views.
// =====================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays, startOfDay } from "date-fns";

export type FonteMediaFds = "ultimo_fds" | "fallback";

export interface FdsHistorico {
  sabado: string;          // yyyy-MM-dd
  domingo: string;         // yyyy-MM-dd
  qtdSab: number;          // distintos no sábado
  qtdDom: number;          // distintos no domingo
}

export interface MediaPresencaFdsResult {
  /** Média (arredondada) de presenças do(s) sábado(s), ou null. */
  sabadoAnteriorCount: number | null;
  /** Média (arredondada) de presenças do(s) domingo(s), ou null. */
  domingoAnteriorCount: number | null;
  /** Média geral entre os dias disponíveis (sáb+dom). */
  mediaFimSemanaAnterior: number;
  /** Origem do número exibido. */
  fonte: FonteMediaFds;
  /** Datas do FDS mais recente usado (para retrocompatibilidade da UI). */
  datasConsideradas: { sabado: string | null; domingo: string | null };
  /** Detalhamento dos FDS efetivamente usados (1 ou 2). */
  fdsRecentes: FdsHistorico[];
  /** Quantos FDS foram efetivamente usados na média (0, 1 ou 2). */
  qtdFdsUsados: number;
  /** Quantos FDS foram varridos antes de achar (0 = imediatamente anterior). */
  janelaPesquisada: number;
}

/**
 * Gera N pares { sabado, domingo } retroativos a partir de refDate (exclusivo),
 * do mais recente para o mais antigo.
 */
function gerarFdsRetroativos(
  ref: Date,
  n: number = 8
): Array<{ sabado: Date; domingo: Date }> {
  const base = startOfDay(ref);
  // Localiza o sábado imediatamente anterior (estritamente).
  let cursor = subDays(base, 1);
  while (cursor.getDay() !== 6) {
    cursor = subDays(cursor, 1);
  }
  const pares: Array<{ sabado: Date; domingo: Date }> = [];
  for (let i = 0; i < n; i++) {
    const sabado = subDays(cursor, i * 7);
    const domingo = subDays(sabado, -1); // sábado + 1 dia = domingo do mesmo FDS
    pares.push({ sabado, domingo });
  }
  return pares;
}

export interface UseMediaPresencaFdsOptions {
  enabled?: boolean;
  /**
   * Data de início do período da solicitação (yyyy-MM-dd ou Date).
   */
  periodoInicio?: string | Date | null;
}

export function useMediaPresencaFds(
  centroCustoId: string | null | undefined,
  opts: UseMediaPresencaFdsOptions = {}
) {
  const { enabled = true, periodoInicio } = opts;

  const refDate: Date = (() => {
    if (!periodoInicio) return new Date();
    if (periodoInicio instanceof Date) return periodoInicio;
    try {
      return parseISO(periodoInicio);
    } catch {
      return new Date();
    }
  })();
  const refKey = format(refDate, "yyyy-MM-dd");

  return useQuery<MediaPresencaFdsResult>({
    queryKey: ["media-presenca-fds-v2", centroCustoId, refKey],
    enabled: !!centroCustoId && enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const fdsCandidatos = gerarFdsRetroativos(refDate, 8);
      const todasDatas: string[] = [];
      for (const { sabado, domingo } of fdsCandidatos) {
        todasDatas.push(format(sabado, "yyyy-MM-dd"));
        todasDatas.push(format(domingo, "yyyy-MM-dd"));
      }

      const fallback = (): MediaPresencaFdsResult => ({
        sabadoAnteriorCount: null,
        domingoAnteriorCount: null,
        mediaFimSemanaAnterior: 0,
        fonte: "fallback",
        datasConsideradas: { sabado: null, domingo: null },
        fdsRecentes: [],
        qtdFdsUsados: 0,
        janelaPesquisada: 0,
      });

      if (!centroCustoId || todasDatas.length === 0) {
        return fallback();
      }

      // Fonte oficial: a mesma view usada pelo Dashboard/Relatório/Folha
      // (vw_relatorio_diarias_folha) com a mesma definição de "executado".
      const { data, error } = await supabase
        .from("vw_relatorio_diarias_folha")
        .select("data, funcionario_id, centro_custo_id, presenca_status, hora_saida")
        .eq("centro_custo_id", centroCustoId)
        .eq("presenca_status", "true" as unknown as string)
        .not("hora_saida", "is", null)
        .in("data", todasDatas)
        .limit(20000);

      if (import.meta.env.DEV) {
        console.log("[useMediaPresencaFds]", {
          centroCustoId,
          periodoInicio: refKey,
          datasPesquisadas: todasDatas,
          totalLinhas: (data || []).length,
          erro: error?.message ?? null,
        });
      }

      if (error) {
        console.warn("[useMediaPresencaFds] erro consulta", error);
        return fallback();
      }

      // Agrupa por data → set de funcionários distintos.
      const porData = new Map<string, Set<string>>();
      for (const row of data || []) {
        const key = (row as any).data as string;
        const fid = (row as any).funcionario_id as string;
        if (!key || !fid) continue;
        if (!porData.has(key)) porData.set(key, new Set());
        porData.get(key)!.add(fid);
      }

      if (import.meta.env.DEV) {
        const resumo: Record<string, number> = {};
        porData.forEach((set, k) => {
          resumo[k] = set.size;
        });
        console.log("[useMediaPresencaFds] contagem por data:", resumo);
      }

      // Coleta os FDS com QUALQUER apontamento (sáb OU dom), do mais recente ao mais antigo.
      const fdsComDado: FdsHistorico[] = [];
      let janelaPesquisada = 0;
      for (let i = 0; i < fdsCandidatos.length; i++) {
        const { sabado, domingo } = fdsCandidatos[i];
        const dataSab = format(sabado, "yyyy-MM-dd");
        const dataDom = format(domingo, "yyyy-MM-dd");
        const qtdSab = porData.get(dataSab)?.size ?? 0;
        const qtdDom = porData.get(dataDom)?.size ?? 0;
        if (qtdSab > 0 || qtdDom > 0) {
          if (fdsComDado.length === 0) janelaPesquisada = i;
          fdsComDado.push({ sabado: dataSab, domingo: dataDom, qtdSab, qtdDom });
          if (fdsComDado.length >= 2) break;
        }
      }

      if (fdsComDado.length === 0) {
        return fallback();
      }

      // Calcula média de sábados (apenas dias com dado >0) e idem para domingos.
      const sabados = fdsComDado.map((f) => f.qtdSab).filter((n) => n > 0);
      const domingos = fdsComDado.map((f) => f.qtdDom).filter((n) => n > 0);

      const mediaSab = sabados.length > 0
        ? Math.round(sabados.reduce((s, n) => s + n, 0) / sabados.length)
        : null;
      const mediaDom = domingos.length > 0
        ? Math.round(domingos.reduce((s, n) => s + n, 0) / domingos.length)
        : null;

      const disponiveis = [mediaSab, mediaDom].filter((n): n is number => n !== null);
      const mediaFimSemanaAnterior = disponiveis.length > 0
        ? Math.round(disponiveis.reduce((s, n) => s + n, 0) / disponiveis.length)
        : 0;

      const maisRecente = fdsComDado[0];

      return {
        sabadoAnteriorCount: mediaSab,
        domingoAnteriorCount: mediaDom,
        mediaFimSemanaAnterior,
        fonte: "ultimo_fds",
        datasConsideradas: {
          sabado: maisRecente.qtdSab > 0 ? maisRecente.sabado : null,
          domingo: maisRecente.qtdDom > 0 ? maisRecente.domingo : null,
        },
        fdsRecentes: fdsComDado,
        qtdFdsUsados: fdsComDado.length,
        janelaPesquisada,
      };
    },
  });
}
