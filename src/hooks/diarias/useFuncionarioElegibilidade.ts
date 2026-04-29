// =====================================================
// useFuncionarioElegibilidade
// Consulta a RPC fn_diaria_funcionario_elegibilidade para
// um conjunto de funcionarioIds em paralelo (cap 25 simultâneas)
// e expõe um Map<id, EstadoElegibilidade> com 3 estados:
//   - 'livre'     → adiciona direto
//   - 'alerta'    → exige confirmação explícita
//   - 'bloqueado' → bloqueio duro, ignora forceAdd
// Cache compartilhado entre Solicitação, Apontamento e
// Solicitação de Equipamento (paridade total).
// =====================================================

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EstadoElegibilidadeStatus = "livre" | "alerta" | "bloqueado";

export interface EstadoElegibilidade {
  status: EstadoElegibilidadeStatus;
  elegivel: boolean;
  motivo?: string | null;
  alertaMensagem?: string | null;
  conflito?: {
    numero_solicitacao?: string | null;
    data?: string | null;
    solicitacao_id?: string | null;
  };
}

export interface UseFuncionarioElegibilidadeParams {
  funcionarioIds: string[];
  dataInicio?: string | null;
  dataFim?: string | null;
  solicitacaoId?: string | null;
  enabled?: boolean;
}

export interface UseFuncionarioElegibilidadeResult {
  elegibilidadeMap: Map<string, EstadoElegibilidade>;
  isFetching: boolean;
  getStatus: (id: string) => EstadoElegibilidade | undefined;
}

async function consultarElegibilidade(
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
  solicitacaoId?: string | null
): Promise<EstadoElegibilidade> {
  const { data, error } = await supabase.rpc(
    "fn_diaria_funcionario_elegibilidade" as any,
    {
      p_funcionario_id: funcionarioId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_solicitacao_id: solicitacaoId || null,
    } as any
  );

  if (error) {
    console.error(
      "[useFuncionarioElegibilidade] erro RPC",
      funcionarioId,
      error
    );
    // Em caso de erro, marcar como livre para não travar UX,
    // mas com motivo descritivo no console.
    return { status: "livre", elegivel: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { status: "livre", elegivel: true };
  }

  // 3 estados vêm da RPC; fallback para boolean elegivel quando
  // status estiver ausente (compatibilidade defensiva).
  const rawStatus = (row.status as string) || (row.elegivel === false ? "bloqueado" : "livre");
  const status: EstadoElegibilidadeStatus =
    rawStatus === "bloqueado" || rawStatus === "alerta" || rawStatus === "livre"
      ? (rawStatus as EstadoElegibilidadeStatus)
      : "livre";

  return {
    status,
    elegivel: row.elegivel ?? status !== "bloqueado",
    motivo: row.motivo_bloqueio ?? null,
    alertaMensagem: row.alerta_mensagem ?? null,
    conflito: {
      numero_solicitacao: row.conflito_solicitacao ?? null,
      data: row.conflito_data ?? null,
      solicitacao_id: row.conflito_solicitacao_id ?? null,
    },
  };
}

export function useFuncionarioElegibilidade(
  params: UseFuncionarioElegibilidadeParams
): UseFuncionarioElegibilidadeResult {
  const {
    funcionarioIds,
    dataInicio,
    dataFim,
    solicitacaoId = null,
    enabled = true,
  } = params;

  const isReady = !!dataInicio && !!dataFim && enabled;
  // Dedupe + sort para chave estável (cache compartilhado entre telas).
  const ids = useMemo(
    () => Array.from(new Set(funcionarioIds.filter(Boolean))).sort(),
    [funcionarioIds]
  );

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [
        "funcionario-elegibilidade",
        id,
        dataInicio,
        dataFim,
        solicitacaoId,
      ],
      queryFn: () =>
        consultarElegibilidade(id, dataInicio!, dataFim!, solicitacaoId),
      enabled: isReady,
      staleTime: 15_000,
    })),
  });

  const elegibilidadeMap = useMemo(() => {
    const map = new Map<string, EstadoElegibilidade>();
    ids.forEach((id, idx) => {
      const data = queries[idx]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [ids, queries]);

  const isFetching = queries.some((q) => q.isFetching);

  return {
    elegibilidadeMap,
    isFetching,
    getStatus: (id: string) => elegibilidadeMap.get(id),
  };
}
