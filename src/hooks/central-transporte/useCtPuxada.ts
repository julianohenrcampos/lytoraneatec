/**
 * CT-5 — Estado das Puxadas (listagem e edição).
 *
 * Leituras autoritativas (RPC) e escritas idempotentes via useCtOperation: o
 * request_id é estável por chave material, então repetir a mesma tentativa
 * nunca duplica puxada nem caminhão.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";
import {
  cancelarPuxada,
  fetchMotoristasOperacionais,
  fetchPuxada,
  fetchPuxadas,
  programarPuxada,
  salvarRascunhoPuxada,
  type PuxadaListarFiltros,
} from "@/services/ctPuxadaService";
import {
  hidratarPuxada,
  rascunhoPuxadaVazio,
} from "@/lib/central-transporte/puxadaRascunho";
import type {
  CtPuxadaCancelamentoResult,
  CtPuxadaComandoResult,
  CtPuxadaRascunho,
} from "@/types/centralTransportePuxada";

export const CT5_PREFIX = "ct5";

/** Listagem das puxadas (aba da Central). */
export const useCtPuxadas = (filtros: PuxadaListarFiltros = {}, enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: [CT5_PREFIX, "listar", filtros],
    staleTime: 30 * 1000,
    queryFn: () => fetchPuxadas(filtros),
  });
  return {
    puxadas: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Motoristas habilitados (RPC SECURITY DEFINER — vale para Apontador). */
export const useCtMotoristasOperacionais = (enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: [CT5_PREFIX, "motoristas"],
    staleTime: 5 * 60 * 1000,
    queryFn: fetchMotoristasOperacionais,
  });
  return {
    motoristas: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
};

export interface UseCtPuxadaEdicaoParams {
  puxadaId?: string | null;
}

export const useCtPuxadaEdicao = ({ puxadaId = null }: UseCtPuxadaEdicaoParams) => {
  const qc = useQueryClient();
  const { run, getAttempt, clearScope } = useCtOperation();
  const [rascunho, setRascunho] = useState<CtPuxadaRascunho>(() => rascunhoPuxadaVazio());
  const scope = useMemo(() => `ct5:${puxadaId ?? "novo"}`, [puxadaId]);

  const estado = useQuery({
    enabled: !!puxadaId,
    queryKey: [CT5_PREFIX, "estado", puxadaId],
    queryFn: () => fetchPuxada(puxadaId as string),
  });

  /* Hidratação autoritativa: o servidor é a única fonte do que está salvo. */
  useEffect(() => {
    if (estado.data) setRascunho(hidratarPuxada(estado.data));
  }, [estado.data]);

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [CT5_PREFIX] });
  }, [qc]);

  /**
   * `snapshot` permite gravar o rascunho recém-composto (ex.: com a rota da
   * Directions API) no mesmo tick, sem depender do re-render do estado.
   */
  const salvar = useCallback(
    async (snapshot?: CtPuxadaRascunho) => {
      const alvo = snapshot ?? rascunho;
      const chave = `${scope}:rascunho`;
      const out = await run<CtPuxadaComandoResult>({
        operation: "PUXADA_RASCUNHO",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => salvarRascunhoPuxada(alvo, requestId),
      });
      if (out.status === "ok") {
        setRascunho({
          ...alvo,
          puxadaId: out.data.puxadaId,
          codigo: out.data.puxada?.codigo ?? alvo.codigo,
          caminhoes: out.data.puxada
            ? hidratarPuxada(out.data.puxada).caminhoes
            : alvo.caminhoes,
        });
        invalidar();
      }
      return out;
    },
    [invalidar, rascunho, run, scope],
  );

  const programar = useCallback(
    async (id: string) => {
      const chave = `${scope}:programar:${id}`;
      const out = await run<CtPuxadaComandoResult>({
        operation: "PUXADA_PROGRAMAR",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => programarPuxada(id, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope],
  );

  const cancelar = useCallback(
    async (id: string, motivo: string) => {
      const chave = `${scope}:cancelar:${id}`;
      const out = await run<CtPuxadaCancelamentoResult>({
        operation: "PUXADA_CANCELAR",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => cancelarPuxada(id, motivo, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope],
  );

  return {
    rascunho,
    setRascunho,
    puxadaPersistida: estado.data ?? null,
    recarregar: estado.refetch,
    isLoading: estado.isLoading,
    error: estado.error,
    salvar,
    programar,
    cancelar,
    getAttempt,
    limparEscopo: clearScope,
    scope,
  };
};

export default useCtPuxadaEdicao;
