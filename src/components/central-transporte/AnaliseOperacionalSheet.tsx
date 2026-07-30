import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Clock, ShoppingCart, XCircle, AlertTriangle, Info, ShieldAlert, RefreshCw, Wrench } from "lucide-react";
import {
  fetchAnaliseOperacional,
  filtrarAtivosPorBusca,
  AnaliseOperacional,
  AtivoAnalise,
} from "@/services/centralTransporteService";
import {
  ALERTA_CONFLITO_ATENDIMENTO,
  SEM_CENTRO_CUSTO_LABEL,
} from "@/lib/ativos/reconciliacaoOperacional";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search } from "lucide-react";
import { REGIME_LABELS, RegimeTrabalho, STATUS_ITEM_LABELS, StatusItem } from "@/services/solicitacaoItensService";
import { formatDateBR } from "@/utils/formatDateBR";
import { formatProtocolo } from "@/utils/formatProtocolo";
import type { SelectedContext } from "./CentralTransportePage";
import type { CtOperationApi } from "@/hooks/central-transporte/useCtOperation";
import type { CentralTransporteCapabilities } from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import type {
  CtAtendimento,
  CtCandidateOrigem,
  CtCandidateSelection,
} from "@/types/centralTransporteCT2";
import useAtendimentosSolicitacao from "@/hooks/central-transporte/useAtendimentosSolicitacao";
import AtendimentosItemPanel from "./atendimento/AtendimentosItemPanel";
import AtribuirAtendimentoModal from "./atendimento/AtribuirAtendimentoModal";
import EncerrarAtendimentoModal from "./atendimento/EncerrarAtendimentoModal";
import SubstituirAtendimentoModal from "./atendimento/SubstituirAtendimentoModal";
import RegularizarDisponibilidadeModal from "./RegularizarDisponibilidadeModal";
import useEstadoEfetivoAtivos from "@/hooks/central-transporte/useEstadoEfetivoAtivos";
import type { CtEstadoEfetivoMap } from "@/types/centralTransporteEstadoEfetivo";
import {
  badgeDoEstadoEfetivo,
  CLASSE_TOM,
} from "@/utils/central-transporte/estadoEfetivoBadges";
import { invalidarCachesAtivosOperacionais } from "@/lib/queryInvalidation/ativosOperacionais";

interface Props {
  context: SelectedContext | null;
  open: boolean;
  onClose: () => void;
  onDecisaoSaved: () => void;
  /** Motor de idempotência mantido no CentralTransportePage (persistente). */
  ctOperation?: CtOperationApi;
  capabilities?: CentralTransporteCapabilities;
}

const BLOQUEIO_LEGADO =
  "Esta solicitação está no modelo legado (sem item). As operações da Central do Transporte exigem um item selecionado.";
const BLOQUEIO_RBAC =
  "Você não tem permissão para executar operações na Central do Transporte.";
const NAO_IMPLEMENTADO =
  "Cotação externa e indisponibilidade serão liberadas em fase posterior do CT-2.";

const CAPS_FECHADAS: CentralTransporteCapabilities = {
  canVisualizar: false,
  canCriar: false,
  canEditar: false,
  canAprovar: false,
  isLoading: false,
};

const AnaliseOperacionalSheet: React.FC<Props> = ({
  context,
  open,
  onClose,
  onDecisaoSaved,
  ctOperation,
  capabilities,
}) => {
  const solicitacao = context?.solicitacao ?? null;
  const item = context?.item ?? null;
  const caps = capabilities ?? CAPS_FECHADAS;

  const [selecionado, setSelecionado] = useState<CtCandidateSelection | null>(null);
  const [modalAtribuir, setModalAtribuir] = useState<null | "INTERNO" | "RESERVA_FUTURA">(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<CtAtendimento | null>(null);
  const [substituirAlvo, setSubstituirAlvo] = useState<CtAtendimento | null>(null);
  const [regularizarAlvo, setRegularizarAlvo] = useState<CtCandidateSelection | null>(null);
  const queryClient = useQueryClient();


  const analiseQuery = useQuery({
    enabled: !!open && !!solicitacao,
    queryKey: [
      "central-transporte-analise",
      item?.id ?? null,
      item?.subcategoria_id ?? null,
      item?.catalogo_equipamento_id ?? null,
      item?.catalogo_variacao_id ?? null,
      item?.capacidade_valor ?? null,
      item?.capacidade_unidade ?? null,
      solicitacao?.tipo_equipamento_id ?? null,
      item?.quantidade ?? solicitacao?.quantidade ?? null,
      solicitacao?.centro_custo_id ?? null,
    ],
    queryFn: (): Promise<AnaliseOperacional> =>
      fetchAnaliseOperacional({
        tipoEquipamentoId: solicitacao?.tipo_equipamento_id ?? null,
        catalogoEquipamentoId: item?.catalogo_equipamento_id ?? null,
        catalogoVariacaoId: item?.catalogo_variacao_id ?? null,
        subcategoriaId: item?.subcategoria_id ?? null,
        capacidadeValor: item?.capacidade_valor ?? null,
        capacidadeUnidade: item?.capacidade_unidade ?? null,
        quantidade: item?.quantidade ?? solicitacao?.quantidade ?? null,
        centroCustoDestinoId: solicitacao?.centro_custo_id ?? null,
      }),
  });

  const atendimentosQuery = useAtendimentosSolicitacao({
    solicitacaoId: solicitacao?.id ?? null,
    itemId: item?.id ?? null,
    enabled: !!open && !!item && caps.canVisualizar,
  });

  // CT-2.2: compromisso real de cada candidato (reserva/transporte/entrega).
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

  const estadoEfetivo = useEstadoEfetivoAtivos({
    equipamentoIds: idsCandidatos,
    periodoInicio: solicitacao?.data_inicio ?? null,
    periodoFim: solicitacao?.data_inicio ?? null,
    enabled: !!open && idsCandidatos.length > 0,
  });
  const estados = estadoEfetivo.estados;

  const handleSelecionar = useMemo(
    () => (ativo: AtivoAnalise, origem: CtCandidateOrigem) => {
      const cand = toCandidateSelection(ativo, origem, estados.get(ativo.equipamento_id) ?? null);
      setSelecionado((atual) =>
        atual && cand && atual.equipamentoId === cand.equipamentoId ? null : cand,
      );
    },
    [estados],
  );

  const handleOperacaoConcluida = () => {
    setSelecionado(null);
    void atendimentosQuery.refetch();
    // CT-2.2: o compromisso mudou — invalida estado efetivo e caches de ativos.
    void invalidarCachesAtivosOperacionais(queryClient);
    onDecisaoSaved();
  };

  if (!solicitacao) return null;

  const analise = analiseQuery.data;
  const loading = analiseQuery.isLoading || analiseQuery.isFetching;
  const isLegado = !item;

  const bloqueio: string | null = isLegado
    ? BLOQUEIO_LEGADO
    : caps.isLoading
      ? "Verificando permissões..."
      : !caps.canCriar && !caps.canEditar
        ? BLOQUEIO_RBAC
        : null;

  const podeOperar = !bloqueio;
  // G1: ativo selecionado sem linha operacional → oferecer regularização assistida.
  const precisaRegularizar = !!selecionado?.precisaRegularizarDisponibilidade;
  // CT-2.2: ativo comprometido/conflitante permanece visível, mas não operável.
  const compromissoBloqueia = !!selecionado?.compromissoBloqueia;
  // Contador de pendentes vem exclusivamente da RPC (fn_ct_contadores_item).
  const pendentes = atendimentosQuery.contadores?.pendentes ?? 0;
  const temPendentes = pendentes > 0;
  const podeAtribuirInterno =
    podeOperar &&
    caps.canCriar &&
    temPendentes &&
    !!selecionado &&
    selecionado.permiteInterno &&
    !compromissoBloqueia &&
    !!ctOperation;
  const podeReservarFuturo =
    podeOperar &&
    caps.canCriar &&
    temPendentes &&
    !!selecionado &&
    selecionado.permiteReservaFutura &&
    !compromissoBloqueia &&
    !!ctOperation;


  const podeRegularizar = precisaRegularizar && podeOperar && caps.canEditar;

  const capacidadeLabel =
    item?.capacidade_valor != null
      ? `${item.capacidade_valor}${item.capacidade_unidade ? ` ${item.capacidade_unidade}` : ""}`
      : ((item as { capacidade_descricao?: string | null } | null)?.capacidade_descricao) || "—";


  const descricaoItem =
    item?.item_nao_catalogado
      ? item.descricao_livre || "Não catalogado"
      : item?.subcategoria_nome
        ? `${item.subcategoria_nome}${capacidadeLabel !== "—" ? ` — ${capacidadeLabel}` : ""}`
        : item?.catalogo_descricao || solicitacao.descricao_tipo_equipamento || "—";


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxWidth: "min(1280px, 96vw)", width: "min(1280px, 96vw)", maxHeight: "92vh" }}
      >
        <DialogHeader className="px-6 py-4 border-b space-y-3 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {formatProtocolo(solicitacao.id)}
            </span>
            <span className="truncate">{descricaoItem}</span>
            {item && <Badge variant="outline" className="text-[10px]">{item.tipo_item}</Badge>}
            {item && (
              <Badge className="text-[10px]" variant="outline">
                {STATUS_ITEM_LABELS[item.status_item as StatusItem] || item.status_item}
              </Badge>
            )}
          </DialogTitle>

          {isLegado && (
            <Alert variant="default" className="py-2">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Esta solicitação ainda usa o modelo legado (sem item selecionado). A análise usa apenas o tipo genérico do cabeçalho.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <MetaField label="Quantidade" value={String(item?.quantidade ?? solicitacao.quantidade)} />
            <MetaField label="Capacidade" value={capacidadeLabel} />
            <MetaField
              label="Regime"
              value={item?.regime_trabalho ? (REGIME_LABELS[item.regime_trabalho as RegimeTrabalho] || item.regime_trabalho) : "—"}
            />
            <MetaField label="Operador" value={item?.com_operador ? "Com operador" : "Sem operador"} />
            <MetaField label="Centro de Custo" value={solicitacao.nome_centro_custo || "—"} />
            <MetaField label="Departamento" value={solicitacao.departamento_nome || "—"} />
            <MetaField label="Engenheiro" value={solicitacao.engenheiro_nome || "—"} />
            <MetaField label="Apontador" value={solicitacao.apontador_nome || "—"} />
            <MetaField label="Prioridade" value={solicitacao.prioridade} />
            <MetaField
              label="Período"
              value={solicitacao.data_inicio ? formatDateBR(solicitacao.data_inicio) : "—"}
            />
            <MetaField label="Status Fluxo" value={solicitacao.status_fluxo.replace(/_/g, " ")} />
            <MetaField label="Compatibilidade" value={analise?.resumo?.compatibilidade || "—"} />
          </div>

          {solicitacao.justificativa && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30 max-h-16 overflow-auto">
              <strong className="text-foreground">Justificativa: </strong>
              {solicitacao.justificativa}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          ) : analise ? (
            <AnaliseBody
              analise={analise}
              onRetry={() => analiseQuery.refetch()}
              selectedId={selecionado?.equipamentoId ?? null}
              onSelect={podeOperar ? handleSelecionar : undefined}
              estados={estados}
            />
          ) : null}

          {!isLegado && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Atendimentos do item
              </h4>
              <AtendimentosItemPanel
                loading={atendimentosQuery.isLoading}
                contadores={atendimentosQuery.contadores}
                atendimentos={atendimentosQuery.atendimentos}
                canEditar={caps.canEditar}
                canCriar={caps.canCriar}
                bloqueioMotivo={bloqueio}
                onEncerrar={setEncerrarAlvo}
                onSubstituir={setSubstituirAlvo}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 shrink-0 space-y-2">
          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {bloqueio ||
                (!isLegado && !temPendentes
                  ? "Item sem quantidade pendente — não há vaga para novos atendimentos."
                  : selecionado
                    ? `Selecionado: ${selecionado.frota || selecionado.placa || selecionado.equipamentoId}`
                    : "Selecione um ativo nas abas acima para habilitar as operações.")}
            </span>
          </div>

          {compromissoBloqueia && !precisaRegularizar && (
            <Alert variant="destructive" data-testid="ct22-alerta-compromisso">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs">
                {selecionado?.compromissoLabel || "Ativo comprometido"}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {selecionado?.compromissoDetalhe ||
                  "Este ativo possui compromisso ativo no período; a reserva é bloqueada pelo banco."}
              </AlertDescription>
            </Alert>
          )}

          {precisaRegularizar && (
            <Alert data-testid="ct2-alerta-sem-registro">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="text-xs">Sem disponibilidade operacional confirmada</AlertTitle>
              <AlertDescription className="text-xs flex flex-wrap items-center gap-2">
                <span>
                  Este ativo não possui registro operacional; o atendimento é bloqueado pelo servidor
                  (CT2_DISPONIBILIDADE_SEM_REGISTRO).
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="ct2-btn-regularizar"
                  disabled={!podeRegularizar}
                  title={
                    !caps.canEditar
                      ? "Você não tem permissão para regularizar a disponibilidade."
                      : undefined
                  }
                  onClick={() => setRegularizarAlvo(selecionado)}
                >
                  <Wrench className="h-3.5 w-3.5" /> Regularizar disponibilidade
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              className="gap-2"
              data-testid="ct2-btn-interno"
              disabled={!podeAtribuirInterno}
              title={bloqueio || undefined}
              onClick={() => setModalAtribuir("INTERNO")}
            >
              <CheckCircle2 className="h-4 w-4" /> Atender Interno
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              data-testid="ct2-btn-reserva"
              disabled={!podeReservarFuturo}
              title={bloqueio || undefined}
              onClick={() => setModalAtribuir("RESERVA_FUTURA")}
            >
              <Clock className="h-4 w-4" /> Reservar Futuro
            </Button>
            <Button disabled variant="outline" data-testid="ct2-btn-externo" title={NAO_IMPLEMENTADO} className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Cotação Externa
            </Button>
            <Button disabled variant="destructive" data-testid="ct2-btn-indisponivel" title={NAO_IMPLEMENTADO} className="gap-2">
              <XCircle className="h-4 w-4" /> Indisponível
            </Button>
          </div>
        </div>

      </DialogContent>

      {modalAtribuir && selecionado && item && ctOperation && (
        <AtribuirAtendimentoModal
          open
          onClose={() => setModalAtribuir(null)}
          solicitacaoItemId={item.id}
          candidate={selecionado}
          modalidade={modalAtribuir}
          canAprovar={caps.canAprovar}
          ctOperation={ctOperation}
          onSuccess={handleOperacaoConcluida}
        />
      )}

      {encerrarAlvo && ctOperation && (
        <EncerrarAtendimentoModal
          open
          onClose={() => setEncerrarAlvo(null)}
          atendimento={encerrarAlvo}
          ctOperation={ctOperation}
          onSuccess={handleOperacaoConcluida}
        />
      )}

      {substituirAlvo && ctOperation && (
        <SubstituirAtendimentoModal
          open
          onClose={() => setSubstituirAlvo(null)}
          atendimento={substituirAlvo}
          candidate={selecionado}
          modalidade={selecionado?.permiteInterno ? "INTERNO" : "RESERVA_FUTURA"}
          ctOperation={ctOperation}
          onSuccess={handleOperacaoConcluida}
        />
      )}

      {regularizarAlvo && (
        <RegularizarDisponibilidadeModal
          open
          onClose={() => setRegularizarAlvo(null)}
          equipamentoId={regularizarAlvo.equipamentoId}
          identificacao={
            regularizarAlvo.frota
              ? `${regularizarAlvo.frota}${regularizarAlvo.numeroFrota ?? ""}`
              : regularizarAlvo.placa || regularizarAlvo.equipamentoId
          }
          situacaoCadastral={regularizarAlvo.situacaoCadastral}
          possuiRegistro={regularizarAlvo.possuiRegistroDisponibilidade}
          onSuccess={() => {
            setSelecionado(null);
            void analiseQuery.refetch();
            void atendimentosQuery.refetch();
          }}
        />
      )}
    </Dialog>

  );
};



const MetaField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] uppercase tracking-wide">{label}</span>
    <span className="text-foreground text-xs truncate">{value}</span>
  </div>
);

interface AnaliseBodyProps {
  analise: AnaliseOperacional;
  onRetry: () => void;
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
}

const AnaliseBody: React.FC<AnaliseBodyProps> = ({ analise, onRetry, selectedId = null, onSelect, estados }) => {
  // Busca global aplicada a TODAS as abas, sobre o conjunto já carregado.
  // Não recorta o universo de candidatos — apenas a exibição.
  const [busca, setBusca] = useState("");
  const listas = useMemo(
    () => ({
      propria: filtrarAtivosPorBusca(analise.disponibilidadePropria, busca),
      grupo: filtrarAtivosPorBusca(analise.disponibilidadeGrupo, busca),
      previsao: filtrarAtivosPorBusca(analise.equipamentosComPrevisao, busca),
      externoLocado: filtrarAtivosPorBusca(analise.externoLocado, busca),
      naoClassificado: filtrarAtivosPorBusca(analise.naoClassificado ?? [], busca),
    }),
    [analise, busca],
  );

  if (analise.status === "erro_consulta") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao consultar</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span className="text-xs">{analise.errorMessage || "Falha ao consultar dados."}</span>
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "acesso_negado") {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription className="text-xs">
          Você não tem permissão para consultar esta informação. Solicite acesso ao administrador.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "item_sem_classificacao") {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Item sem classificação</AlertTitle>
        <AlertDescription className="text-xs">
          O item não possui subcategoria, catálogo, variação ou tipo de equipamento. Sem esses dados, a Central não pode identificar ativos compatíveis.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "sem_ativos_cadastrados") {
    return (
      <>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Sem ativos compatíveis cadastrados</AlertTitle>
          <AlertDescription className="text-xs">
            Nenhum equipamento do inventário próprio, grupo ou locado corresponde a este item.
            {analise.portfolioExterno.length > 0 && " Consulte os fornecedores externos abaixo."}
          </AlertDescription>
        </Alert>
        {analise.portfolioExterno.length > 0 && <PortfolioTable rows={analise.portfolioExterno} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {analise.resumo.compatibilidade === "PARCIAL" && (
        <Alert className="py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {analise.resumo.motivo_compatibilidade ||
              "Compatibilidade parcial — capacidade dos ativos não confirmada."}{" "}
            Ver detalhamento na aba Resumo.
          </AlertDescription>
        </Alert>
      )}

      {!analise.localizacao_disponivel && (
        <Alert className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Localização atual indisponível no momento — a análise dos ativos continua válida,
            mas o Centro de Custo atual não pôde ser consultado.
          </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 h-9 text-xs"
          data-testid="ct1-busca-ativos"
          placeholder="Buscar em todas as abas por frota, nº de frota, placa, empresa ou centro de custo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Tabs defaultValue="propria">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="propria" className="text-xs">
            Própria ({listas.propria.length})
          </TabsTrigger>
          <TabsTrigger value="grupo" className="text-xs">
            Grupo ({listas.grupo.length})
          </TabsTrigger>
          <TabsTrigger value="previsao" className="text-xs">
            Previsão ({listas.previsao.length})
          </TabsTrigger>
          <TabsTrigger value="externo" className="text-xs">
            Externo ({listas.externoLocado.length + analise.portfolioExterno.length})
          </TabsTrigger>
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="propria">
          <AtivosTable rows={listas.propria} empty={busca ? "Nenhum ativo próprio corresponde à busca." : "Nenhum equipamento próprio cadastrado para este item."} origem="PROPRIA" selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="grupo">
          <AtivosTable rows={listas.grupo} empty={busca ? "Nenhum ativo do grupo corresponde à busca." : "Nenhum equipamento do grupo cadastrado para este item."} origem="GRUPO" selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="previsao">
          <PrevisaoTable rows={listas.previsao} selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="externo" className="space-y-4">
          {listas.externoLocado.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Ativos locados cadastrados
              </h4>
              <AtivosTable rows={listas.externoLocado} empty="—" estados={estados} />
            </div>
          )}
          {analise.portfolioExterno.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Fornecedores do portfólio
              </h4>
              <PortfolioTable rows={analise.portfolioExterno} />
            </div>
          )}
          {listas.externoLocado.length === 0 && analise.portfolioExterno.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              Nenhum ativo locado nem fornecedor externo compatível.
            </div>
          )}
        </TabsContent>
        <TabsContent value="resumo" className="space-y-4">
          <ResumoBox analise={analise} />
          {listas.naoClassificado.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Ativos sem propriedade classificada ({listas.naoClassificado.length})
              </h4>
              <AtivosTable rows={listas.naoClassificado} empty="—" estados={estados} />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {analise.status === "sem_disponibilidade" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem disponibilidade confirmada no momento</AlertTitle>
          <AlertDescription className="text-xs">
            Existem {analise.totalCandidatos} ativo(s) cadastrado(s) compatível(is), mas nenhum consta como
            DISPONÍVEL agora e nenhum tem previsão de liberação.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

};

const propriedadeBadge = (p: AtivoAnalise["propriedade"]) => {
  const map: Record<string, string> = {
    PROPRIA: "bg-emerald-100 text-emerald-800",
    GRUPO: "bg-blue-100 text-blue-800",
    LOCADO: "bg-amber-100 text-amber-800",
    NAO_CLASSIFICADO: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[p] || ""}`}>{p.replace("_", " ")}</Badge>;
};

/** CC atual — exclusivamente da projeção autoritativa (fn_veiculos_alocacao_atual). */
const ccLabel = (r: AtivoAnalise): string => {
  if (!r.centro_custo_nome && !r.centro_custo_codigo) return SEM_CENTRO_CUSTO_LABEL;
  return [r.centro_custo_codigo, r.centro_custo_nome].filter(Boolean).join(" — ");
};

/** Célula de CC: ausência é sinalizada explicitamente, nunca ocultada. */
const CcCell: React.FC<{ r: AtivoAnalise }> = ({ r }) => (
  <div className="flex flex-col gap-0.5">
    {r.possui_centro_custo_atual ? (
      <span className="text-xs">{ccLabel(r)}</span>
    ) : (
      <span className="text-xs italic text-muted-foreground">{SEM_CENTRO_CUSTO_LABEL}</span>
    )}
    {r.ja_no_centro_custo_destino && (
      <Badge variant="outline" className="w-fit text-[10px] bg-emerald-100 text-emerald-800">
        Já no destino
      </Badge>
    )}
  </div>
);

/** Compatibilidade com motivo detalhado (ex.: unidade de capacidade ausente). */
const CompatCell: React.FC<{ r: AtivoAnalise }> = ({ r }) => {
  const badge = (
    <Badge variant="outline" className="text-[10px]">
      {r.compatibilidade}
    </Badge>
  );
  if (!r.motivo_compatibilidade) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{r.motivo_compatibilidade}</TooltipContent>
    </Tooltip>
  );
};

/** Alerta de conflito cadastral — informa, nunca esconde nem bloqueia sozinho. */
const ConflitoIcon: React.FC<{ r: AtivoAnalise }> = ({ r }) => {
  if (!r.conflito_cadastral) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {r.conflito_cadastral_motivo} {ALERTA_CONFLITO_ATENDIMENTO}
      </TooltipContent>
    </Tooltip>
  );
};

const statusBadge = (s: AtivoAnalise["status_operacional"]) => {
  if (s === "SEM_STATUS") return <span className="text-xs text-muted-foreground">SEM STATUS</span>;
  const map: Record<string, string> = {
    DISPONIVEL: "bg-emerald-600 text-primary-foreground",
    ALOCADO: "bg-blue-600 text-primary-foreground",
    MANUTENCAO: "bg-amber-600 text-primary-foreground",
    INDISPONIVEL: "bg-destructive text-destructive-foreground",
    DESCONHECIDO: "bg-muted text-muted-foreground",
  };
  return <Badge className={`text-[10px] ${map[s] || ""}`}>{s}</Badge>;
};


/** CT-2.2 — Coluna de compromisso: nunca exibe ativo reservado como livre. */
const CompromissoCell: React.FC<{ estado?: CtEstadoEfetivoMap; id: string }> = ({ estado, id }) => {
  const info = estado?.get(id);
  if (!info) return <span className="text-xs text-muted-foreground">—</span>;
  const badge = badgeDoEstadoEfetivo(info);
  const conteudo = (
    <Badge className={`text-[10px] ${CLASSE_TOM[badge.tom]}`}>{badge.label}</Badge>
  );
  if (!badge.detalhe) return conteudo;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{conteudo}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{badge.detalhe}</TooltipContent>
    </Tooltip>
  );
};

interface AtivosTableProps {
  rows: AtivoAnalise[];
  empty: string;
  origem?: CtCandidateOrigem;
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
}

const AtivosTable: React.FC<AtivosTableProps> = ({ rows, empty, origem, selectedId = null, onSelect, estados }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Frota</TableHead>
          <TableHead className="text-xs">Nº Frota</TableHead>
          <TableHead className="text-xs">Placa</TableHead>
          <TableHead className="text-xs">Empresa</TableHead>
          <TableHead className="text-xs">Propriedade</TableHead>
          <TableHead className="text-xs">Capacidade</TableHead>
          <TableHead className="text-xs">CC atual</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Compromisso</TableHead>
          <TableHead className="text-xs">Compat.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-6">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow
              key={r.equipamento_id}
              data-state={selectedId === r.equipamento_id ? "selected" : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={onSelect && origem ? () => onSelect(r, origem) : undefined}
            >
              <TableCell className="text-xs">{r.frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.placa || "—"}</TableCell>
              <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
              <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
              <TableCell className="text-xs">
                {r.capacidade_valor != null ? `${r.capacidade_valor} ${r.capacidade_unidade || ""}` : "—"}
              </TableCell>
              <TableCell><CcCell r={r} /></TableCell>

              <TableCell>
                {statusBadge(r.status_operacional)}
                <ConflitoIcon r={r} />
              </TableCell>
              <TableCell><CompromissoCell estado={estados} id={r.equipamento_id} /></TableCell>
              <TableCell><CompatCell r={r} /></TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

interface PrevisaoTableProps {
  rows: AtivoAnalise[];
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
}

const PrevisaoTable: React.FC<PrevisaoTableProps> = ({ rows, selectedId = null, onSelect, estados }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Frota</TableHead>
          <TableHead className="text-xs">Nº Frota</TableHead>
          <TableHead className="text-xs">Propriedade</TableHead>
          <TableHead className="text-xs">CC atual</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Compromisso</TableHead>
          <TableHead className="text-xs">Previsão</TableHead>
          <TableHead className="text-xs">Confiab.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">
              Nenhum equipamento com previsão de liberação.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow
              key={r.equipamento_id}
              data-state={selectedId === r.equipamento_id ? "selected" : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={onSelect ? () => onSelect(r, "PREVISAO") : undefined}
            >
              <TableCell className="text-xs">{r.frota || "—"}</TableCell>
              <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
              <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
              <TableCell><CcCell r={r} /></TableCell>
              <TableCell>
                {statusBadge(r.status_operacional)}
                <ConflitoIcon r={r} />
              </TableCell>
              <TableCell><CompromissoCell estado={estados} id={r.equipamento_id} /></TableCell>
              <TableCell className="text-xs">
                {r.previsao_liberacao ? formatDateBR(r.previsao_liberacao) : "—"}
              </TableCell>
              <TableCell className="text-xs">{r.confiabilidade || "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const PortfolioTable: React.FC<{ rows: AnaliseOperacional["portfolioExterno"] }> = ({ rows }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Empresa</TableHead>
          <TableHead className="text-xs">Variação</TableHead>
          <TableHead className="text-xs">Qtd Estimada</TableHead>
          <TableHead className="text-xs">C/ Operador</TableHead>
          <TableHead className="text-xs">S/ Operador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
              Nenhum fornecedor externo no portfólio.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
              <TableCell className="text-xs">{r.variacao || "—"}</TableCell>
              <TableCell className="text-xs">{r.quantidade_estimada ?? "—"}</TableCell>
              <TableCell className="text-xs">
                {r.valor_com_operador != null ? `R$ ${Number(r.valor_com_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
              <TableCell className="text-xs">
                {r.valor_sem_operador != null ? `R$ ${Number(r.valor_sem_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const ResumoBox: React.FC<{ analise: AnaliseOperacional }> = ({ analise }) => {
  const r = analise.resumo;
  const d = analise.diagnosticoCapacidade;
  const linhas: { k: string; v: string | number }[] = [
    { k: "Quantidade solicitada", v: r.quantidade_solicitada },
    { k: "Total de candidatos cadastrados", v: r.total_candidatos },
    { k: "Próprios cadastrados", v: r.propria_cadastrada },
    { k: "Grupo cadastrados", v: r.grupo_cadastrado },
    { k: "Locados cadastrados", v: r.locado_cadastrado },
    { k: "Não classificados", v: r.nao_classificado },
    { k: "Disponíveis agora", v: r.disponiveis_agora },
    { k: "Sem status operacional", v: r.sem_status },
    { k: "Com previsão de liberação", v: r.com_previsao },
    { k: "Fornecedores compatíveis", v: r.fornecedores_compativeis },
    { k: "Compatibilidade", v: r.compatibilidade },
    { k: "Estratégia de matching", v: analise.matchingUsed },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-4 space-y-2 bg-muted/30">
        <div className="grid grid-cols-2 gap-2">
          {linhas.map((l) => (
            <div key={l.k} className="flex justify-between text-xs border-b py-1">
              <span className="text-muted-foreground">{l.k}</span>
              <span className="font-medium">{l.v}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground pt-1">
          Reconciliação: {r.total_candidatos} = {r.propria_cadastrada} própria + {r.grupo_cadastrado} grupo +{" "}
          {r.locado_cadastrado} externo + {r.nao_classificado} não classificado
          {analise.reconciliacao_ok ? " ✓" : " ✗"}
        </div>
      </div>

      {d && (
        <div className="rounded-md border p-4 space-y-1 text-xs">
          <h4 className="font-semibold text-muted-foreground uppercase tracking-wide text-[11px]">
            Diagnóstico de capacidade
          </h4>
          <div>{d.candidatos} candidato(s) da estratégia “{analise.matchingUsed}”</div>
          <div>{d.sem_capacidade} sem capacidade cadastrada</div>
          <div>{d.com_valor_sem_unidade} com valor de capacidade e unidade não informada</div>
          <div>
            {d.correspondencia_exata} com correspondência exata
            {d.capacidade_solicitada_valor != null
              ? ` a ${d.capacidade_solicitada_valor}${d.capacidade_solicitada_unidade ? ` ${d.capacidade_solicitada_unidade}` : ""}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
};


export default AnaliseOperacionalSheet;
