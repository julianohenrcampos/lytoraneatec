/**
 * G3 — Mapa equipamento → estado operacional derivado (duas queries em lote).
 *
 * Dimensões distintas:
 *   - situação cadastral/física (bd_caminhoes_equipamentos.situacao);
 *   - disponibilidade operacional (bd_disponibilidade_equipamentos);
 *   - manutenção (bd_ordens_servico com status 'Aberta'/'Em Andamento'),
 *     que tem PRECEDÊNCIA sobre previsão de liberação e disponibilidade manual.
 *
 * Sem N+1: uma query paginada de disponibilidade + uma query paginada de OS
 * abertas. Nenhuma consulta por linha.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  derivarDisponibilidadeMovimentacao,
  indexarDisponibilidadePorEquipamento,
  normalizarStatusOperacional,
  type DisponibilidadeMovimentacao,
  type LinhaDisponibilidade,
  type StatusOperacionalCanonico,
} from "@/lib/ativos/reconciliacaoOperacional";

export interface StatusOperacionalAtivo {
  statusOperacional: StatusOperacionalCanonico;
  possuiRegistro: boolean;
  previsaoLiberacao: string | null;
  temOsAberta: boolean;
  disponibilidadeMovimentacao: DisponibilidadeMovimentacao;
  disponibilidadeLabel: string;
  disponivelParaMovimentacao: boolean;
  motivo: string | null;
}

export type MapaStatusOperacional = Record<string, StatusOperacionalAtivo>;

const PAGE = 1000;

/** Status de OS que caracterizam manutenção em curso. */
export const OS_STATUS_MANUTENCAO = ["Aberta", "Em Andamento"] as const;

type LinhaDisp = LinhaDisponibilidade & { previsao_liberacao: string | null };

const fetchEquipamentosComOsAberta = async (): Promise<Set<string>> => {
  const ids = new Set<string>();
  for (let inicio = 0; ; inicio += PAGE) {
    const { data, error } = await supabase
      .from("bd_ordens_servico")
      .select("caminhao_equipamento_id")
      .in("status", OS_STATUS_MANUTENCAO as unknown as string[])
      .not("caminhao_equipamento_id", "is", null)
      .range(inicio, inicio + PAGE - 1);
    if (error) throw error;
    const lote = data ?? [];
    for (const l of lote) {
      const id = (l as { caminhao_equipamento_id: string | null }).caminhao_equipamento_id;
      if (id) ids.add(id);
    }
    if (lote.length < PAGE) break;
  }
  return ids;
};

const fetchMapaStatusOperacional = async (): Promise<MapaStatusOperacional> => {
  const linhas: LinhaDisp[] = [];
  for (let inicio = 0; ; inicio += PAGE) {
    const { data, error } = await supabase
      .from("bd_disponibilidade_equipamentos")
      .select("id, equipamento_id, status_operacional, previsao_liberacao, created_at, updated_at")
      .range(inicio, inicio + PAGE - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as LinhaDisp[];
    linhas.push(...lote);
    if (lote.length < PAGE) break;
  }

  const comOsAberta = await fetchEquipamentosComOsAberta();

  const indexado = indexarDisponibilidadePorEquipamento(linhas);
  const mapa: MapaStatusOperacional = {};

  const montar = (
    equipamentoId: string,
    linha: LinhaDisp | null,
  ): StatusOperacionalAtivo => {
    const possuiRegistro = !!linha;
    const statusOperacional = normalizarStatusOperacional(
      possuiRegistro,
      linha?.status_operacional ?? null,
    );
    const previsaoLiberacao = linha?.previsao_liberacao ?? null;
    const temOsAberta = comOsAberta.has(equipamentoId);
    const derivado = derivarDisponibilidadeMovimentacao({
      statusOperacional,
      previsaoLiberacao,
      temOsAberta,
    });
    return {
      statusOperacional: temOsAberta ? "MANUTENCAO" : statusOperacional,
      possuiRegistro,
      previsaoLiberacao,
      temOsAberta,
      disponibilidadeMovimentacao: derivado.estado,
      disponibilidadeLabel: derivado.label,
      disponivelParaMovimentacao: derivado.disponivelParaMovimentacao,
      motivo: derivado.motivo,
    };
  };

  for (const [equipamentoId, linha] of indexado) {
    mapa[equipamentoId] = montar(equipamentoId, linha);
  }

  // Ativos sem linha de disponibilidade porém com OS aberta: manutenção manda.
  for (const equipamentoId of comOsAberta) {
    if (!mapa[equipamentoId]) mapa[equipamentoId] = montar(equipamentoId, null);
  }

  return mapa;
};

export const useStatusOperacionalMap = (enabled = true) =>
  useQuery({
    queryKey: ["status-operacional-map"],
    queryFn: fetchMapaStatusOperacional,
    enabled,
    staleTime: 30_000,
  });

export default useStatusOperacionalMap;
