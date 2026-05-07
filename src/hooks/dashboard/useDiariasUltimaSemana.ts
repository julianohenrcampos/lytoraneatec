import { useQuery } from "@tanstack/react-query";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getRelatorioFolha } from "@/services/diarias/relatorioService";
import { isRelatorioItemConfirmado } from "@/services/diarias/relatorioMetrics";

export interface DiariasUltimaSemanaResult {
  valor: number;
  qtdDiarias: number;
  data_inicio: string; // ISO yyyy-MM-dd
  data_fim: string; // ISO yyyy-MM-dd
  periodoLabel: string; // "27/04/2026 a 03/05/2026"
}

/**
 * Última semana fechada (segunda a domingo) anterior à semana atual.
 * Soma valor real executado (presença confirmada) usando a mesma fonte
 * do Relatório/Folha.
 */
export function useDiariasUltimaSemana() {
  return useQuery<DiariasUltimaSemanaResult>({
    queryKey: ["rh-diarias-ultima-semana"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const hoje = new Date();
      const inicioSemanaAtual = startOfWeek(hoje, { weekStartsOn: 1 });
      const inicioSemanaAnterior = subWeeks(inicioSemanaAtual, 1);
      const fimSemanaAnterior = endOfWeek(inicioSemanaAnterior, { weekStartsOn: 1 });

      const data_inicio = format(inicioSemanaAnterior, "yyyy-MM-dd");
      const data_fim = format(fimSemanaAnterior, "yyyy-MM-dd");
      const periodoLabel = `${format(inicioSemanaAnterior, "dd/MM/yyyy", { locale: ptBR })} a ${format(fimSemanaAnterior, "dd/MM/yyyy", { locale: ptBR })}`;

      try {
        const relatorio = await getRelatorioFolha({ data_inicio, data_fim });
        const confirmados = (relatorio ?? []).filter(isRelatorioItemConfirmado);
        const valor = confirmados.reduce(
          (acc: number, r: any) => acc + Math.ceil(Number(r.valor_diaria_aplicada) || 0),
          0
        );
        return {
          valor,
          qtdDiarias: confirmados.length,
          data_inicio,
          data_fim,
          periodoLabel,
        };
      } catch (e) {
        console.error("[useDiariasUltimaSemana] erro:", e);
        return {
          valor: 0,
          qtdDiarias: 0,
          data_inicio,
          data_fim,
          periodoLabel,
        };
      }
    },
  });
}
