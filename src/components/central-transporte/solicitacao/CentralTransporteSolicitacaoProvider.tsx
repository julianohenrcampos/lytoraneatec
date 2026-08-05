/**
 * CT-3B — Provider tipado da solicitação na Central do Transporte.
 *
 * Fonte única de estado da página dedicada:
 *  - solicitação e itens (leitura por ID);
 *  - atendimentos + contadores por item (fn_ct_atendimento_listar);
 *  - candidatos do item selecionado (análise CT-1);
 *  - estado efetivo dos ativos (fn_ct_estado_efetivo_lote, janela null/null);
 *  - capabilities RBAC;
 *  - motor de idempotência (useCtOperation) montado ACIMA do stepper, para
 *    sobreviver à troca de item e de etapa;
 *  - invalidação de caches após qualquer operação.
 *
 * Nenhum contador é calculado no frontend. Nenhum request_id em storage.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAnaliseOperacional,
  fetchSolicitacaoTransporteById,
  type AnaliseOperacional,
  type SolicitacaoTransporte,
} from "@/services/centralTransporteService";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import useAtendimentosSolicitacaoCompleta from "@/hooks/central-transporte/useAtendimentosSolicitacaoCompleta";
import useCentralTransporteCapabilities, {
  type CentralTransporteCapabilities,
} from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import useCtOperation, { type CtOperationApi } from "@/hooks/central-transporte/useCtOperation";
import useEstadoEfetivoAtivos from "@/hooks/central-transporte/useEstadoEfetivoAtivos";
import useCtMobilizacao from "@/hooks/central-transporte/useCtMobilizacao";
import { invalidarCachesAtivosOperacionais } from "@/lib/queryInvalidation/ativosOperacionais";

import type {
  CtAtendimento,
  CtContadores,
  CtItemComAtendimentos,
} from "@/types/centralTransporteCT2";
import type {
  CtEstadoConsultaStatus,
  CtEstadoEfetivoMap,
} from "@/types/centralTransporteEstadoEfetivo";

/** CT-3C — recorte do hook de mobilização exposto pelo provider. */
export type CtMobilizacaoApi = ReturnType<typeof useCtMobilizacao>;


export type CtEtapa = "ITENS" | "SELECAO" | "MOBILIZACAO" | "REVISAO";

/**
 * CT-3C — mantido por compatibilidade de contrato com o stepper e os testes
 * herdados do CT-3B. Nenhuma etapa é bloqueada a partir da Fase I.
 */
export const CT3B_ETAPA_BLOQUEADA_MSG =
  "A programação de mobilização será disponibilizada na próxima fase da Central do Transporte.";


export interface CtSolicitacaoContextValue {
  solicitacaoId: string;
  solicitacao: SolicitacaoTransporte | null;
  itens: SolicitacaoItem[];
  isLoading: boolean;
  erro: unknown;
  recarregar: () => void;

  itemSelecionadoId: string | null;
  itemSelecionado: SolicitacaoItem | null;
  selecionarItem: (itemId: string | null) => void;

  resumoItens: CtItemComAtendimentos[];
  resumoDoItem: (itemId: string | null) => CtItemComAtendimentos | null;
  contadoresDoItem: (itemId: string | null) => CtContadores | null;
  contadores: CtContadores | null;
  atendimentos: CtAtendimento[];
  atendimentosLoading: boolean;

  analise: AnaliseOperacional | undefined;
  analiseLoading: boolean;
  recarregarAnalise: () => void;

  estados: CtEstadoEfetivoMap;
  estadoStatus: CtEstadoConsultaStatus;
  /** Detalhe do erro da consulta de estado efetivo (código/hint do servidor). */
  estadoErro: { code: string | null; message: string | null; hint: string | null } | null;
  recarregarEstados: () => void;

  capabilities: CentralTransporteCapabilities;
  ctOperation: CtOperationApi;

  /** CT-3C — estado de mobilização (ativos reservados, viagens, planejamento). */
  mobilizacao: CtMobilizacaoApi;

  etapa: CtEtapa;
  irParaEtapa: (etapa: CtEtapa) => void;
  onOperacaoConcluida: () => void;
}

const Ctx = createContext<CtSolicitacaoContextValue | null>(null);

export const useCtSolicitacao = (): CtSolicitacaoContextValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCtSolicitacao deve ser usado dentro do provider CT-3B.");
  return ctx;
};

/** CT-3C / Fase I — nenhuma etapa permanece bloqueada. */
export const ETAPAS_BLOQUEADAS: CtEtapa[] = [];

interface ProviderProps {
  solicitacaoId: string;
  itemInicialId?: string | null;
  children: React.ReactNode;
}


export const CentralTransporteSolicitacaoProvider: React.FC<ProviderProps> = ({
  solicitacaoId,
  itemInicialId = null,
  children,
}) => {
  const queryClient = useQueryClient();
  const capabilities = useCentralTransporteCapabilities();
  // Motor de idempotência no topo da árvore: troca de item/etapa não perde tentativa.
  const ctOperation = useCtOperation();

  const [etapa, setEtapa] = useState<CtEtapa>("ITENS");
  // URL como fonte de verdade do item selecionado (?item=<uuid>).
  // itemInicialId é apenas semente: se a URL já tem item, ela vence.
  const [searchParams, setSearchParams] = useSearchParams();
  const itemDaUrl = searchParams.get("item");
  const itemManualId = itemDaUrl ?? itemInicialId;

  const solicitacaoQuery = useQuery({
    queryKey: ["ct3b", "solicitacao", solicitacaoId],
    queryFn: () => fetchSolicitacaoTransporteById(solicitacaoId),
    enabled: !!solicitacaoId,
  });

  const solicitacao = solicitacaoQuery.data ?? null;
  const itens = useMemo(() => solicitacao?.itens ?? [], [solicitacao]);

  const atendimentosQuery = useAtendimentosSolicitacaoCompleta({
    solicitacaoId,
    enabled: !!solicitacaoId && capabilities.canVisualizar,
  });

  // CT-3B.2 — seleção EXPLÍCITA: sem ?item= válido nenhum item é escolhido,
  // nenhum candidato é carregado e nenhuma RPC de análise é chamada.
  const itemSelecionadoId = useMemo(() => {
    if (itemManualId && itens.some((i) => i.id === itemManualId)) return itemManualId;
    return null;
  }, [itemManualId, itens]);

  const itemSelecionado = useMemo(
    () => itens.find((i) => i.id === itemSelecionadoId) ?? null,
    [itens, itemSelecionadoId],
  );


  const analiseQuery = useQuery({
    enabled: !!solicitacao && !!itemSelecionado,
    queryKey: [
      "central-transporte-analise",
      itemSelecionado?.id ?? null,
      itemSelecionado?.subcategoria_id ?? null,
      itemSelecionado?.catalogo_equipamento_id ?? null,
      itemSelecionado?.catalogo_variacao_id ?? null,
      itemSelecionado?.capacidade_valor ?? null,
      itemSelecionado?.capacidade_unidade ?? null,
      solicitacao?.tipo_equipamento_id ?? null,
      itemSelecionado?.quantidade ?? solicitacao?.quantidade ?? null,
      solicitacao?.centro_custo_id ?? null,
    ],
    queryFn: (): Promise<AnaliseOperacional> =>
      fetchAnaliseOperacional({
        tipoEquipamentoId: solicitacao?.tipo_equipamento_id ?? null,
        catalogoEquipamentoId: itemSelecionado?.catalogo_equipamento_id ?? null,
        catalogoVariacaoId: itemSelecionado?.catalogo_variacao_id ?? null,
        subcategoriaId: itemSelecionado?.subcategoria_id ?? null,
        capacidadeValor: itemSelecionado?.capacidade_valor ?? null,
        capacidadeUnidade: itemSelecionado?.capacidade_unidade ?? null,
        quantidade: itemSelecionado?.quantidade ?? solicitacao?.quantidade ?? null,
        centroCustoDestinoId: solicitacao?.centro_custo_id ?? null,
      }),
  });

  const idsCandidatos = useMemo(() => {
    const a = analiseQuery.data;
    if (!a) return [] as string[];
    return [
      ...a.disponibilidadePropria,
      ...a.disponibilidadeGrupo,
      ...a.equipamentosComPrevisao,
      ...a.externoLocado,
      ...(a.naoClassificado ?? []),
    ]
      .map((x) => x.equipamento_id)
      .filter((id): id is string => !!id);
  }, [analiseQuery.data]);

  // Listagem sempre com janela null/null: exibe o compromisso REAL do ativo.
  const estadoEfetivo = useEstadoEfetivoAtivos({
    equipamentoIds: idsCandidatos,
    periodoInicio: null,
    periodoFim: null,
    enabled: idsCandidatos.length > 0,
  });

  // CT-3C — mobilização real: só é consultada quando a etapa é aberta ou quando
  // o usuário pode visualizar a Central (fail-closed no hook).
  const mobilizacao = useCtMobilizacao({
    solicitacaoId,
    enabled: !!solicitacaoId && capabilities.canVisualizar,
  });


  const selecionarItem = useCallback(
    (itemId: string | null) => {
      setSearchParams((atual) => {
        const proximo = new URLSearchParams(atual);
        if (itemId) proximo.set("item", itemId);
        else proximo.delete("item");
        return proximo;
      });
    },
    [setSearchParams],
  );



  const irParaEtapa = useCallback((proxima: CtEtapa) => {
    if (ETAPAS_BLOQUEADAS.includes(proxima)) return;
    setEtapa(proxima);
  }, []);

  const onOperacaoConcluida = useCallback(() => {
    void atendimentosQuery.refetch();
    void analiseQuery.refetch();
    void invalidarCachesAtivosOperacionais(queryClient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const value: CtSolicitacaoContextValue = {
    solicitacaoId,
    solicitacao,
    itens,
    isLoading: solicitacaoQuery.isLoading,
    erro: solicitacaoQuery.error,
    recarregar: () => void solicitacaoQuery.refetch(),

    itemSelecionadoId,
    itemSelecionado,
    selecionarItem,

    resumoItens: atendimentosQuery.itens,
    resumoDoItem: atendimentosQuery.porItem,
    contadoresDoItem: atendimentosQuery.contadoresDe,
    contadores: atendimentosQuery.contadoresDe(itemSelecionadoId),
    atendimentos: atendimentosQuery.porItem(itemSelecionadoId)?.atendimentos ?? [],
    atendimentosLoading: atendimentosQuery.isLoading,

    analise: analiseQuery.data,
    analiseLoading: analiseQuery.isLoading || analiseQuery.isFetching,
    recarregarAnalise: () => void analiseQuery.refetch(),

    estados: estadoEfetivo.estados,
    estadoStatus: estadoEfetivo.status,
    estadoErro: estadoEfetivo.errorInfo,
    recarregarEstados: () => void estadoEfetivo.refetch(),

    capabilities,
    ctOperation,

    mobilizacao,



    etapa,
    irParaEtapa,
    onOperacaoConcluida,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export default CentralTransporteSolicitacaoProvider;
