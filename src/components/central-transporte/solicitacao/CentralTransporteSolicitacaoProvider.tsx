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
  useEffect,
  useMemo,
  useRef,
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
import { useToast } from "@/hooks/use-toast";
import {
  chaveMaterialRascunho,
  criarViagemVazia,
  hidratarRascunho,
  sugerirModalidade,
  validarProgramacao,
  validarRascunho,
  type ProblemaRascunho,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import { salvarRascunhoMobilizacao } from "@/services/centralTransporteMobilizacaoService";
import type { CtViagemRascunho } from "@/types/centralTransporteMobilizacao";

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

/** CT-3D.2 — estado visual do autosave do rascunho de mobilização. */
export type CtSaveStatus = "IDLE" | "DIRTY" | "SAVING" | "CONFIRMING" | "SAVED" | "ERROR";

/**
 * CT-3D.2 — rascunho de mobilização elevado ao provider: sobrevive à troca de
 * etapa, é salvo automaticamente antes de abrir a Revisão e a Revisão sempre
 * lê a versão persistida devolvida pelo servidor.
 */
export interface CtMobilizacaoDraftApi {
  viagens: CtViagemRascunho[];
  setViagens: (updater: (atual: CtViagemRascunho[]) => CtViagemRascunho[]) => void;
  dirty: boolean;
  status: CtSaveStatus;
  salvoEm: string | null;
  mensagemErro: string | null;
  salvando: boolean;
  operacaoPendente: boolean;
  /** CT-3D.5 — resolução da pendência em curso. */
  resolvendoPendencia: boolean;
  somenteLeitura: boolean;
  temPlanejamentoPersistido: boolean;
  problemasRascunho: ProblemaRascunho[];
  problemasProgramacao: ProblemaRascunho[];
  /** Salva o rascunho no servidor. Retorna true quando a versão foi persistida. */
  salvar: () => Promise<boolean>;
  confirmarSalvamento: () => Promise<boolean>;
  /**
   * CT-3D.5 — reconcilia a tentativa pendente com o estado do servidor:
   * repete uma única vez quando há payload reproduzível, e em qualquer outro
   * caso limpa a pendência (o banner nunca fica permanente).
   */
  resolverOperacaoPendente: () => Promise<void>;
  /** Descarta o estado local e re-hidrata a partir do servidor. */
  ressincronizar: () => void;

  /** CT-3D.5 — chave local da viagem em edição no formulário único. */
  chaveSelecionada: string | null;
  selecionarViagem: (chaveLocal: string | null) => void;
  /**
   * CT-3D.5 — seleciona o ativo: carrega a viagem persistida/local que o contém
   * ou cria um novo planejamento local (sem gravar nada no banco).
   */
  selecionarAtivo: (atendimentoId: string) => void;
}


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

  /** CT-3D.2 — rascunho de mobilização compartilhado entre Mobilização e Revisão. */
  mobilizacaoDraft: CtMobilizacaoDraftApi;

  /** CT-3D.2 — etapas com trilha visual concluída (dado material, não índice). */
  etapasConcluidas: CtEtapa[];

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


  /* ---------------- CT-3D.2 — rascunho de mobilização compartilhado ---------------- */
  const { toast } = useToast();
  const estadoMob = mobilizacao.estado;
  const rascunhoServidor = mobilizacao.rascunhoEmEdicao;
  const vigenteServidor = mobilizacao.planejamentoVigente;

  const [draftViagens, setDraftViagens] = useState<CtViagemRascunho[]>([]);
  const [draftAssinatura, setDraftAssinatura] = useState<string>("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftStatus, setDraftStatus] = useState<CtSaveStatus>("IDLE");
  const [draftSalvoEm, setDraftSalvoEm] = useState<string | null>(null);
  const [draftErro, setDraftErro] = useState<string | null>(null);
  const salvandoRef = useRef(false);
  const tentativaIncertaRef = useRef<string | null>(null);
  const repeticaoAutomaticaRef = useRef<string | null>(null);
  const salvarDraftRef = useRef<(() => Promise<boolean>) | null>(null);
  // CT-3D.5 — escopo do bloqueio de idempotência: nunca atravessa a Mobilização.
  const escopoMobilizacao = `CT3_MOBILIZACAO|${solicitacaoId}`;
  const resolvendoRef = useRef(false);
  const [resolvendoPendencia, setResolvendoPendencia] = useState(false);
  const [chaveSelecionada, setChaveSelecionada] = useState<string | null>(null);

  // Assinatura material da versão em foco no servidor: qualquer troca re-hidrata.
  const assinaturaServidor = `${rascunhoServidor?.id ?? "-"}:${
    rascunhoServidor?.lockVersion ?? -1
  }:${vigenteServidor?.id ?? "-"}:${vigenteServidor?.lockVersion ?? -1}`;

  useEffect(() => {
    if (!estadoMob) return;
    if (draftAssinatura === assinaturaServidor) return;
    // CT-3D.4 — hidratação autoritativa: o servidor manda, exceto quando há
    // edição local não salva (evita perder digitação em refetch de fundo).
    if (draftDirty && draftAssinatura !== "") return;
    setDraftViagens(hidratarRascunho(estadoMob));
    setDraftAssinatura(assinaturaServidor);
    setDraftDirty(false);
    setDraftErro(null);
    setDraftStatus((anterior) =>
      anterior === "SAVING" || anterior === "SAVED" ? "SAVED" : "IDLE",
    );
  }, [estadoMob, assinaturaServidor, draftAssinatura, draftDirty]);


  const setViagensDraft = useCallback(
    (updater: (atual: CtViagemRascunho[]) => CtViagemRascunho[]) => {
      setDraftViagens((atual) => updater(atual));
      setDraftDirty(true);
      setDraftErro(null);
      setDraftStatus("DIRTY");
    },
    [],
  );

  const somenteLeituraMob =
    !capabilities.canEditar || (!rascunhoServidor && !!vigenteServidor);
  const temPlanejamentoPersistido = !!rascunhoServidor || !!vigenteServidor;

  const problemasRascunho = useMemo(() => validarRascunho(draftViagens), [draftViagens]);
  const problemasProgramacao = useMemo(
    () => validarProgramacao(draftViagens, estadoMob?.ativos ?? []),
    [draftViagens, estadoMob],
  );

  const salvarRascunhoDraft = useCallback(async (): Promise<boolean> => {
    if (somenteLeituraMob || salvandoRef.current) return false;
    if (problemasRascunho.length > 0) {
      setDraftStatus("ERROR");
      setDraftErro(problemasRascunho[0].mensagem);
      toast({
        title: "Rascunho incompleto",
        description: problemasRascunho[0].mensagem,
        variant: "destructive",
      });
      return false;
    }

    salvandoRef.current = true;
    const materialKey = chaveMaterialRascunho(solicitacaoId, draftViagens);
    setDraftStatus(tentativaIncertaRef.current === materialKey ? "CONFIRMING" : "SAVING");
    const out = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey,
      scope: escopoMobilizacao,
      resourceIds: draftViagens.flatMap((v) => v.atendimentoIds),
      exec: (requestId) =>
        salvarRascunhoMobilizacao({
          solicitacaoId,
          planejamentoId: rascunhoServidor?.id ?? null,
          versaoEsperada: rascunhoServidor?.lockVersion ?? null,
          viagens: draftViagens,
          requestId,
        }),
    });
    salvandoRef.current = false;

    if (out.status === "ok") {
      tentativaIncertaRef.current = null;
      repeticaoAutomaticaRef.current = null;
      // CT-3D.5 — nenhuma tentativa antiga do escopo pode sobreviver a um sucesso.
      ctOperation.clearScope(escopoMobilizacao);
      await invalidarCachesAtivosOperacionais(queryClient);
      const atualizado = await mobilizacao.refetch();
      // Força re-hidratação pela versão autoritativa devolvida pelo servidor.
      setDraftAssinatura("");
      if (atualizado.data) setDraftViagens(hidratarRascunho(atualizado.data));
      setDraftDirty(false);
      setDraftSalvoEm(new Date().toISOString());
      setDraftStatus("SAVED");
      toast({
        title: out.data.noChange
          ? "Nenhuma alteração a salvar"
          : out.replay
            ? "Rascunho já salvo"
            : "Rascunho salvo",
        description: `Versão ${out.data.versao} do planejamento atualizada.`,
      });
      return true;
    }

    if (out.status === "uncertain") {
      // Somente rede/timeout realmente inconclusivo preserva a tentativa.
      tentativaIncertaRef.current = materialKey;
      setDraftStatus("CONFIRMING");
      if (repeticaoAutomaticaRef.current !== materialKey) {
        repeticaoAutomaticaRef.current = materialKey;
        window.setTimeout(() => void salvarDraftRef.current?.(), 0);
      }
    } else {
      // CT-3D.5 — erro determinístico: nada foi aplicado; libera imediatamente.
      tentativaIncertaRef.current = null;
      repeticaoAutomaticaRef.current = null;
      ctOperation.clearScope(escopoMobilizacao);
      setDraftStatus("ERROR");
    }
    setDraftErro(out.error.message);
    toast({
      title: out.status === "uncertain" ? "Operação sem confirmação" : "Não foi possível salvar",
      description: out.error.message,
      variant: "destructive",
    });
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    somenteLeituraMob,
    problemasRascunho,
    draftViagens,
    solicitacaoId,
    rascunhoServidor,
    ctOperation,
    escopoMobilizacao,
    queryClient,
    toast,
  ]);
  salvarDraftRef.current = salvarRascunhoDraft;

  const ressincronizarDraft = useCallback(() => {
    setDraftAssinatura("");
    setDraftDirty(false);
    setDraftErro(null);
    setDraftStatus("IDLE");
  }, []);

  /**
   * CT-3D.5 — resolução material da pendência:
   *  1. recarrega o estado autoritativo do servidor;
   *  2. quando existe tentativa incerta reproduzível (mesmo payload material),
   *     repete UMA vez com o mesmo request_id (replay idempotente);
   *  3. em qualquer outro caso (tentativa legada, sem payload, erro
   *     determinístico) a pendência é limpa e a página é desbloqueada.
   */
  const resolverOperacaoPendente = useCallback(async (): Promise<void> => {
    if (resolvendoRef.current) return;
    resolvendoRef.current = true;
    setResolvendoPendencia(true);
    try {
      const atualizado = await mobilizacao.refetch();
      const pendente = ctOperation.uncertainInScope(escopoMobilizacao);
      const materialKeyAtual = chaveMaterialRascunho(solicitacaoId, draftViagens);
      const reproduzivel =
        !!pendente && pendente.materialKey === materialKeyAtual && draftViagens.length > 0;

      if (!reproduzivel) {
        // Classes B/D/E — nada aplicável a repetir: limpar e desbloquear.
        ctOperation.clearScope(escopoMobilizacao);
        tentativaIncertaRef.current = null;
        repeticaoAutomaticaRef.current = null;
        setDraftAssinatura("");
        if (atualizado.data) setDraftViagens(hidratarRascunho(atualizado.data));
        setDraftDirty(false);
        setDraftErro(null);
        setDraftStatus(atualizado.data ? "IDLE" : "IDLE");
        toast({
          title: "Operação pendente resolvida",
          description:
            "Nenhum comando ficou aplicado no servidor. O planejamento pode ser salvo normalmente.",
        });
        return;
      }

      // Classe C — replay idempotente com o mesmo request_id e mesmo payload.
      repeticaoAutomaticaRef.current = materialKeyAtual;
      const ok = await salvarRascunhoDraft();
      if (!ok && ctOperation.uncertainInScope(escopoMobilizacao)) {
        setDraftErro(
          "A confirmação não voltou do servidor. Tente resolver novamente em instantes.",
        );
      }
    } finally {
      resolvendoRef.current = false;
      setResolvendoPendencia(false);
    }
  }, [
    ctOperation,
    escopoMobilizacao,
    solicitacaoId,
    draftViagens,
    mobilizacao,
    salvarRascunhoDraft,
    toast,
  ]);

  /* ------------- CT-3D.5 — seleção do formulário único ------------- */
  const indiceDraft = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of draftViagens) {
      for (const at of v.atendimentoIds) if (!m.has(at)) m.set(at, v.chaveLocal);
    }
    return m;
  }, [draftViagens]);

  const selecionarViagem = useCallback((chaveLocal: string | null) => {
    setChaveSelecionada(chaveLocal);
  }, []);

  const selecionarAtivo = useCallback(
    (atendimentoId: string) => {
      const existente = indiceDraft.get(atendimentoId);
      if (existente) {
        setChaveSelecionada(existente);
        return;
      }
      const ativo = (estadoMob?.ativos ?? []).find((a) => a.atendimentoId === atendimentoId);
      const nova = criarViagemVazia({
        modalidade: ativo ? sugerirModalidade(ativo) : null,
        origemCentroCustoId: ativo?.centroCustoAtualId ?? null,
        destinoCentroCustoId: solicitacao?.centro_custo_id ?? null,
        atendimentoIds: [atendimentoId],
      });
      setDraftViagens((atual) => [...atual, nova]);
      setDraftDirty(true);
      setDraftStatus("DIRTY");
      setChaveSelecionada(nova.chaveLocal);
    },
    [indiceDraft, estadoMob, solicitacao],
  );

  // Mantém sempre uma viagem em foco: primeira existente ou nenhuma.
  useEffect(() => {
    if (chaveSelecionada && draftViagens.some((v) => v.chaveLocal === chaveSelecionada)) return;
    setChaveSelecionada(draftViagens[0]?.chaveLocal ?? null);
  }, [draftViagens, chaveSelecionada]);

  const mobilizacaoDraft: CtMobilizacaoDraftApi = {
    viagens: draftViagens,
    setViagens: setViagensDraft,
    dirty: draftDirty,
    status: draftStatus,
    salvoEm: draftSalvoEm,
    mensagemErro: draftErro,
    salvando: draftStatus === "SAVING",
    // CT-3D.5 — pendência real = tentativa incerta viva NESTE escopo.
    operacaoPendente: !!ctOperation.uncertainInScope(escopoMobilizacao),
    resolvendoPendencia,
    somenteLeitura: somenteLeituraMob,
    temPlanejamentoPersistido,
    problemasRascunho,
    problemasProgramacao,
    salvar: salvarRascunhoDraft,
    confirmarSalvamento: salvarRascunhoDraft,
    resolverOperacaoPendente,
    ressincronizar: ressincronizarDraft,
    chaveSelecionada,
    selecionarViagem,
    selecionarAtivo,
  };


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

  /**
   * CT-3D.2 — trilha visual por dado material:
   *  - ITENS concluída quando há itens na solicitação;
   *  - SELECAO concluída quando existe ao menos um ativo reservado/comprometido;
   *  - MOBILIZACAO concluída quando há planejamento persistido com viagens;
   *  - REVISAO concluída quando o planejamento vigente está PROGRAMADO.
   */
  const etapasConcluidas = useMemo<CtEtapa[]>(() => {
    const out: CtEtapa[] = [];
    if (itens.length > 0) out.push("ITENS");
    if ((estadoMob?.ativos ?? []).length > 0) out.push("SELECAO");
    const planejamentoFoco = rascunhoServidor ?? vigenteServidor;
    if (planejamentoFoco && (planejamentoFoco.viagens?.length ?? 0) > 0) out.push("MOBILIZACAO");
    if (vigenteServidor?.status === "PROGRAMADO") out.push("REVISAO");
    return out;
  }, [itens, estadoMob, rascunhoServidor, vigenteServidor]);

  const irParaEtapa = useCallback(
    (proxima: CtEtapa) => {
      if (ETAPAS_BLOQUEADAS.includes(proxima)) return;
      const precisaAutosave =
        proxima === "REVISAO" &&
        !somenteLeituraMob &&
        (draftDirty || (!temPlanejamentoPersistido && draftViagens.length > 0));

      if (precisaAutosave) {
        void (async () => {
          const ok = await salvarRascunhoDraft();
          if (ok) setEtapa("REVISAO");
        })();
        return;
      }
      setEtapa(proxima);
    },
    [
      somenteLeituraMob,
      draftDirty,
      draftViagens,
      temPlanejamentoPersistido,
      salvarRascunhoDraft,
    ],
  );

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
    mobilizacaoDraft,
    etapasConcluidas,

    etapa,
    irParaEtapa,
    onOperacaoConcluida,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export default CentralTransporteSolicitacaoProvider;
