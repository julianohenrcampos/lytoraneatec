/**
 * CT-6 — Etapa "2. Transporte" como TRANSPORT BUILDER (canvas No-Code).
 *
 * Layout: [ativos da solicitação] · [canvas de viagens] · [recursos].
 *
 * NADA de backend novo: arrastar/clicar apenas manipula `CtViagemRascunho[]`
 * do provider. A gravação continua em `fn_ct_mobilizacao_salvar_rascunho` e a
 * programação em `fn_ct_mobilizacao_programar`, com idempotência por request_id.
 *
 * A data do planejamento é UMA (`dataProgramada`); `dataPrevistaSaida` continua
 * no contrato e é derivada dela. Endereço, mapa e campos técnicos vivem no
 * painel de detalhes, que reutiliza `ViagemCardEditor`/`ViagemEnderecosEditor`.
 */
import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  MousePointerSquareDashed,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import useCtRecebedoresDestino from "@/hooks/central-transporte/useCtRecebedoresDestino";
import {
  atribuirAtivoAViagem,
  criarViagemVazia,
  indiceAtendimentos,
  rotuloAtivo,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import {
  
  dropAceita,
  dropId,
  estadoMotorista as calcEstadoMotorista,
  estadoVeiculo as calcEstadoVeiculo,
  jaNoDestino,
  parseDragId,
  parseDropId,
  patchDataUnica,
  type CtAtivoBuilderEstado,
} from "@/lib/central-transporte/transportBuilder";
import { abrirNovaRevisaoMobilizacao } from "@/services/centralTransporteMobilizacaoService";
import {
  CT_PLANEJAMENTO_STATUS_LABELS,
  type CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";
import { formatDateBR } from "@/utils/formatDateBR";
import {
  assinaturaCcViagem,
  patchAutoEnderecoCoordenadas,
  rotuloCc,
} from "@/utils/central-transporte/autoPreencherViagem";
import AtivoBuilderCard from "./builder/AtivoBuilderCard";
import EntregaDialog from "./builder/EntregaDialog";
import RecursosBuilderPanel from "./builder/RecursosBuilderPanel";
import ViagemBuilderCard from "./builder/ViagemBuilderCard";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";
import ViagemCardEditor from "./ViagemCardEditor";

const horaBR = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

const hojeISO = (): string => new Date().toISOString().slice(0, 10);

export interface EtapaMobilizacaoProps {
  /**
   * CT-9 — rail esquerdo adicional (ATIVOS CANDIDATOS). Quando informado, o
   * Builder passa a ser o "Atendimento Builder": a seleção do ativo vive na
   * MESMA tela do planejamento de transporte.
   */
  railCandidatos?: React.ReactNode;
  /** CT-9 — faixa no topo do canvas (itens solicitados como alvos). */
  canvasTopo?: React.ReactNode;
  /** Rótulo do canvas. */
  tituloBuilder?: string;
}

export const EtapaMobilizacao: React.FC<EtapaMobilizacaoProps> = ({
  railCandidatos = null,
  canvasTopo = null,
  tituloBuilder = "Transport Builder",
}) => {
  const { toast } = useToast();
  const { mobilizacao, mobilizacaoDraft, capabilities, ctOperation, irParaEtapa, solicitacao } =
    useCtSolicitacao();

  const estado = mobilizacao.estado;
  const rascunhoServidor = mobilizacao.rascunhoEmEdicao;
  const vigente = mobilizacao.planejamentoVigente;

  const viagens = mobilizacaoDraft.viagens;
  const setViagens = mobilizacaoDraft.setViagens;
  const salvando = mobilizacaoDraft.salvando;
  const somenteLeitura = mobilizacaoDraft.somenteLeitura;
  const problemasRascunho = mobilizacaoDraft.problemasRascunho;
  const problemasProgramacao = mobilizacaoDraft.problemasProgramacao;

  const podeSalvarRascunho =
    mobilizacaoDraft.dirty ||
    (!mobilizacaoDraft.temPlanejamentoPersistido && mobilizacaoDraft.viagens.length > 0);

  const [abrindoRevisao, setAbrindoRevisao] = useState(false);
  const [dataPadrao, setDataPadrao] = useState<string>(hojeISO());
  const [concluidos, setConcluidos] = useState<Set<string>>(new Set());
  const [detalheChave, setDetalheChave] = useState<string | null>(null);
  const [entregaChave, setEntregaChave] = useState<string | null>(null);

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [painelMobile, setPainelMobile] = useState<"ATIVOS" | "RECURSOS" | "CANDIDATOS" | null>(null);

  const cadastros = useCtMobilizacaoCadastros(!!estado && capabilities.canVisualizar);

  const destinoSolicitacaoId = solicitacao?.centro_custo_id ?? null;
  const ativos = estado?.ativos ?? [];

  /** Recebedores previstos: somente funcionários ativos dos CCs destino em uso. */
  const recebedores = useCtRecebedoresDestino(
    [destinoSolicitacaoId, ...viagens.map((v) => v.destinoCentroCustoId)],
    !!estado && capabilities.canVisualizar,
  );

  const indice = useMemo(() => indiceAtendimentos(viagens), [viagens]);
  const indicePersistido = useMemo(
    () =>
      new Map(
        (rascunhoServidor?.viagens ?? vigente?.viagens ?? []).flatMap((v) =>
          v.atendimentoIds.map((id) => [id, v] as const),
        ),
      ),
    [rascunhoServidor, vigente],
  );

  const chaveSelecionada = mobilizacaoDraft.chaveSelecionada;
  const viagemSelecionada =
    viagens.find((v) => v.chaveLocal === chaveSelecionada) ?? viagens[0] ?? null;

  const rotuloViagem = (v: CtViagemRascunho, i: number): string =>
    v.codigo ?? `Viagem ${i + 1}`;
  const viagensParaMenu = viagens.map((v, i) => ({
    chaveLocal: v.chaveLocal,
    rotulo: rotuloViagem(v, i),
  }));

  const estadoAtivo = (atendimentoId: string): CtAtivoBuilderEstado => {
    const ativo = ativos.find((a) => a.atendimentoId === atendimentoId);
    if (ativo && jaNoDestino(ativo, destinoSolicitacaoId) && !indice.has(atendimentoId)) {
      return "JA_NO_DESTINO";
    }
    const persistida = indicePersistido.get(atendimentoId);
    if (persistida?.status === "PROGRAMADA") return "PROGRAMADO";
    if (persistida) return "SALVO";
    if (indice.has(atendimentoId)) return "EM_VIAGEM_NAO_SALVA";
    return "SEM_PLANEJAMENTO";
  };

  const problemasDaViagem = (chaveLocal: string): string[] =>
    problemasProgramacao.filter((p) => p.chaveLocal === chaveLocal).map((p) => p.mensagem);

  const patchViagem = (chaveLocal: string, patch: Partial<CtViagemRascunho>) =>
    setViagens((atual) =>
      atual.map((v) => (v.chaveLocal === chaveLocal ? { ...v, ...patch } : v)),
    );

  /** Autopreenchimento de endereço/coordenadas a partir do cadastro do CC. */
  const autoAplicadoRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (somenteLeitura) return;
    if (Object.keys(cadastros.centrosCustoPorId).length === 0) return;

    const patches: { chaveLocal: string; patch: Partial<CtViagemRascunho> }[] = [];
    for (const v of viagens) {
      const chave = `${v.chaveLocal}|${assinaturaCcViagem(v)}`;
      if (autoAplicadoRef.current.has(chave)) continue;
      autoAplicadoRef.current.add(chave);
      const patch = patchAutoEnderecoCoordenadas(v, cadastros.centrosCustoPorId);
      if (patch) patches.push({ chaveLocal: v.chaveLocal, patch });
    }
    if (patches.length === 0) return;

    setViagens((atual) =>
      atual.map((v) => {
        const encontrado = patches.find((p) => p.chaveLocal === v.chaveLocal);
        return encontrado ? { ...v, ...encontrado.patch } : v;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viagens, cadastros.centrosCustoPorId, somenteLeitura]);

  /* -------------------- composição do rascunho -------------------- */

  const novaViagem = (over: Partial<CtViagemRascunho> = {}): CtViagemRascunho => {
    const nova = criarViagemVazia({
      destinoCentroCustoId: destinoSolicitacaoId,
      ...patchDataUnica(dataPadrao),
      ...over,
    });
    setViagens((atual) => [...atual, nova]);
    mobilizacaoDraft.selecionarViagem(nova.chaveLocal);
    return nova;
  };

  const adicionarViagem = () => novaViagem();

  const removerViagem = (chaveLocal: string) => {
    setViagens((atual) => atual.filter((v) => v.chaveLocal !== chaveLocal));
    setConcluidos((atual) => {
      const proximo = new Set(atual);
      proximo.delete(chaveLocal);
      return proximo;
    });
  };

  const duplicarViagem = (chaveLocal: string) => {
    const base = viagens.find((v) => v.chaveLocal === chaveLocal);
    if (!base) return;
    novaViagem({
      modalidade: base.modalidade,
      tipoTransporte: base.tipoTransporte,
      motoristaId: base.motoristaId,
      veiculoTransportadorId: base.veiculoTransportadorId,
      empresaTransportadoraId: base.empresaTransportadoraId,
      origemCentroCustoId: base.origemCentroCustoId,
      destinoCentroCustoId: base.destinoCentroCustoId,
      ...patchDataUnica(base.dataProgramada || dataPadrao),
      atendimentoIds: [],
    });
  };

  const agrupar = (atendimentoId: string, chaveLocal: string | null) => {
    setViagens((atual) => {
      const proximas = atribuirAtivoAViagem(atual, atendimentoId, chaveLocal);
      if (!chaveLocal) return proximas;
      const ativo = ativos.find((a) => a.atendimentoId === atendimentoId);
      // Origem da viagem acompanha o CC atual do ativo quando ainda não definida.
      return proximas.map((v) =>
        v.chaveLocal === chaveLocal && !v.origemCentroCustoId && ativo?.centroCustoAtualId
          ? { ...v, origemCentroCustoId: ativo.centroCustoAtualId }
          : v,
      );
    });
    if (chaveLocal) mobilizacaoDraft.selecionarViagem(chaveLocal);
  };

  /** Ativo solto no canvas: cria viagem RODANDO com este único ativo. */
  const criarViagemRodandoCom = (atendimentoId: string) => {
    const ativo = ativos.find((a) => a.atendimentoId === atendimentoId);
    const nova = criarViagemVazia({
      modalidade: "RODANTE",
      destinoCentroCustoId: destinoSolicitacaoId,
      origemCentroCustoId: ativo?.centroCustoAtualId ?? null,
      atendimentoIds: [atendimentoId],
      ...patchDataUnica(dataPadrao),
    });
    setViagens((atual) => [
      ...atribuirAtivoAViagem(atual, atendimentoId, null),
      nova,
    ]);
    mobilizacaoDraft.selecionarViagem(nova.chaveLocal);
  };

  /** Transportador solto no canvas: cria viagem EMBARCADO. */
  const criarViagemEmbarcadaCom = (veiculoId: string) =>
    novaViagem({
      modalidade: "TRANSPORTADO",
      tipoTransporte: "PROPRIO",
      veiculoTransportadorId: veiculoId,
    });

  const aplicarMotorista = (chaveLocal: string, motoristaId: string) => {
    if (somenteLeitura) return;
    patchViagem(chaveLocal, { motoristaId, motoristaNome: "", motoristaCpf: "" });
  };

  /** Recebedor é da VIAGEM e NUNCA se confunde com o motorista. */
  const aplicarRecebedor = (chaveLocal: string, funcionarioId: string) => {
    if (somenteLeitura) return;
    const anterior = viagens.find((v) => v.chaveLocal === chaveLocal);
    patchViagem(chaveLocal, {
      recebedorPrevistoFuncionarioId: funcionarioId,
      recebedorPrevistoNome: "",
    });
    if (anterior?.recebedorPrevistoFuncionarioId && anterior.recebedorPrevistoFuncionarioId !== funcionarioId) {
      toast({ title: "Recebedor alterado." });
    }
  };

  /** Remoções: limpam SOMENTE a associação no rascunho. */
  const limparMotorista = (chaveLocal: string) =>
    patchViagem(chaveLocal, { motoristaId: null, motoristaNome: "", motoristaCpf: "" });

  const limparRecebedor = (chaveLocal: string) =>
    patchViagem(chaveLocal, {
      recebedorPrevistoFuncionarioId: null,
      recebedorPrevistoNome: "",
      recebedorPrevistoTelefone: "",
    });

  const limparVeiculo = (chaveLocal: string) =>
    patchViagem(chaveLocal, { veiculoTransportadorId: null, placaTransportador: "" });

  const aplicarVeiculo = (chaveLocal: string, veiculoTransportadorId: string) => {
    if (somenteLeitura) return;
    const v = viagens.find((x) => x.chaveLocal === chaveLocal);
    patchViagem(chaveLocal, {
      modalidade: "TRANSPORTADO",
      tipoTransporte: v?.tipoTransporte ?? "PROPRIO",
      veiculoTransportadorId,
      placaTransportador: "",
    });
  };


  const aplicarDataNasSemData = () =>
    setViagens((atual) =>
      atual.map((v) => (v.dataProgramada ? v : { ...v, ...patchDataUnica(dataPadrao) })),
    );

  /* -------------------------- drag and drop -------------------------- */

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    setArrastando(null);
    if (somenteLeitura) return;
    const origem = parseDragId(e.active.id);
    const alvo = parseDropId(e.over?.id);
    if (!origem || !alvo) return;
    // Compatibilidade explícita: motorista nunca entra na carga e vice-versa.
    if (!dropAceita(origem.tipo, alvo)) return;

    if (origem.tipo === "ATIVO") {
      if (alvo.tipo === "CANVAS") criarViagemRodandoCom(origem.id);
      else agrupar(origem.id, alvo.chaveLocal);
      return;
    }
    if (origem.tipo === "MOTORISTA") {
      if (alvo.tipo === "CANVAS") return;
      aplicarMotorista(alvo.chaveLocal, origem.id);
      return;
    }
    if (origem.tipo === "RECEBEDOR") {
      if (alvo.tipo === "CANVAS") return;
      aplicarRecebedor(alvo.chaveLocal, origem.id);
      return;
    }
    if (alvo.tipo === "CANVAS") criarViagemEmbarcadaCom(origem.id);
    else aplicarVeiculo(alvo.chaveLocal, origem.id);

  };

  const canvasDrop = useDroppable({ id: dropId({ tipo: "CANVAS" }), disabled: somenteLeitura });

  /* ---------------------------- comandos ---------------------------- */

  const salvar = async () => {
    await mobilizacaoDraft.salvar();
  };

  const irParaRevisao = () => irParaEtapa("REVISAO");

  const abrirRevisao = async () => {
    if (!vigente) return;
    setAbrindoRevisao(true);
    const out = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey: `MOB_NOVA_REVISAO|${vigente.id}`,
      resourceIds: [vigente.id],
      exec: (requestId) =>
        abrirNovaRevisaoMobilizacao({ planejamentoId: vigente.id, requestId }),
    });
    setAbrindoRevisao(false);

    if (out.status === "ok") {
      await mobilizacao.refetch();
      mobilizacaoDraft.ressincronizar();
      toast({
        title: "Revisão aberta",
        description: `Versão ${out.data.versao} em rascunho. O planejamento programado segue vigente.`,
      });
      return;
    }

    toast({
      title: "Não foi possível abrir a revisão",
      description: out.error.message,
      variant: "destructive",
    });
  };

  if (mobilizacao.isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="ct3c-mobilizacao-carregando">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mobilizacao.error || !estado) {
    return (
      <Alert variant="destructive" data-testid="ct3c-mobilizacao-erro">
        <AlertTitle className="text-sm">Mobilização não disponível</AlertTitle>
        <AlertDescription className="text-xs">
          Não foi possível carregar os ativos reservados desta solicitação. Nada pode ser
          planejado sem essa leitura.
        </AlertDescription>
      </Alert>
    );
  }

  const detalhe = viagens.find((v) => v.chaveLocal === detalheChave) ?? null;
  const entrega = viagens.find((v) => v.chaveLocal === entregaChave) ?? null;
  const labelMotorista = (id: string | null) =>
    id ? cadastros.motoristas.find((m) => m.value === id)?.label ?? null : null;
  const labelVeiculo = (id: string | null) =>
    id ? cadastros.veiculos.find((m) => m.value === id)?.label ?? null : null;

  const recebedoresDaViagem = (v: CtViagemRascunho) =>
    v.destinoCentroCustoId ? recebedores.porCentroCusto[v.destinoCentroCustoId] ?? [] : [];
  const labelRecebedor = (v: CtViagemRascunho) =>
    v.recebedorPrevistoFuncionarioId
      ? recebedoresDaViagem(v).find((o) => o.value === v.recebedorPrevistoFuncionarioId)?.label ??
        null
      : null;

  /** Rail direita: recebedores do CC destino da viagem em foco (ou da SOL). */
  const ccRailRecebedores =
    viagemSelecionada?.destinoCentroCustoId ?? destinoSolicitacaoId ?? null;
  const recebedoresRail = ccRailRecebedores
    ? recebedores.porCentroCusto[ccRailRecebedores] ?? []
    : [];
  const recebedoresRailCc = ccRailRecebedores
    ? cadastros.centrosCustoPorId[ccRailRecebedores]?.codigo ?? null
    : null;

  const arrastandoInfo = parseDragId(arrastando);
  const rotuloArrastado = arrastandoInfo
    ? arrastandoInfo.tipo === "ATIVO"
      ? rotuloAtivo(
          ativos.find((a) => a.atendimentoId === arrastandoInfo.id) ?? ({} as never),
        )
      : (arrastandoInfo.tipo === "MOTORISTA"
          ? labelMotorista(arrastandoInfo.id)
          : arrastandoInfo.tipo === "RECEBEDOR"
            ? recebedoresRail.find((o) => o.value === arrastandoInfo.id)?.label ?? null
            : labelVeiculo(arrastandoInfo.id)) ?? ""
    : "";


  /** Rail esquerda — cards verticais compactos dos ativos da solicitação. */
  const railAtivos = (
    <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Ativos da solicitação
        <span className="ml-auto normal-case">
          {ativos.filter((a) => indice.has(a.atendimentoId)).length}/{ativos.length}
        </span>
      </p>
      <div
        className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1"
        data-testid="ct6-ativos-scroll"
      >
        {ativos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nenhum ativo reservado nesta solicitação.
          </p>
        ) : (
          ativos.map((a) => {
            const chaveDoAtivo = indice.get(a.atendimentoId) ?? null;
            const idx = viagens.findIndex((v) => v.chaveLocal === chaveDoAtivo);
            return (
              <AtivoBuilderCard
                key={a.atendimentoId}
                ativo={a}
                estado={estadoAtivo(a.atendimentoId)}
                viagemRotulo={idx >= 0 ? `Em ${rotuloViagem(viagens[idx], idx)}` : null}
                desabilitado={somenteLeitura}
                selecionado={!!chaveDoAtivo && chaveDoAtivo === chaveSelecionada}
                viagens={viagensParaMenu}
                onFocar={() => mobilizacaoDraft.selecionarAtivo(a.atendimentoId)}
                onAdicionarNaViagem={(chave) => agrupar(a.atendimentoId, chave)}
                onNovaViagem={() => criarViagemRodandoCom(a.atendimentoId)}
                onRetirar={chaveDoAtivo ? () => agrupar(a.atendimentoId, null) : undefined}
              />
            );
          })
        )}
      </div>
      {!railCandidatos && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full shrink-0 text-[10px]"
          data-testid="ct6-alterar-selecao"
          onClick={() => irParaEtapa("SELECAO")}
        >
          Alterar seleção de ativos
        </Button>
      )}
    </CardContent>
  );


  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))}
      onDragCancel={() => setArrastando(null)}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3" data-testid="ct3c-etapa-mobilizacao">
        {/* ---------------------- cabeçalho enxuto ---------------------- */}
        <div
          className="flex flex-wrap items-end justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
          data-testid="ct6-cabecalho-transporte"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="text-[11px]" data-testid="ct3e-destino-padrao">
              <p className="uppercase tracking-wide text-muted-foreground">Destino padrão</p>
              <p className="text-xs font-semibold">
                {destinoSolicitacaoId
                  ? rotuloCc(cadastros.centrosCustoPorId[destinoSolicitacaoId] ?? null)
                  : "—"}
              </p>
            </div>
            <div className="text-[11px]">
              <p className="uppercase tracking-wide text-muted-foreground">
                Data padrão da mobilização
              </p>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  disabled={somenteLeitura}
                  className="h-7 w-[9.5rem] text-xs"
                  data-testid="ct6-data-padrao"
                  value={dataPadrao}
                  onChange={(e) => setDataPadrao(e.target.value)}
                />
                {!somenteLeitura && viagens.some((v) => !v.dataProgramada) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    data-testid="ct6-aplicar-data"
                    onClick={aplicarDataNasSemData}
                  >
                    Aplicar às viagens sem data
                  </Button>
                )}
              </div>
            </div>
            {(rascunhoServidor ?? vigente) && (
              <Badge variant="outline" className="text-[10px]">
                Versão {(rascunhoServidor ?? vigente)!.versao} —{" "}
                {CT_PLANEJAMENTO_STATUS_LABELS[(rascunhoServidor ?? vigente)!.status]}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground" data-testid="ct3d2-estado-rascunho">
              {mobilizacaoDraft.status === "SAVING"
                ? "Salvando rascunho..."
                : mobilizacaoDraft.status === "CONFIRMING"
                  ? "Operação sendo confirmada"
                  : mobilizacaoDraft.status === "DIRTY"
                    ? "Alterações não salvas"
                    : mobilizacaoDraft.status === "SAVED"
                      ? `Rascunho salvo ${horaBR(mobilizacaoDraft.salvoEm)}`
                      : mobilizacaoDraft.status === "ERROR"
                        ? mobilizacaoDraft.mensagemErro ?? "Falha ao salvar o rascunho"
                        : mobilizacaoDraft.temPlanejamentoPersistido
                          ? "Rascunho sincronizado com o servidor"
                          : "Nenhum rascunho salvo"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {somenteLeitura && vigente && capabilities.canEditar && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                data-testid="ct3c-abrir-revisao"
                disabled={abrindoRevisao}
                onClick={abrirRevisao}
              >
                {abrindoRevisao ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Abrir revisão
              </Button>
            )}
            {!somenteLeitura && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="ct3c-nova-viagem"
                  onClick={adicionarViagem}
                >
                  <Plus className="h-4 w-4" />
                  Nova viagem
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="ct3c-salvar-rascunho"
                  disabled={salvando || !podeSalvarRascunho}
                  onClick={salvar}
                >
                  {salvando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar rascunho
                </Button>
              </>
            )}
            <Button
              size="sm"
              className="gap-2"
              data-testid="ct3d2-ir-revisao"
              disabled={salvando || viagens.length === 0}
              onClick={irParaRevisao}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Revisar planejamento
            </Button>
          </div>
        </div>

        {mobilizacaoDraft.operacaoPendente && (
          <Alert data-testid="ct3d3-confirmar-salvamento">
            <AlertTitle className="text-xs">Operação sem confirmação</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                Uma tentativa deste planejamento não teve resposta. Resolver reconsulta o servidor
                e, se necessário, repete o mesmo comando com segurança (sem duplicar registros).
              </span>
              <Button
                size="sm"
                variant="outline"
                data-testid="ct3d5-resolver-pendencia"
                disabled={salvando || mobilizacaoDraft.resolvendoPendencia}
                onClick={() => void mobilizacaoDraft.resolverOperacaoPendente()}
              >
                {mobilizacaoDraft.resolvendoPendencia ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Resolver operação pendente"
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {somenteLeitura && vigente && (
          <Alert data-testid="ct3c-mobilizacao-programada">
            <AlertTitle className="text-xs">Planejamento programado vigente</AlertTitle>
            <AlertDescription className="text-xs">
              Programado em{" "}
              {vigente.programadoEm ? formatDateBR(vigente.programadoEm.slice(0, 10)) : "—"}. Abra
              uma revisão para alterar as viagens; o programado permanece vigente até a nova versão
              ser programada.
            </AlertDescription>
          </Alert>
        )}

        {problemasRascunho.length > 0 && (
          <Alert variant="destructive" data-testid="ct3c-problemas-rascunho">
            <AlertTitle className="text-xs">Ajuste antes de salvar</AlertTitle>
            <AlertDescription className="text-xs">
              <ul className="list-disc pl-4">
                {problemasRascunho.map((p, i) => (
                  <li key={`rasc-${i}`}>{p.mensagem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* ------------------- WORKSPACE — 3 colunas reais ------------------- */}
        <div
          className={cn(
            "grid min-h-[560px] grid-cols-1 gap-3",
            !railCandidatos && "lg:grid-cols-[190px_minmax(0,1fr)_210px]",
            !railCandidatos &&
              "xl:h-[calc(100vh-300px)] xl:grid-cols-[190px_minmax(0,1fr)_215px] xl:gap-4",
            railCandidatos && "lg:grid-cols-[250px_minmax(0,1fr)_220px]",
            railCandidatos && "xl:h-[calc(100vh-300px)] xl:gap-4",
          )}
          data-testid="ct6-builder-grid"
        >
          {/* COLUNA 1 — candidatos (CT-9) + ativos já reservados */}
          <div
            className="hidden h-full min-h-0 flex-col gap-3 lg:flex"
            data-testid="ct9-coluna-esquerda"
          >
            {railCandidatos && (
              <Card
                className="flex min-h-0 basis-1/2 flex-col overflow-hidden"
                data-testid="ct9-coluna-candidatos"
              >
                {railCandidatos}
              </Card>
            )}
            <Card
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              data-testid="ct6-coluna-ativos"
            >
              {railAtivos}
            </Card>
          </div>

          {/* COLUNA 2 — canvas do Transport Builder */}
          <div className="flex h-full min-h-0 flex-col gap-2" data-testid="ct6-coluna-canvas">
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{tituloBuilder}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Monte as viagens arrastando ativos e recursos
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1 lg:hidden">
                {railCandidatos && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    data-testid="ct9-abrir-candidatos-mobile"
                    onClick={() => setPainelMobile("CANDIDATOS")}
                  >
                    Candidatos
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  data-testid="ct6-abrir-ativos-mobile"
                  onClick={() => setPainelMobile("ATIVOS")}
                >
                  Ativos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  data-testid="ct6-abrir-recursos-mobile"
                  onClick={() => setPainelMobile("RECURSOS")}
                >
                  Recursos
                </Button>
              </div>
            </div>

            {canvasTopo && (
              <div
                className="max-h-[38%] shrink-0 overflow-y-auto rounded-lg border bg-muted/10 p-2"
                data-testid="ct9-canvas-topo"
              >
                {canvasTopo}
              </div>
            )}

            <div
              ref={canvasDrop.setNodeRef}
              data-testid="ct6-canvas"
              className={cn(
                "min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border-2 border-dashed px-5 py-4 transition-colors",
                canvasDrop.isOver
                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-500/10"
                  : "border-border bg-muted/20",
              )}
            >
              {viagens.length === 0 ? (
                <div
                  className="flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center"
                  data-testid="ct6-dropzone-vazia"
                >
                  <MousePointerSquareDashed className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Arraste e solte itens para compor a viagem
                  </p>
                  <p className="max-w-sm text-[11px] text-muted-foreground">
                    Arraste ativos para o Canvas ou para uma viagem existente. Um transportador
                    solto aqui cria uma viagem embarcada.
                  </p>
                  {!somenteLeitura && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 gap-2"
                      data-testid="ct6-criar-viagem-manual"
                      onClick={adicionarViagem}
                    >
                      <Plus className="h-4 w-4" /> Criar viagem manualmente
                    </Button>
                  )}
                </div>
              ) : (
                viagens.map((v, i) => (
                  <ViagemBuilderCard
                    key={v.chaveLocal}
                    viagem={v}
                    indice={i}
                    ativos={ativos}
                    problemas={problemasDaViagem(v.chaveLocal)}
                    somenteLeitura={somenteLeitura}
                    selecionado={v.chaveLocal === viagemSelecionada?.chaveLocal}
                    motoristaLabel={labelMotorista(v.motoristaId)}
                    veiculoLabel={labelVeiculo(v.veiculoTransportadorId)}
                    recebedorLabel={labelRecebedor(v)}

                    origemCc={
                      v.origemCentroCustoId
                        ? cadastros.centrosCustoPorId[v.origemCentroCustoId] ?? null
                        : null
                    }
                    destinoCc={
                      v.destinoCentroCustoId
                        ? cadastros.centrosCustoPorId[v.destinoCentroCustoId] ?? null
                        : null
                    }
                    estadoPersistencia={(() => {
                      const p =
                        v.atendimentoIds.map((at) => indicePersistido.get(at)).find((x) => !!x) ??
                        null;
                      return p?.status === "PROGRAMADA"
                        ? "programado"
                        : p
                          ? "persistido"
                          : "nao-salvo";
                    })()}
                    concluido={concluidos.has(v.chaveLocal)}
                    onFocar={() => mobilizacaoDraft.selecionarViagem(v.chaveLocal)}
                    onPatch={(patch) => patchViagem(v.chaveLocal, patch)}
                    onRemover={() => removerViagem(v.chaveLocal)}
                    onDuplicar={() => duplicarViagem(v.chaveLocal)}
                    onRemoverAtivo={(at) => agrupar(at, null)}
                    onLimparMotorista={() => limparMotorista(v.chaveLocal)}
                    onLimparVeiculo={() => limparVeiculo(v.chaveLocal)}
                    onLimparRecebedor={() => limparRecebedor(v.chaveLocal)}
                    onVerRota={() => setDetalheChave(v.chaveLocal)}
                    onDetalhes={() => setDetalheChave(v.chaveLocal)}
                    onAlterarEntrega={() => setEntregaChave(v.chaveLocal)}

                    onConcluir={() =>
                      setConcluidos((atual) => new Set(atual).add(v.chaveLocal))
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUNA 3 — recursos */}
          <div className="hidden h-full min-h-0 lg:block">
            <RecursosBuilderPanel
              motoristas={cadastros.motoristas}
              veiculos={cadastros.veiculos}
              recebedores={recebedoresRail}
              recebedoresCcRotulo={recebedoresRailCc}
              recebedoresCarregando={recebedores.isLoading}
              desabilitado={somenteLeitura}
              estadoMotorista={(id) => calcEstadoMotorista(id, viagens)}
              estadoVeiculo={(id) => calcEstadoVeiculo(id, viagens, ativos)}
              viagens={viagensParaMenu}
              onAplicarMotorista={aplicarMotorista}
              onAplicarVeiculo={aplicarVeiculo}
              onAplicarRecebedor={aplicarRecebedor}
              onNovaViagemComVeiculo={criarViagemEmbarcadaCom}
            />
          </div>
        </div>

        {/* < lg: rails em Sheets laterais, sem empilhar listas gigantes */}
        <Sheet open={painelMobile !== null} onOpenChange={(o) => !o && setPainelMobile(null)}>
          <SheetContent
            side={painelMobile === "RECURSOS" ? "right" : "left"}
            className="w-[19rem] overflow-y-auto p-3"
            data-testid="ct6-painel-mobile"
          >
            <SheetHeader>
              <SheetTitle className="text-sm">
                {painelMobile === "RECURSOS"
                  ? "Recursos do transporte"
                  : painelMobile === "CANDIDATOS"
                    ? "Ativos candidatos"
                    : "Ativos da solicitação"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Toque para aplicar sem arrastar.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-3 h-[calc(100vh-8rem)]">
              {painelMobile === "RECURSOS" ? (
                <RecursosBuilderPanel
                  motoristas={cadastros.motoristas}
                  veiculos={cadastros.veiculos}
                  recebedores={recebedoresRail}
                  recebedoresCcRotulo={recebedoresRailCc}
                  recebedoresCarregando={recebedores.isLoading}
                  desabilitado={somenteLeitura}
                  estadoMotorista={(id) => calcEstadoMotorista(id, viagens)}
                  estadoVeiculo={(id) => calcEstadoVeiculo(id, viagens, ativos)}
                  viagens={viagensParaMenu}
                  onAplicarMotorista={aplicarMotorista}
                  onAplicarVeiculo={aplicarVeiculo}
                  onAplicarRecebedor={aplicarRecebedor}
                  onNovaViagemComVeiculo={criarViagemEmbarcadaCom}
                />
              ) : painelMobile === "CANDIDATOS" ? (
                <Card className="flex h-full min-h-0 flex-col overflow-hidden">
                  {railCandidatos}
                </Card>
              ) : (
                <Card className="flex h-full min-h-0 flex-col overflow-hidden">{railAtivos}</Card>
              )}
            </div>
          </SheetContent>
        </Sheet>


        {/* Dados da entrega — Dialog CENTRAL (fluxo comum de edição). */}
        <EntregaDialog
          viagem={entrega}
          destinoCc={
            entrega?.destinoCentroCustoId
              ? cadastros.centrosCustoPorId[entrega.destinoCentroCustoId] ?? null
              : null
          }
          destinoCcEndereco={
            entrega?.destinoCentroCustoId
              ? cadastros.enderecosCentroCusto[entrega.destinoCentroCustoId] ?? null
              : null
          }
          recebedorLabel={entrega ? labelRecebedor(entrega) : null}
          somenteLeitura={somenteLeitura}
          onOpenChange={(o) => !o && setEntregaChave(null)}
          onPatch={(patch) => entrega && patchViagem(entrega.chaveLocal, patch)}
        />

        {/* Detalhes avançados / rota — reaproveita o editor completo existente. */}
        <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalheChave(null)}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-xl"
            data-testid="ct6-sheet-detalhes"
          >
            <SheetHeader>
              <SheetTitle className="text-sm">Diagnóstico avançado da viagem</SheetTitle>
              <SheetDescription className="text-xs">
                Origem, destino, mapa, coordenadas e campos técnicos desta viagem.
              </SheetDescription>
            </SheetHeader>
            {detalhe && (
              <div className="mt-3">
                <ViagemCardEditor
                  viagem={detalhe}
                  indice={viagens.findIndex((v) => v.chaveLocal === detalhe.chaveLocal)}
                  ativos={ativos}
                  problemas={problemasDaViagem(detalhe.chaveLocal)}
                  somenteLeitura={somenteLeitura}
                  cadastros={cadastros}
                  origemCcEndereco={
                    detalhe.origemCentroCustoId
                      ? cadastros.enderecosCentroCusto[detalhe.origemCentroCustoId] ?? null
                      : null
                  }
                  destinoCcEndereco={
                    detalhe.destinoCentroCustoId
                      ? cadastros.enderecosCentroCusto[detalhe.destinoCentroCustoId] ?? null
                      : null
                  }
                  origemCc={
                    detalhe.origemCentroCustoId
                      ? cadastros.centrosCustoPorId[detalhe.origemCentroCustoId] ?? null
                      : null
                  }
                  destinoCc={
                    detalhe.destinoCentroCustoId
                      ? cadastros.centrosCustoPorId[detalhe.destinoCentroCustoId] ?? null
                      : null
                  }
                  onPatch={(patch) => patchViagem(detalhe.chaveLocal, patch)}
                  onRemover={() => {
                    removerViagem(detalhe.chaveLocal);
                    setDetalheChave(null);
                  }}
                  onRemoverAtivo={(at) => agrupar(at, null)}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>

        <DragOverlay>
          {arrastando && (
            <div
              className="rotate-1 scale-[1.02] rounded-md border bg-background px-2 py-1 text-xs opacity-95 shadow-lg"
              data-testid="ct6-drag-preview"
            >
              {rotuloArrastado}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default EtapaMobilizacao;
