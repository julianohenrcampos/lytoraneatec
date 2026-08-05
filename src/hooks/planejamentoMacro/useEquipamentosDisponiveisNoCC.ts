// Fase 7B — Equipamentos disponíveis / alocados / com solicitação aberta no CC
// durante a semana selecionada. Apenas leitura — sem auto-solicitação.

import { useQuery } from "@tanstack/react-query";
import { fetchDisponibilidades } from "@/services/disponibilidadeEquipamentoService";
import { listarSolicitacoesEquipamentoPorCentroPeriodo } from "@/services/solicitacaoEquipamentoService";

export interface DisponibilidadePorTipo {
  tipoChave: string; // UPPER(TRIM(descricao))
  disponivel: number;
  alocado: number;
  solicitacoesAbertas: number;
}

const STATUS_FLUXO_ABERTAS = new Set([
  "RASCUNHO",
  "PENDENTE_APROVACAO",
  "APROVADO",
  "EM_TRANSPORTE",
]);

function intersectaSemana(
  dataInicio: string | null,
  previsaoLib: string | null,
  semanaInicio: string,
  semanaFim: string
): boolean {
  const ini = dataInicio ?? "0000-01-01";
  const fim = previsaoLib ?? "9999-12-31";
  return ini <= semanaFim && fim >= semanaInicio;
}

interface Params {
  centroCustoId: string | null;
  semanaInicio: string | null;
  semanaFim: string | null;
}

export function useEquipamentosDisponiveisNoCC({
  centroCustoId,
  semanaInicio,
  semanaFim,
}: Params) {
  return useQuery({
    queryKey: [
      "plano-semanal-eq-disp",
      centroCustoId,
      semanaInicio,
      semanaFim,
    ],
    enabled: !!centroCustoId && !!semanaInicio && !!semanaFim,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, DisponibilidadePorTipo>> => {
      const mapa = new Map<string, DisponibilidadePorTipo>();

      // 1) Disponibilidades vigentes no CC durante a semana
      const disps = await fetchDisponibilidades({ centro_custo_id: centroCustoId! });
      for (const d of disps) {
        if (!intersectaSemana(d.data_inicio, d.previsao_liberacao, semanaInicio!, semanaFim!)) continue;
        const tipo = (d.tipo_equipamento_descricao ?? "").toString().trim().toUpperCase();
        if (!tipo) continue;
        let row = mapa.get(tipo);
        if (!row) {
          row = { tipoChave: tipo, disponivel: 0, alocado: 0, solicitacoesAbertas: 0 };
          mapa.set(tipo, row);
        }
        const status = (d.status_operacional ?? "").toString().toUpperCase();
        if (status === "DISPONIVEL") row.disponivel += 1;
        else if (status === "ALOCADO") row.alocado += 1;
      }

      // 2) Solicitações abertas que interceptam a semana
      const sols = await listarSolicitacoesEquipamentoPorCentroPeriodo({
        centroCustoId: centroCustoId!,
        dataInicio: semanaInicio!,
        dataFim: semanaFim!,
      });
      for (const s of sols) {
        if (!STATUS_FLUXO_ABERTAS.has(s.status_fluxo)) continue;
        const tipo = (s.descricao_tipo_equipamento ?? "").toString().trim().toUpperCase();
        if (!tipo) continue;
        let row = mapa.get(tipo);
        if (!row) {
          row = { tipoChave: tipo, disponivel: 0, alocado: 0, solicitacoesAbertas: 0 };
          mapa.set(tipo, row);
        }
        row.solicitacoesAbertas += s.quantidade ?? 1;
      }
      return mapa;
    },
  });
}
