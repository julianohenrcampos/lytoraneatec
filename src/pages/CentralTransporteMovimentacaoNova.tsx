/**
 * CT-4 — Planejamento de uma Movimentação Direta (viagem sem solicitação).
 *
 * CT-4 UX — apresentação em master/detail, no mesmo padrão da etapa
 * Mobilização da Solicitação: painel lateral de ativos + card único da viagem,
 * paradas em seletor compacto (uma expandida por vez) e barra de ações sticky.
 *
 * O modelo de estado (rascunho), a validação e todos os comandos permanecem
 * exatamente os mesmos: nada é decidido no cliente, o rascunho é reconstruído
 * no servidor a cada salvamento e a programação revalida disponibilidade.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  Send,
  Truck,
} from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";

import { usePageTitle } from "@/contexts/PageTitleContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import { useCtMovDiretaEdicao } from "@/hooks/central-transporte/useCtMovDireta";
import {
  equipamentosJaAlocados,
  paradaVazia,
  validarRascunho,
} from "@/lib/central-transporte/movDiretaRascunho";
import {
  assinaturaRota,
  coordenadasRotaRascunho,
  podeCalcularRota,
  rascunhoComRotaDirections,
  rotaEstaStale,
} from "@/lib/central-transporte/rotaPlanejamento";
import { calcularRotaMultiparadas } from "@/services/ctRotaService";
import {
  ETAPAS,
  errosDaEtapa,
  indiceEtapa,
  type MovDiretaEtapa,
} from "@/lib/central-transporte/movDiretaWizardSteps";
import { fetchEstadoEfetivoAtivos } from "@/services/centralTransporteEstadoEfetivoService";
import CtFeedbackDialog from "@/components/central-transporte/operacao/CtFeedbackDialog";
import MovimentacaoBuilder from "@/components/central-transporte/mov-direta/builder/MovimentacaoBuilder";
import AjustarPontoDialog from "@/components/central-transporte/mov-direta/builder/AjustarPontoDialog";
import type { MovLocal } from "@/lib/central-transporte/movDiretaBuilder";
import EntregaParadaDialog from "@/components/central-transporte/mov-direta/builder/EntregaParadaDialog";
import CancelarPlanejamentoDialog from "@/components/central-transporte/mov-direta/CancelarPlanejamentoDialog";
import MovimentacoesMapa from "@/components/central-transporte/mov-direta/MovimentacoesMapa";
import PontoOperacionalBloco from "@/components/central-transporte/shared/PontoOperacionalBloco";
import {
  CT_MODALIDADE_LABELS,
  CT_TIPO_TRANSPORTE_LABELS,
  type CtModalidade,
  type CtOrdemCarga,
  type CtTipoTransporte,
} from "@/types/centralTransporteMobilizacao";

import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";


interface WizardProps {
  /** CT-4 Fase 3 — renderiza o wizard dentro do modal da Central (sem MainLayout). */
  embutido?: boolean;
  viagemIdProp?: string | null;
  onFechar?: () => void;
}

const CentralTransporteMovimentacaoNova: React.FC<WizardProps> = ({
  embutido = false,
  viagemIdProp = null,
  onFechar,
}) => {
  usePageTitle(embutido ? undefined : "Planejar Movimentação");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { viagemId: viagemIdRota } = useParams<{ viagemId?: string }>();
  const viagemId = viagemIdProp ?? viagemIdRota;
  /* Moldura: página completa na rota, conteúdo puro dentro do modal. */
  const Moldura = embutido ? React.Fragment : MainLayout;
  const sair = () => (onFechar ? onFechar() : navigate("/gestao-maquinas/central-transporte"));
  const capabilities = useCentralTransporteCapabilities();
  const cadastros = useCtMobilizacaoCadastros();
  const edicao = useCtMovDiretaEdicao({ viagemId: viagemId ?? null });
  const { rascunho, setRascunho } = edicao;
  const persistida = edicao.viagemPersistida;

  /**
   * Feedback central de toda ação transacional (sucesso, erro determinístico,
   * resultado incerto ou validação): modal, sempre visível onde o usuário está.
   */
  const [feedback, setFeedback] = useState<{
    tipo: "SUCESSO" | "ERRO";
    titulo: string;
    mensagem: string;
    tentarNovamente?: () => void;
    aoFechar?: () => void;
  } | null>(null);
  const [comando, setComando] = useState<"SALVAR" | "PROGRAMAR" | "CANCELAR" | null>(null);
  /** CT-4 — confirmação central do cancelamento do planejamento. */
  const [cancelarAberto, setCancelarAberto] = useState(false);
  /** CT-4 UX — wizard paginado: apenas UMA etapa montada por vez. */
  const [etapa, setEtapa] = useState<MovDiretaEtapa>("MONTAGEM");
  /** Dialog central do ponto de coleta (origem) — antiga etapa "Origem". */
  const [pontoOrigemAberto, setPontoOrigemAberto] = useState(false);
  const [paradaSelecionada, setParadaSelecionada] = useState<string | null>(null);
  const [entregaAberta, setEntregaAberta] = useState(false);
  /** Dados de catálogo dos ativos escolhidos nas paradas nesta sessão. */
  const [catalogoEscolhido, setCatalogoEscolhido] = useState<
    Record<string, CtAtivoMovimentacao>
  >({});

  /** Projeção derivada: união dos ativos das paradas de entrega. */
  const planejados = useMemo(
    () => Array.from(new Set(rascunho.paradas.flatMap((p) => p.equipamentos))),
    [rascunho.paradas],
  );

  /* Reidratação após F5: metadados cadastrais vêm das cargas persistidas... */
  const cargasPersistidas = useMemo(() => {
    const m = new Map<string, CtOrdemCarga>();
    (persistida?.cargas ?? []).forEach((c) => m.set(c.equipamentoId, c));
    return m;
  }, [persistida]);

  /* ...e CC atual / disponibilidade, da RPC de estado efetivo. */
  const estadoAtivos = useQuery({
    enabled: planejados.length > 0,
    queryKey: ["ct4", "estado-ativos", [...planejados].sort().join(",")],
    staleTime: 30 * 1000,
    queryFn: () => fetchEstadoEfetivoAtivos({ equipamentoIds: planejados }),
  });

  const catalogo = useMemo(() => {
    const m = new Map<string, CtAtivoMovimentacao>();
    planejados.forEach((id) => {
      const c = cargasPersistidas.get(id);
      const e = estadoAtivos.data?.get(id) ?? null;
      const ccId = e?.centroCustoId ?? null;
      m.set(id, {
        equipamentoId: id,
        frota: c?.frota ?? null,
        numeroFrota: c?.numeroFrota ?? null,
        placa: c?.placa ?? null,
        tipoAtivo: c?.tipoAtivo ?? null,
        modelo: c?.modelo ?? null,
        centroCustoId: ccId,
        centroCustoLabel: ccId
          ? cadastros.centrosCusto.find((o) => o.value === ccId)?.label ?? null
          : null,
        statusOperacional: e?.condicaoOperacional ?? "SEM_REGISTRO",
        possuiRegistro: e?.possuiRegistroOperacional ?? false,
        compromissoViagem: null,
        osManutencao: null,
        elegivel: true,
        bloqueioMotivo: null,
      });
    });
    /* O que veio do catálogo da parada é a informação mais completa: prevalece. */
    Object.values(catalogoEscolhido).forEach((a) => {
      const atual = m.get(a.equipamentoId);
      if (!m.has(a.equipamentoId) && !planejados.includes(a.equipamentoId)) return;
      m.set(a.equipamentoId, atual ? { ...atual, ...a } : a);
    });
    return m;
  }, [planejados, cargasPersistidas, estadoAtivos.data, catalogoEscolhido, cadastros.centrosCusto]);

  const carregandoAtivos = planejados.length > 0 && estadoAtivos.isLoading;

  const somenteLeitura =
    !capabilities.canCriar || (!!persistida && persistida.status !== "RASCUNHO");


  /* Movimentação já programada abre direto na revisão (somente leitura). */
  useEffect(() => {
    if (persistida && persistida.status !== "RASCUNHO") setEtapa("REVISAO");
  }, [persistida]);

  const errosRascunho = useMemo(() => validarRascunho(rascunho, "RASCUNHO"), [rascunho]);
  const errosProgramar = useMemo(() => validarRascunho(rascunho, "PROGRAMAR"), [rascunho]);

  /** Rótulo curto da parada: código do CC quando existir. */
  const rotuloParada = (indice: number): string => {
    const p = rascunho.paradas[indice];
    if (!p) return `Parada ${indice + 1}`;
    if (!p.centroCustoId) return "Sem destino";
    const opcao = cadastros.centrosCusto.find((c) => c.value === p.centroCustoId);
    return opcao?.label.split(" — ")[0] ?? "Destino";
  };

  const paradaAtual =
    rascunho.paradas.find((p) => p.chaveLocal === paradaSelecionada) ?? rascunho.paradas[0] ?? null;
  const indiceAtual = paradaAtual
    ? rascunho.paradas.findIndex((p) => p.chaveLocal === paradaAtual.chaveLocal)
    : -1;

  const alocacoes = useMemo(() => {
    const m = new Map<string, { indice: number; rotulo: string }>();
    rascunho.paradas.forEach((p, i) => {
      p.equipamentos.forEach((e) => m.set(e, { indice: i, rotulo: `${i + 1}ª — ${rotuloParada(i)}` }));
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho.paradas, cadastros.centrosCusto]);

  const patchParada = (chave: string, patch: Partial<CtParadaRascunho>) =>
    setRascunho((prev) => ({
      ...prev,
      paradas: prev.paradas.map((p) => (p.chaveLocal === chave ? { ...p, ...patch } : p)),
    }));

  const adicionarParada = () => {
    const nova = paradaVazia();
    setRascunho((p) => ({ ...p, paradas: [...p.paradas, nova] }));
    setParadaSelecionada(nova.chaveLocal);
  };

  /**
   * CT-4 — snapshot da rota. A geometria é SEMPRE da Directions API
   * (calcularRotaMultiparadas); nunca desenhamos/inventamos trajeto.
   * `assinaturaRotaRef` guarda os pontos já roteirizados para não repetir a
   * chamada quando o trajeto não mudou.
   */
  const assinaturaRotaRef = useRef<string | null>(null);
  const [calculandoRota, setCalculandoRota] = useState(false);

  useEffect(() => {
    if (persistida?.rotaGeometria) assinaturaRotaRef.current = assinaturaRota(rascunho);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistida?.id, persistida?.rotaGeometria]);

  /**
   * Garante rota calculada para o trajeto atual. Devolve o snapshot a gravar
   * (ou `undefined` quando nada mudou) e `false` quando o Mapbox falhou.
   */
  const garantirRota = useCallback(
    async (): Promise<
      | { ok: true; calculavel: boolean; snapshot?: Pick<typeof rascunho, "rotaPlanejada"> }
      | { ok: false }
    > => {
      if (!podeCalcularRota(rascunho)) return { ok: true, calculavel: false };
      if (!rotaEstaStale(rascunho, assinaturaRotaRef.current)) {
        return { ok: true, calculavel: true };
      }
      setCalculandoRota(true);
      try {
        const pontos = coordenadasRotaRascunho(rascunho);
        const rota = await calcularRotaMultiparadas(pontos);
        const rascunhoComRota = rota ? rascunhoComRotaDirections(rascunho, rota) : null;
        if (!rota || !rascunhoComRota) {
          console.error("[CT4][ROTA][FALHA]", { pontos: pontos.length });
          return { ok: false };
        }
        const snapshot = {
          rotaPlanejada: rascunhoComRota.rotaPlanejada,
        };
        assinaturaRotaRef.current = assinaturaRota(rascunho);
        setRascunho((prev) => ({ ...prev, ...snapshot }));
        /* O snapshot volta explicitamente: o save NÃO depende do setState. */
        return { ok: true, calculavel: true, snapshot };
      } finally {
        setCalculandoRota(false);
      }
    },
    [rascunho, setRascunho],
  );

  /* Ao entrar na Revisão, calcula a rota para exibir distância/duração reais. */
  useEffect(() => {
    if (etapa !== "REVISAO" || somenteLeitura) return;
    void garantirRota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  const feedbackRotaFalhou = () =>
    setFeedback({
      tipo: "ERRO",
      titulo: "Não foi possível calcular a rota",
      mensagem:
        "Os pontos de coleta e entrega estão preenchidos, mas não foi possível obter o " +
        "trajeto rodoviário agora. Tente novamente antes de programar a movimentação.",
      tentarNovamente: () => void programarRef.current?.(),
    });

  /* Ref evita dependência circular entre o feedback e `programar`. */
  const programarRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Mapa da revisão: mostra EXATAMENTE a rota do rascunho (a mesma que será
   * persistida), com os metadados da viagem persistida quando existirem.
   */
  const viagemRevisao = useMemo(() => {
    const snap = rascunho.rotaPlanejada;
    if (persistida) {
      return snap
        ? {
            ...persistida,
            distanciaRotaKm: snap.distanciaKm,
            duracaoRotaMin: snap.duracaoMin,
            rotaResumo: snap.resumo,
            rotaGeometria: snap.geometria,
          }
        : persistida;
    }
    if (!snap) return null;
    return {
      id: "ct4-revisao-local",
      codigo: "Prévia",
      status: "RASCUNHO" as const,
      dataOrdem: null,
      dataPrevistaSaida: rascunho.dataPrevistaSaida || null,
      dataPrevistaEntrega: null,
      modalidade: rascunho.modalidade,
      tipoTransporte: rascunho.tipoTransporte,
      motoristaNome: rascunho.motoristaNome || null,
      motoristaId: rascunho.motoristaId,
      veiculoTransportadorId: rascunho.veiculoTransportadorId,
      empresaTransportadoraId: rascunho.empresaTransportadoraId,
      origemCentroCustoId: rascunho.origemCentroCustoId,
      placaTransportador: rascunho.placaTransportador || null,
      empresaTransportadora: null,
      origemCentroCusto: null,
      origemEndereco: rascunho.origemEndereco || null,
      origemPontoExato: rascunho.origemPontoExato || null,
      origemLatitude: rascunho.origemLatitude,
      origemLongitude: rascunho.origemLongitude,
      destinoCentroCusto: null,
      destinoEndereco: null,
      destinoPontoExato: null,
      destinoLatitude: null,
      destinoLongitude: null,
      distanciaKm: null,
      distanciaRotaKm: snap.distanciaKm,
      duracaoRotaMin: snap.duracaoMin,
      rotaResumo: snap.resumo,
      rotaGeometria: snap.geometria,
      recebedorPrevistoNome: null,
      recebedorPrevistoTelefone: null,
      observacoes: rascunho.observacoes || null,
      cargas: [],
      origemFluxo: "MOVIMENTACAO_DIRETA" as const,
      solicitacaoId: null,
      paradas: rascunho.paradas.map((p, indice) => ({
        id: p.chaveLocal,
        ordem: indice + 1,
        status: "PENDENTE" as const,
        centroCustoId: p.centroCustoId,
        ccCodigo: null,
        ccNome: null,
        endereco: p.endereco || null,
        pontoExato: p.pontoExato || null,
        latitude: p.latitude,
        longitude: p.longitude,
        dataPrevista: p.dataPrevista || null,
        horaPrevista: p.horaPrevista || null,
        observacao: p.observacao || null,
        recebedorPrevistoFuncionarioId: p.recebedorPrevistoFuncionarioId,
        recebedorPrevistoNome: p.recebedorPrevistoNome || null,
        chegadaRegistradaEm: null,
        concluidaEm: null,
        cargas: p.equipamentos.map((equipamentoId) => ({
          movimentacaoId: null,
          statusMovimentacao: null,
          equipamentoId,
          frota: catalogo.get(equipamentoId)?.frota ?? null,
          numeroFrota: catalogo.get(equipamentoId)?.numeroFrota ?? null,
          placa: catalogo.get(equipamentoId)?.placa ?? null,
          tipoAtivo: catalogo.get(equipamentoId)?.tipoAtivo ?? null,
          modelo: catalogo.get(equipamentoId)?.modelo ?? null,
        })),
      })),
    };
  }, [catalogo, persistida, rascunho]);

  /**
   * Salvar rascunho. `silencioso` evita dois modais quando o salvamento é
   * apenas a primeira etapa da programação.
   */
  const salvar = async (
    silencioso = false,
    snapshotRota?: Pick<typeof rascunho, "rotaPlanejada">,
  ): Promise<string | null> => {
    setFeedback(null);
    if (errosRascunho.length > 0) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Revise o planejamento",
        mensagem: errosRascunho[0],
      });
      return null;
    }
    /* Rascunho pode existir sem rota; o usuário é informado com honestidade. */
    const rota = snapshotRota
      ? { ok: true as const, calculavel: true, snapshot: snapshotRota }
      : await garantirRota();
    const rascunhoParaSalvar = rota.ok && rota.snapshot
      ? { ...rascunho, ...rota.snapshot }
      : rascunho;
    setComando("SALVAR");
    try {
      const out = await edicao.salvar(rascunhoParaSalvar);
      if (out.status === "ok") {
        if (!silencioso) {
          setFeedback({
            tipo: "SUCESSO",
            titulo: "Rascunho salvo",
            mensagem: rota.ok
              ? "O planejamento da movimentação foi gravado no servidor."
              : "Rascunho salvo, mas a rota ainda não pôde ser calculada.",
          });
        }
        return out.data.viagemId;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Rascunho não salvo",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "A operação não foi confirmada. Repita a mesma tentativa — nada será duplicado.",
        tentarNovamente: () => void salvar(),
      });
      return null;
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Rascunho não salvo",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
        tentarNovamente: () => void salvar(),
      });
      return null;
    } finally {
      setComando(null);
    }
  };

  const programar = async () => {
    setFeedback(null);
    if (errosProgramar.length > 0) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Ainda não é possível programar",
        mensagem: errosProgramar[0],
      });
      return;
    }
    /* Programar exige rota real quando o trajeto está completo. */
    const rota = await garantirRota();
    if (!rota.ok) {
      feedbackRotaFalhou();
      return;
    }
    const id = await salvar(true, rota.snapshot);
    if (!id) return;
    setComando("PROGRAMAR");
    try {
      const out = await edicao.programar(id);
      if (out.status === "ok") {
        setFeedback({
          tipo: "SUCESSO",
          titulo: "Movimentação programada",
          mensagem: "A ordem já aparece para o motorista em Minhas Mobilizações.",
          aoFechar: () => sair(),
        });
        return;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Movimentação não programada",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "A programação não foi confirmada. Repita a mesma tentativa — nada será duplicado.",
        tentarNovamente: () => void programar(),
      });
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Movimentação não programada",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
        tentarNovamente: () => void programar(),
      });
    } finally {
      setComando(null);
    }
  };

  /**
   * Cancelar planejamento. Só existe para movimentações já persistidas em
   * RASCUNHO/PROGRAMADA — e o servidor revalida (concorrência: se o transporte
   * iniciou nesse meio-tempo, a RPC recusa e nós reidratamos o estado).
   */
  const podeCancelarPlanejamento =
    !!persistida &&
    capabilities.canCriar &&
    (persistida.status === "RASCUNHO" || persistida.status === "PROGRAMADA");

  const cancelarPlanejamento = async (motivo: string) => {
    if (!persistida) return;
    setFeedback(null);
    setComando("CANCELAR");
    try {
      const out = await edicao.cancelar(persistida.id, motivo);
      if (out.status === "ok") {
        setCancelarAberto(false);
        setFeedback({
          tipo: "SUCESSO",
          titulo: "Planejamento cancelado",
          mensagem: `${persistida.codigo || "A movimentação"} foi cancelada com sucesso. Os compromissos associados foram liberados.`,
          aoFechar: () => sair(),
        });
        return;
      }
      setCancelarAberto(false);
      void edicao.recarregar();
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível cancelar",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "O cancelamento não foi confirmado. Atualize a movimentação e verifique o status antes de repetir.",
      });
    } catch (e) {
      setCancelarAberto(false);
      void edicao.recarregar();
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível cancelar",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      setComando(null);
    }
  };

  /** Motivo do cancelamento registrado pelo servidor nas observações. */
  const motivoCancelamento =
    persistida?.status === "CANCELADA"
      ? (persistida.observacoes ?? "")
          .split("[CANCELAMENTO]")
          .slice(1)
          .pop()
          ?.trim() || null
      : null;


  if (capabilities.isLoading || (viagemId && edicao.isLoading)) {
    return (
      <Moldura>
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Moldura>
    );
  }

  if (!capabilities.canCriar) {
    return (
      <Moldura>
        <div className="p-4">
          <Alert variant="destructive" data-testid="ct4-sem-permissao">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Sem permissão</AlertTitle>
            <AlertDescription className="text-xs">
              Seu acesso não permite planejar movimentações na Central do Transporte.
            </AlertDescription>
          </Alert>
        </div>
      </Moldura>
    );
  }

  const totalAtivos = rascunho.paradas.reduce((acc, p) => acc + p.equipamentos.length, 0);
  const transportado = rascunho.modalidade === "TRANSPORTADO";
  const terceiro = rascunho.tipoTransporte === "TERCEIRO";
  const motoristaLabel =
    cadastros.motoristas.find((m) => m.value === rascunho.motoristaId)?.label ??
    (rascunho.motoristaNome || null);
  const veiculoLabel =
    cadastros.veiculos.find((v) => v.value === rascunho.veiculoTransportadorId)?.label ?? null;
  const origemLabel = rascunho.origemCentroCustoId
    ? cadastros.centrosCusto.find((c) => c.value === rascunho.origemCentroCustoId)?.label ??
      "Origem"
    : null;

  /* Locais canônicos arrastáveis: mesmo cadastro já lido por useCtMobilizacaoCadastros. */
  const locais: MovLocal[] = cadastros.centrosCusto.map((opcao) => {
    const geo = cadastros.centrosCustoPorId[opcao.value];
    return {
      id: opcao.value,
      rotulo: opcao.label,
      endereco: geo?.endereco ?? cadastros.enderecosCentroCusto[opcao.value] ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    };
  });


  const etapaIndice = indiceEtapa(etapa);
  const errosEtapaAtual = errosDaEtapa(rascunho, etapa);

  /* Mantém o "Tentar novamente" do popup de rota apontando para o programar atual. */
  programarRef.current = programar;

  const avancar = () => {
    if (errosEtapaAtual.length > 0) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Revise esta etapa",
        mensagem: errosEtapaAtual[0],
      });
      return;
    }
    const proxima = ETAPAS[etapaIndice + 1];
    if (proxima) setEtapa(proxima.id);
  };

  const voltar = () => {
    const anterior = ETAPAS[etapaIndice - 1];
    if (anterior) setEtapa(anterior.id);
  };

  return (
    <Moldura>
      <div
        className={
          embutido
            ? "flex h-full min-h-0 flex-col"
            : "flex h-[calc(100vh-8rem)] min-h-0 flex-col"
        }
        data-testid="ct4-wizard"
        data-etapa={etapa}
      >
        {/* Header fixo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {rascunho.codigo ?? "Nova movimentação"}
            </span>
            {persistida && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {persistida?.status ?? "RASCUNHO"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {totalAtivos} ativo(s)
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {rascunho.paradas.length} parada(s)
            </Badge>
          </div>
        </div>

        {/* Stepper fixo — mesmo padrão visual do cadastro de Veículos/Equipamentos */}
        <div className="flex items-center justify-between gap-1 border-b px-4 py-3">
          {ETAPAS.map((s, i) => {
            const ativa = i === etapaIndice;
            const concluida = i < etapaIndice;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  data-testid={`ct4-step-${s.id}`}
                  onClick={() => {
                    if (i <= etapaIndice) setEtapa(s.id);
                    else avancar();
                  }}
                  className={`flex items-center gap-2 transition-colors ${
                    ativa
                      ? "text-primary"
                      : concluida
                        ? "text-primary/60"
                        : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                      ativa
                        ? "border-primary bg-primary text-primary-foreground"
                        : concluida
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-muted-foreground/30 bg-muted"
                    }`}
                  >
                    {concluida ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="hidden text-xs font-medium sm:inline">{s.label}</span>
                </button>
                {i < ETAPAS.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 flex-1 rounded ${
                      i < etapaIndice ? "bg-primary/60" : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Miolo: rola somente o conteúdo da etapa atual */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {somenteLeitura && persistida && persistida.status !== "RASCUNHO" && (
            <Alert className="mb-3" data-testid="ct4-somente-leitura">
              <AlertTitle className="text-xs">
                {persistida.status === "CANCELADA"
                  ? "Movimentação cancelada"
                  : "Movimentação já programada"}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {persistida.status === "CANCELADA"
                  ? `Este planejamento foi cancelado e é exibido apenas como histórico.${
                      motivoCancelamento ? ` Motivo: ${motivoCancelamento}` : ""
                    }`
                  : "Programações vigentes não são editadas: cancele e planeje novamente se algo mudou."}
              </AlertDescription>
            </Alert>
          )}

          {etapa === "MONTAGEM" && (
            <div data-testid="ct4-etapa-montagem">
              {carregandoAtivos ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <MovimentacaoBuilder
                  rascunho={rascunho}
                  catalogo={catalogo}
                  centrosCusto={cadastros.centrosCusto}
                  motoristas={cadastros.motoristas}
                  veiculos={cadastros.veiculos}
                  cadastrosCarregando={cadastros.isLoading}
                  somenteLeitura={somenteLeitura}
                  origemLabel={origemLabel}
                  locais={locais}
                  recebedores={cadastros.motoristas}
                  onAjustarOrigem={() => setPontoOrigemAberto(true)}
                  onChange={(proximo) => setRascunho(proximo)}
                  onConhecerAtivo={(a) =>
                    setCatalogoEscolhido((prev) => ({ ...prev, [a.equipamentoId]: a }))
                  }
                  onEditarParada={(chave) => {
                    setParadaSelecionada(chave);
                    setEntregaAberta(true);
                  }}
                />
              )}
            </div>
          )}

          {etapa === "REVISAO" && (
            <div className="space-y-4" data-testid="ct4-etapa-revisao">
              {viagemRevisao ? (
                <div className="relative h-[240px] overflow-hidden rounded-md border lg:h-[300px]">
                  <MovimentacoesMapa
                    viagens={[viagemRevisao]}
                    selecionadoId={viagemRevisao.id}
                    onSelecionar={() => undefined}
                  />
                  {calculandoRota && (
                    <div className="absolute left-2 top-2 rounded bg-background/90 px-2 py-1 text-[11px] shadow">
                      Calculando rota...
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTitle className="text-xs">
                    {calculandoRota ? "Calculando rota..." : "Rota ainda não calculada"}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    Informe a origem e a coordenada de cada parada para visualizar o trajeto.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-primary" />
                      Trajeto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-4 text-xs">
                    <p>
                      <span className="text-muted-foreground">Origem: </span>
                      {origemLabel ?? "—"}
                    </p>
                    {rascunho.paradas.map((p, i) => (
                      <p key={p.chaveLocal}>
                        <span className="text-muted-foreground">↓ {i + 1}ª parada: </span>
                        {rotuloParada(i)} · {p.equipamentos.length} ativo(s)
                      </p>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="text-sm">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 px-4 pb-4 text-xs">
                    <p>
                      <span className="text-muted-foreground">Ativos: </span>
                      {totalAtivos}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Paradas: </span>
                      {rascunho.paradas.length}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Motorista: </span>
                      {motoristaLabel ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Veículo: </span>
                      {veiculoLabel ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Distância: </span>
                      {rascunho.rotaPlanejada
                        ? `${rascunho.rotaPlanejada.distanciaKm.toFixed(1)} km`
                        : "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Duração: </span>
                      {rascunho.rotaPlanejada?.duracaoMin
                        ? `${Math.round(rascunho.rotaPlanejada.duracaoMin)} min`
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {errosProgramar.length > 0 && !somenteLeitura && (
                <Alert variant="destructive" data-testid="ct4-erro">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-xs">Pendências para programar</AlertTitle>
                  <AlertDescription className="text-xs">{errosProgramar[0]}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Footer fixo — Salvar/Programar existem SOMENTE na revisão */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            {etapa === "MONTAGEM" ? (
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={sair}>
                <ArrowLeft className="h-3.5 w-3.5" /> {embutido ? "Cancelar" : "Voltar à Central"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={voltar}
                data-testid="ct4-voltar-etapa"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
            )}
            {somenteLeitura && (
              <span className="text-[11px] text-muted-foreground">
                Modo somente leitura.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {etapa !== "REVISAO" ? (
              <Button size="sm" onClick={avancar} data-testid="ct4-proxima-etapa">
                Revisar movimentação →
              </Button>
            ) : (
              <>
                {!somenteLeitura && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={comando !== null}
                      onClick={() => void salvar()}
                      data-testid="ct4-salvar-rascunho"
                    >
                      {comando === "SALVAR" ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-4 w-4" />
                      )}
                      Salvar rascunho
                    </Button>
                    <Button
                      size="sm"
                      disabled={comando !== null}
                      onClick={() => void programar()}
                      data-testid="ct4-programar"
                    >
                      {comando === "PROGRAMAR" ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-4 w-4" />
                      )}
                      Programar movimentação
                    </Button>
                  </>
                )}
                {podeCancelarPlanejamento && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={comando !== null}
                    onClick={() => setCancelarAberto(true)}
                    data-testid="ct4-cancelar-planejamento"
                  >
                    {comando === "CANCELAR" ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="mr-1 h-4 w-4" />
                    )}
                    Cancelar planejamento
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <AjustarPontoDialog
          aberto={pontoOrigemAberto}
          centrosCusto={cadastros.centrosCusto}
          centroCustoId={rascunho.origemCentroCustoId}
          centroCustoEndereco={
            rascunho.origemCentroCustoId
              ? cadastros.enderecosCentroCusto[rascunho.origemCentroCustoId] ?? null
              : null
          }
          ponto={rascunho.origemPontoExato}
          latitude={rascunho.origemLatitude}
          longitude={rascunho.origemLongitude}
          somenteLeitura={somenteLeitura}
          onOpenChange={setPontoOrigemAberto}
          onChange={(patch) =>
            setRascunho((p) => ({
              ...p,
              ...(patch.centroCustoId !== undefined
                ? {
                    origemCentroCustoId: patch.centroCustoId,
                    origemEndereco: patch.centroCustoId
                      ? cadastros.enderecosCentroCusto[patch.centroCustoId] ?? ""
                      : "",
                  }
                : {}),
              ...(patch.ponto !== undefined ? { origemPontoExato: patch.ponto } : {}),
              ...(patch.latitude !== undefined ? { origemLatitude: patch.latitude } : {}),
              ...(patch.longitude !== undefined ? { origemLongitude: patch.longitude } : {}),
            }))
          }
        />

        <EntregaParadaDialog
          aberto={entregaAberta}
          parada={paradaAtual}
          ordem={indiceAtual + 1}
          centrosCusto={cadastros.centrosCusto}
          enderecosCentroCusto={cadastros.enderecosCentroCusto}
          funcionarios={cadastros.motoristas}
          metadadosAtivos={catalogo}
          alocadosEmOutrasParadas={
            paradaAtual
              ? new Map(
                  Array.from(alocacoes.entries()).filter(([id]) =>
                    equipamentosJaAlocados(rascunho, paradaAtual.chaveLocal).has(id),
                  ),
                )
              : new Map()
          }
          podeRemover={rascunho.paradas.length > 1}
          somenteLeitura={somenteLeitura}
          onOpenChange={(aberto) => setEntregaAberta(aberto)}
          onChange={(patch) =>
            paradaAtual ? patchParada(paradaAtual.chaveLocal, patch) : undefined
          }
          onRemover={() => {
            if (!paradaAtual) return;
            setRascunho((prev) => ({
              ...prev,
              paradas: prev.paradas.filter((x) => x.chaveLocal !== paradaAtual.chaveLocal),
            }));
            setParadaSelecionada(null);
          }}
          onConhecerAtivo={(a) =>
            setCatalogoEscolhido((prev) => ({ ...prev, [a.equipamentoId]: a }))
          }
        />

        <CancelarPlanejamentoDialog
          aberto={cancelarAberto}
          codigo={persistida?.codigo || "desta movimentação"}
          emAndamento={comando === "CANCELAR"}
          onFechar={() => setCancelarAberto(false)}
          onConfirmar={(motivo) => void cancelarPlanejamento(motivo)}
        />


        <CtFeedbackDialog
          aberto={feedback !== null}
          tipo={feedback?.tipo ?? "SUCESSO"}
          titulo={feedback?.titulo ?? ""}
          mensagem={feedback?.mensagem}
          onTentarNovamente={
            feedback?.tentarNovamente
              ? () => {
                  const repetir = feedback.tentarNovamente;
                  setFeedback(null);
                  repetir?.();
                }
              : undefined
          }
          onFechar={() => {
            const depois = feedback?.aoFechar;
            setFeedback(null);
            depois?.();
          }}
        />
      </div>
    </Moldura>
  );
};

export default CentralTransporteMovimentacaoNova;
