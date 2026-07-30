/**
 * G3 — Mapa equipamento → disponibilidade operacional (uma única query).
 *
 * A situação cadastral (bd_caminhoes_equipamentos.situacao) e a disponibilidade
 * operacional (bd_disponibilidade_equipamentos) são dimensões distintas; este
 * hook expõe apenas a segunda, já reconciliada pelo desempate canônico.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  indexarDisponibilidadePorEquipamento,
  normalizarStatusOperacional,
  type LinhaDisponibilidade,
  type StatusOperacionalCanonico,
} from "@/lib/ativos/reconciliacaoOperacional";

export interface StatusOperacionalAtivo {
  statusOperacional: StatusOperacionalCanonico;
  possuiRegistro: boolean;
  previsaoLiberacao: string | null;
}

export type MapaStatusOperacional = Record<string, StatusOperacionalAtivo>;

const PAGE = 1000;

const fetchMapaStatusOperacional = async (): Promise<MapaStatusOperacional> => {
  const linhas: (LinhaDisponibilidade & { previsao_liberacao: string | null })[] = [];
  for (let inicio = 0; ; inicio += PAGE) {
    const { data, error } = await supabase
      .from("bd_disponibilidade_equipamentos")
      .select("id, equipamento_id, status_operacional, previsao_liberacao, created_at, updated_at")
      .range(inicio, inicio + PAGE - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as (LinhaDisponibilidade & { previsao_liberacao: string | null })[];
    linhas.push(...lote);
    if (lote.length < PAGE) break;
  }

  const indexado = indexarDisponibilidadePorEquipamento(linhas);
  const mapa: MapaStatusOperacional = {};
  for (const [equipamentoId, linha] of Object.entries(indexado)) {
    mapa[equipamentoId] = {
      statusOperacional: normalizarStatusOperacional(true, linha?.status_operacional ?? null),
      possuiRegistro: true,
      previsaoLiberacao: (linha as { previsao_liberacao?: string | null })?.previsao_liberacao ?? null,
    };
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
