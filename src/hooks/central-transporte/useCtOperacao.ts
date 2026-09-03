/**
 * CT-3E / CT-3F — Hooks de operação da viagem.
 *
 * Leituras sempre autoritativas (RPC). Escritas passam por useCtOperation, que
 * garante request_id estável, replay idempotente e classificação determinística
 * dos erros do servidor.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";
import {
  fetchOrdensOperacaoTodas,
  fetchRecebimentosPendentes,
  fetchSolicitacaoTimeline,
  fetchViagemOperacaoDetalhe,
  finalizarRecebimento,
  iniciarViagem,
  registrarChegada,
  salvarChecklistSaida,
} from "@/services/ctOperacaoService";
import { registrarChegadaParada } from "@/services/ctMovDiretaService";
import type {
  CtChecklistSaidaPayload,
  CtRecebimentoPayload,
} from "@/types/centralTransporteOperacao";

export const useCtOrdensOperacaoTodas = (enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: ["ct3e", "ordens-todas"],
    staleTime: 30 * 1000,
    queryFn: () => fetchOrdensOperacaoTodas(),
  });
  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hoje: query.data?.hoje ?? null,
    ordens: query.data?.ordens ?? [],
  };
};

export const useCtRecebimentosPendentes = (enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: ["ct3f", "recebimentos-pendentes"],
    staleTime: 30 * 1000,
    queryFn: () => fetchRecebimentosPendentes(),
  });
  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    /** Viagens que chegaram ao destino e aguardam conferência. */
    ordens: query.data?.ordens ?? [],
    /** Viagens em trânsito direcionadas ao mesmo recebedor (somente acompanhamento). */
    aCaminho: query.data?.aCaminho ?? [],
    /** Viagens já recebidas — histórico somente leitura. */
    concluidos: query.data?.concluidos ?? [],
  };
};


export const useCtViagemOperacao = (viagemId: string | null) => {
  const query = useQuery({
    enabled: !!viagemId,
    queryKey: ["ct3e", "viagem-operacao", viagemId],
    staleTime: 0,
    queryFn: () => fetchViagemOperacaoDetalhe(viagemId as string),
  });
  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    detalhe: query.data ?? null,
  };
};

export const useCtSolicitacaoTimeline = (solicitacaoId: string | null, enabled = true) => {
  const query = useQuery({
    enabled: enabled && !!solicitacaoId,
    queryKey: ["ct3f", "timeline", solicitacaoId],
    staleTime: 30 * 1000,
    queryFn: () => fetchSolicitacaoTimeline(solicitacaoId as string),
  });
  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    timeline: query.data ?? null,
  };
};

/** Comandos operacionais da viagem, todos idempotentes e com escopo isolado. */
export const useCtViagemComandos = (viagemId: string | null) => {
  const qc = useQueryClient();
  const { run, getAttempt, clearScope } = useCtOperation();
  const scope = viagemId ? `ct3e:${viagemId}` : "ct3e:sem-viagem";

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["ct3e", "viagem-operacao", viagemId] });
    qc.invalidateQueries({ queryKey: ["ct3e", "ordens-todas"] });
    qc.invalidateQueries({ queryKey: ["ct3d", "minhas-ordens"] });
    qc.invalidateQueries({ queryKey: ["ct3f", "recebimentos-pendentes"] });
    qc.invalidateQueries({ queryKey: ["ct3f", "timeline"] });
  }, [qc, viagemId]);

  const salvarChecklist = useCallback(
    async (payload: CtChecklistSaidaPayload) => {
      if (!viagemId) throw new Error("CT3E_VIAGEM_NAO_SELECIONADA");
      const chave = `${scope}:checklist:${payload.tipo}:${payload.movimentacaoId ?? "geral"}`;
      const out = await run({
        operation: "CHECKLIST_SAIDA",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => salvarChecklistSaida(viagemId, payload, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope, viagemId],
  );

  const iniciar = useCallback(async () => {
    if (!viagemId) throw new Error("CT3E_VIAGEM_NAO_SELECIONADA");
    const chave = `${scope}:iniciar`;
    const out = await run({
      operation: "VIAGEM_INICIAR",
      materialKey: chave,
      resourceIds: [chave],
      scope,
      exec: (requestId) => iniciarViagem(viagemId, requestId),
    });
    if (out.status === "ok") invalidar();
    return out;
  }, [invalidar, run, scope, viagemId]);

  const registrarChegadaViagem = useCallback(async () => {
    if (!viagemId) throw new Error("CT3E_VIAGEM_NAO_SELECIONADA");
    const chave = `${scope}:chegada`;
    const out = await run({
      operation: "VIAGEM_CHEGADA",
      materialKey: chave,
      resourceIds: [chave],
      scope,
      exec: (requestId) => registrarChegada(viagemId, requestId),
    });
    if (out.status === "ok") invalidar();
    return out;
  }, [invalidar, run, scope, viagemId]);

  /** CT-4 — chegada em uma parada específica da viagem multiparadas. */
  const registrarChegadaDaParada = useCallback(
    async (paradaId: string) => {
      const chave = `${scope}:chegada-parada:${paradaId}`;
      const out = await run({
        operation: "VIAGEM_CHEGADA",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => registrarChegadaParada(paradaId, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope],
  );

  const finalizar = useCallback(
    async (payload: CtRecebimentoPayload) => {
      if (!viagemId) throw new Error("CT3E_VIAGEM_NAO_SELECIONADA");
      const chave = `${scope}:recebimento`;
      const out = await run({
        operation: "RECEBIMENTO_FINALIZAR",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => finalizarRecebimento(viagemId, payload, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope, viagemId],
  );

  return {
    salvarChecklist,
    iniciar,
    registrarChegada: registrarChegadaViagem,
    registrarChegadaParada: registrarChegadaDaParada,
    finalizarRecebimento: finalizar,
    getAttempt,
    limparEscopo: clearScope,
    scope,
  };
};
