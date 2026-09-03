import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Clock, ShoppingCart, XCircle, AlertTriangle, Info, ShieldAlert, Wrench } from "lucide-react";
import {
  fetchAnaliseOperacional,
  AnaliseOperacional,
  AtivoAnalise,
} from "@/services/centralTransporteService";
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
import { AnaliseBody, MetaField } from "./analise/CandidatosAnalise";
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

  // CT-2.2: a LISTA de candidatos consulta SEM janela (null/null) — exibe o
  // compromisso real do ativo. A janela só é avaliada no modal de reserva.
  const estadoEfetivo = useEstadoEfetivoAtivos({
    equipamentoIds: idsCandidatos,
    periodoInicio: null,
    periodoFim: null,
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

export default AnaliseOperacionalSheet;
