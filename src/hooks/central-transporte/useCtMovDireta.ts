/**
 * CT-4 — Estado da Movimentação Direta (planejamento sem solicitação).
 *
 * Leituras autoritativas (RPC) e escritas idempotentes via useCtOperation:
 * o request_id é estável por chave material, então repetir a mesma tentativa
 * nunca duplica viagem, parada ou movimentação.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";
import {
  cancelarMovDireta,
  fetchAtivosMovimentacao,
  fetchMovDiretaEstado,
  fetchMovDiretas,
  programarMovDireta,
  salvarRascunhoMovDireta,
} from "@/services/ctMovDiretaService";
import { rascunhoVazio } from "@/lib/central-transporte/movDiretaRascunho";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";
import type {
  CtMovDiretaComandoResult,
  CtMovDiretaRascunho,
} from "@/types/centralTransporteMovDireta";

export const CT4_PREFIX = "ct4";

/** Listagem das movimentações diretas (aba da Central). */
export const useCtMovDiretas = (status: string | null = null, enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: [CT4_PREFIX, "listar", status],
    staleTime: 30 * 1000,
    queryFn: () => fetchMovDiretas(status),
  });
  return {
    viagens: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Ativos elegíveis (a elegibilidade é sempre do servidor). */
export const useCtAtivosMovimentacao = (termo: string | null = null, enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: [CT4_PREFIX, "ativos", termo ?? ""],
    staleTime: 30 * 1000,
    /* Mantém a lista anterior visível enquanto a busca por termo refaz a consulta. */
    placeholderData: (prev) => prev,
    queryFn: () => fetchAtivosMovimentacao(termo),
  });
  return {
    ativos: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};


/** Hidrata o rascunho persistido devolvido pelo servidor. */
export const hidratarRascunho = (v: CtOrdemMotorista): CtMovDiretaRascunho => ({
  viagemId: v.id,
  codigo: v.codigo || null,
  modalidade: v.modalidade,
  tipoTransporte: v.tipoTransporte,
  motoristaId: v.motoristaId,
  motoristaNome: v.motoristaNome ?? "",
  veiculoTransportadorId: v.veiculoTransportadorId,
  placaTransportador: v.placaTransportador ?? "",
  empresaTransportadoraId: v.empresaTransportadoraId,
  dataPrevistaSaida: v.dataPrevistaSaida ?? "",
  origemCentroCustoId: v.origemCentroCustoId,
  origemEndereco: v.origemEndereco ?? "",
  origemPontoExato: v.origemPontoExato ?? "",
  origemLatitude: v.origemLatitude,
  origemLongitude: v.origemLongitude,
  observacoes: v.observacoes ?? "",
  paradas: v.paradas.map((p) => ({
    chaveLocal: p.id,
    centroCustoId: p.centroCustoId,
    endereco: p.endereco ?? "",
    pontoExato: p.pontoExato ?? "",
    latitude: p.latitude,
    longitude: p.longitude,
    dataPrevista: p.dataPrevista ?? "",
    horaPrevista: p.horaPrevista ?? "",
    observacao: p.observacao ?? "",
    recebedorPrevistoFuncionarioId: p.recebedorPrevistoFuncionarioId,
    recebedorPrevistoNome: p.recebedorPrevistoNome ?? "",
    equipamentos: p.cargas.map((c) => c.equipamentoId),
  })),
  /* Projeção derivada: os participantes são exatamente os ativos das paradas. */
  ativosPlanejados: Array.from(
    new Set(v.paradas.flatMap((p) => p.cargas.map((c) => c.equipamentoId))),
  ),
  /* Snapshot autoritativo da rota já persistida (nada é recalculado aqui). */
  rotaPlanejada:
    v.distanciaRotaKm !== null
      ? {
          distanciaKm: v.distanciaRotaKm,
          duracaoMin: v.duracaoRotaMin,
          resumo: v.rotaResumo,
          geometria: v.rotaGeometria,
        }
      : null,
});


export interface UseCtMovDiretaEdicaoParams {
  viagemId?: string | null;
}

export const useCtMovDiretaEdicao = ({ viagemId = null }: UseCtMovDiretaEdicaoParams) => {
  const qc = useQueryClient();
  const { run, getAttempt, clearScope } = useCtOperation();
  const [rascunho, setRascunho] = useState<CtMovDiretaRascunho>(() => rascunhoVazio());
  const scope = useMemo(() => `ct4:${viagemId ?? "novo"}`, [viagemId]);

  const estado = useQuery({
    enabled: !!viagemId,
    queryKey: [CT4_PREFIX, "estado", viagemId],
    queryFn: () => fetchMovDiretaEstado(viagemId as string),
  });

  /* Hidratação autoritativa: o servidor é a única fonte do que está salvo. */
  useEffect(() => {
    if (estado.data) setRascunho(hidratarRascunho(estado.data));
  }, [estado.data]);

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: [CT4_PREFIX] });
    qc.invalidateQueries({ queryKey: ["ct3d", "minhas-ordens"] });
    qc.invalidateQueries({ queryKey: ["ct3e", "ordens-todas"] });
  }, [qc]);

  /**
   * `snapshot` permite gravar o rascunho recém-composto (ex.: com a rota da
   * Directions API) no mesmo tick, sem depender do re-render do estado.
   */
  const salvar = useCallback(
    async (snapshot?: CtMovDiretaRascunho) => {
      const alvo = snapshot ?? rascunho;
      const chave = `${scope}:rascunho`;
      const out = await run<CtMovDiretaComandoResult>({
        operation: "MOV_DIRETA_RASCUNHO",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => salvarRascunhoMovDireta(alvo, requestId),
      });
      if (out.status === "ok") {
        setRascunho({ ...alvo, viagemId: out.data.viagemId });
        invalidar();
      }
      return out;
    },
    [invalidar, rascunho, run, scope],
  );


  const programar = useCallback(
    async (idViagem: string) => {
      const chave = `${scope}:programar:${idViagem}`;
      const out = await run({
        operation: "MOV_DIRETA_PROGRAMAR",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => programarMovDireta(idViagem, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope],
  );

  const cancelar = useCallback(
    async (idViagem: string, motivo: string) => {
      const chave = `${scope}:cancelar:${idViagem}`;
      const out = await run({
        operation: "MOV_DIRETA_CANCELAR",
        materialKey: chave,
        resourceIds: [chave],
        scope,
        exec: (requestId) => cancelarMovDireta(idViagem, motivo, requestId),
      });
      if (out.status === "ok") invalidar();
      return out;
    },
    [invalidar, run, scope],
  );

  return {
    rascunho,
    setRascunho,
    viagemPersistida: estado.data ?? null,
    /** Reidrata o estado autoritativo (usado após erro de concorrência). */
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

export default useCtMovDiretaEdicao;
