/**
 * CT-3E — Etapa 1 "ATENDER": o ITEM é o foco; o ativo é a incógnita.
 *
 * Modelo mental implementado:
 *   1. cada item solicitado é um card-alvo (drop zone) com "( ? )" até existir
 *      ativo reservado;
 *   2. os candidatos aparecem como mini-cards compactos (verde/laranja/vermelho),
 *      arrastáveis, com fallback por clique/botão;
 *   3. soltar/vincular apenas dispara o MESMO fluxo CT-2 já existente
 *      (`fn_ct_atendimento_atribuir` através do modal de atribuição).
 *
 * Nenhuma regra operacional foi movida para o cliente: elegibilidade continua
 * vindo de `toCandidateSelection` (análise CT-1 + estado efetivo CT-2.2) e a
 * autorização final continua no servidor.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  ShoppingCart,
  Wrench,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type {
  CtAtendimento,
  CtCandidateOrigem,
  CtCandidateSelection,
} from "@/types/centralTransporteCT2";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import { tomDoCandidato } from "@/utils/central-transporte/ativoTomVisual";
import DimensoesAtivoPanel from "../analise/DimensoesAtivoPanel";
import AtivosVinculadosAccordion from "../atendimento/AtivosVinculadosAccordion";
import AtribuirAtendimentoModal from "../atendimento/AtribuirAtendimentoModal";
import EncerrarAtendimentoModal from "../atendimento/EncerrarAtendimentoModal";
import SubstituirAtendimentoModal from "../atendimento/SubstituirAtendimentoModal";
import RegularizarDisponibilidadeModal from "../RegularizarDisponibilidadeModal";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";
import AtivosCandidatosCards from "./AtivosCandidatosCards";
import ItemAlvoDropCard from "./ItemAlvoDropCard";
import { usePermission } from "@/hooks/usePermission";
import { Link } from "react-router-dom";
import { TEXTO_ACOES_BLOQUEADAS } from "@/utils/central-transporte/selecaoProgressiva";
import { useQuery } from "@tanstack/react-query";
import { getDepartamentoNome } from "@/services/centralTransporteDepartamentoService";
import { ativoDeDepartamentoAlternativo } from "@/utils/central-transporte/agruparCandidatosPorDepartamento";
import DepartamentoAlternativoDialog from "../atendimento/DepartamentoAlternativoDialog";
import { labelAtendimentoPreferencial } from "@/services/atendimentoPreferencialService";

const BLOQUEIO_RBAC = "Você não tem permissão para executar operações na Central do Transporte.";
const NAO_IMPLEMENTADO =
  "Cotação externa e indisponibilidade serão liberadas em fase posterior do CT-2.";

export const EtapaSelecao: React.FC = () => {
  const {
    itens,
    itemSelecionado,
    itemSelecionadoId,
    selecionarItem,
    contadoresDoItem,
    contadores,
    resumoDoItem,
    atendimentos,
    atendimentosLoading,
    analise,
    analiseLoading,
    estados,
    estadoStatus,
    estadoErro,
    recarregarEstados,
    solicitacao,
    solicitacaoId,
    capabilities: caps,
    ctOperation,
    irParaEtapa,
    onOperacaoConcluida,
  } = useCtSolicitacao();
  const { toast } = useToast();

  const [selecionado, setSelecionado] = useState<CtCandidateSelection | null>(null);
  const [modalAtribuir, setModalAtribuir] = useState<null | "INTERNO" | "RESERVA_FUTURA">(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<CtAtendimento | null>(null);
  const [substituirAlvo, setSubstituirAlvo] = useState<CtAtendimento | null>(null);
  const [regularizarAlvo, setRegularizarAlvo] = useState<CtCandidateSelection | null>(null);
  const [alternativoPendente, setAlternativoPendente] = useState<{
    candidato: CtCandidateSelection;
    ativo: AtivoAnalise;
    vincular: boolean;
  } | null>(null);
  /** Colapso manual (o usuário pediu "Alterar seleção" com tudo atendido). */
  const [expandirManualmente, setExpandirManualmente] = useState(false);

  const departamentoPreferencialId = solicitacao?.departamento_atendimento_preferencial_id ?? null;
  const depPrefQuery = useQuery({
    queryKey: ["ct5", "departamento-nome", departamentoPreferencialId],
    queryFn: () => getDepartamentoNome(departamentoPreferencialId),
    enabled: !!departamentoPreferencialId,
  });
  const departamentoPreferencialNome = depPrefQuery.data ?? null;
  const { hasActionPermission } = usePermission();
  const podeVerSaneamento = hasActionPermission("gestao_maquinas_caminhoes_view", "visualizar");

  const bloqueio: string | null = caps.isLoading
    ? "Verificando permissões..."
    : !caps.canCriar && !caps.canEditar
      ? BLOQUEIO_RBAC
      : null;

  const podeOperar = !bloqueio && !!itemSelecionadoId;
  const estadoDoSelecionado = selecionado ? estados.get(selecionado.equipamentoId) ?? null : null;
  const estadoNaoConsultado =
    !!selecionado && (estadoStatus !== "CONSULTADO" || !estadoDoSelecionado);
  const motivoEstado: string | null = !estadoNaoConsultado
    ? null
    : estadoStatus === "CARREGANDO"
      ? "Consultando o compromisso deste ativo..."
      : estadoStatus === "ERRO"
        ? `Falha ao consultar o compromisso${estadoErro?.code ? ` (${estadoErro.code})` : ""}${
            estadoErro?.message ? `: ${estadoErro.message}` : "."
          }`
        : "Este ativo não retornou na consulta de compromisso.";
  const precisaRegularizar = !!selecionado?.precisaRegularizarDisponibilidade;
  const compromissoBloqueia = !!selecionado?.compromissoBloqueia;
  const pendentes = contadores?.pendentes ?? 0;
  const temPendentes = pendentes > 0;

  const baseOperacao =
    podeOperar &&
    caps.canCriar &&
    temPendentes &&
    !!selecionado &&
    !compromissoBloqueia &&
    !estadoNaoConsultado &&
    !!ctOperation;
  const podeAtribuirInterno = baseOperacao && !!selecionado?.permiteInterno;
  const podeReservarFuturo = baseOperacao && !!selecionado?.permiteReservaFutura;
  const podeRegularizar = precisaRegularizar && !bloqueio && caps.canEditar;

  /* ---------- Conclusão material da etapa 1 (dado da RPC, nunca inferência) ---------- */
  const todosAtendidos = useMemo(() => {
    if (itens.length === 0) return false;
    return itens.every((i) => {
      const c = contadoresDoItem(i.id);
      return !!c && c.pendentes === 0;
    });
  }, [itens, contadoresDoItem]);

  const ativosVinculadosTodos = useMemo(
    () =>
      itens.flatMap((i) =>
        (resumoDoItem(i.id)?.atendimentos ?? []).filter(
          (a) => a.status === "RESERVADO" || a.status === "EM_TRANSPORTE" || a.status === "ENTREGUE",
        ),
      ),
    [itens, resumoDoItem],
  );

  // Avanço automático APENAS na TRANSIÇÃO false → true da conclusão da etapa 1.
  // Voltar manualmente para "Atender" quando ela já está concluída NÃO pode
  // re-disparar o autoavanço — o clique do stepper é autoritativo.
  const atendimentoAnteriorRef = useRef<boolean | null>(null);
  useEffect(() => {
    // Enquanto os itens não carregaram, não há transição material a observar.
    if (itens.length === 0) return;
    const anterior = atendimentoAnteriorRef.current;
    atendimentoAnteriorRef.current = todosAtendidos;
    const acabouDeConcluir = anterior === false && todosAtendidos === true;
    if (!acabouDeConcluir || expandirManualmente) return;
    const t = window.setTimeout(() => irParaEtapa("MOBILIZACAO"), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosAtendidos, expandirManualmente, itens.length]);

  const colapsado = todosAtendidos && !expandirManualmente;

  /* ---------- Seleção / vínculo ---------- */
  const candidatoDe = (ativo: AtivoAnalise, origem: CtCandidateOrigem) =>
    toCandidateSelection(ativo, origem, estados.get(ativo.equipamento_id) ?? null);

  const handleSelecionar = (ativo: AtivoAnalise, origem: CtCandidateOrigem) => {
    const cand = candidatoDe(ativo, origem);
    const desmarcando = !!selecionado && !!cand && selecionado.equipamentoId === cand.equipamentoId;
    if (!desmarcando && cand && ativoDeDepartamentoAlternativo(ativo, departamentoPreferencialId)) {
      setAlternativoPendente({ candidato: cand, ativo, vincular: false });
      return;
    }
    setSelecionado(desmarcando ? null : cand);
  };

  /** Abre a atribuição real com a modalidade elegível do próprio ativo. */
  const abrirAtribuicao = (cand: CtCandidateSelection) => {
    setSelecionado(cand);
    if (!itemSelecionado) {
      toast({
        title: "Escolha o item",
        description: "Coloque um item em foco antes de vincular um ativo.",
        variant: "destructive",
      });
      return;
    }
    if (!temPendentes) {
      toast({
        title: "Item sem vaga pendente",
        description: "Este item já possui a quantidade solicitada atendida.",
        variant: "destructive",
      });
      return;
    }
    if (cand.precisaRegularizarDisponibilidade) {
      toast({
        title: "Sem disponibilidade operacional",
        description: "Regularize a disponibilidade do ativo antes de vinculá-lo.",
        variant: "destructive",
      });
      return;
    }
    if (cand.compromissoBloqueia || (!cand.permiteInterno && !cand.permiteReservaFutura)) {
      toast({
        title: tomDoCandidato(cand).label,
        description: cand.compromissoDetalhe || "Este ativo não pode ser vinculado agora.",
        variant: "destructive",
      });
      return;
    }
    setModalAtribuir(cand.permiteInterno ? "INTERNO" : "RESERVA_FUTURA");
  };

  const vincularAtivo = (ativo: AtivoAnalise, origem: CtCandidateOrigem) => {
    const cand = candidatoDe(ativo, origem);
    if (!cand) return;
    if (ativoDeDepartamentoAlternativo(ativo, departamentoPreferencialId)) {
      setAlternativoPendente({ candidato: cand, ativo, vincular: true });
      return;
    }
    abrirAtribuicao(cand);
  };

  /** Drop de um ativo sobre o card do item: foca o item e abre a atribuição. */
  const soltarNoItem = (itemId: string, equipamentoId: string) => {
    if (itemId !== itemSelecionadoId) selecionarItem(itemId);
    const todos = analise
      ? [
          ...analise.disponibilidadePropria.map((a) => [a, "PROPRIA"] as const),
          ...analise.disponibilidadeGrupo.map((a) => [a, "GRUPO"] as const),
          ...analise.equipamentosComPrevisao.map((a) => [a, "PREVISAO"] as const),
          ...analise.externoLocado.map((a) => [a, "PREVISAO"] as const),
          ...(analise.naoClassificado ?? []).map((a) => [a, "PROPRIA"] as const),
        ]
      : [];
    const achado = todos.find(([a]) => a.equipamento_id === equipamentoId);
    if (!achado) {
      toast({
        title: "Ativo fora da lista atual",
        description: "Recarregue os candidatos do item antes de vincular este ativo.",
        variant: "destructive",
      });
      return;
    }
    vincularAtivo(achado[0], achado[1] as CtCandidateOrigem);
  };

  const concluir = () => {
    setSelecionado(null);
    setModalAtribuir(null);
    onOperacaoConcluida();
  };

  return (
    <div className="space-y-4" data-testid="ct3b-etapa-selecao-body">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Atender — escolha do ativo por item</h3>
        <span
          className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground"
          data-testid="ct5-direcionamento-preferencial"
        >
          Atendimento preferencial: {labelAtendimentoPreferencial(departamentoPreferencialNome)}
        </span>
      </div>

      {/* CT-7 — painel de vínculo rápido: ESQUERDA receptivo, DIREITA candidatos.
          O gesto natural é arrastar da direita para a esquerda; por isso a área
          receptiva NUNCA fica acima da lista no desktop. */}
      <div
        className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"
        data-testid="ct7-painel-vinculo"
      >
        {/* COLUNA ESQUERDA — cards receptivos (dropzones) */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start" data-testid="ct3e-itens-alvo">
          {itens.map((item) => (
            <ItemAlvoDropCard
              key={item.id}
              item={item}
              contadores={contadoresDoItem(item.id)}
              atendimentos={resumoDoItem(item.id)?.atendimentos ?? []}
              emFoco={item.id === itemSelecionadoId}
              podeReceber={!bloqueio && caps.canCriar}
              onFocar={() => {
                setSelecionado(null);
                setExpandirManualmente(true);
                selecionarItem(item.id);
              }}
              onSoltarAtivo={(equipamentoId) => soltarNoItem(item.id, equipamentoId)}
            />
          ))}
        </div>

        {/* COLUNA DIREITA — candidatos compactos (Recomendados / Alternativas) */}
        <div className="min-w-0 space-y-4" data-testid="ct7-coluna-candidatos">
      {colapsado ? (
        <Card data-testid="ct3e-etapa1-concluida" className="border-emerald-600/50 bg-emerald-600/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Todos os itens têm ativo escolhido
            </div>
            <div className="flex flex-wrap gap-1" data-testid="ct3e-ativos-vinculados">
              {ativosVinculadosTodos.map((a) => (
                <span key={a.id} className="rounded border px-2 py-0.5 text-[11px]">
                  {[a.equipamento_frota, a.equipamento_numero].filter(Boolean).join("-") ||
                    a.equipamento_placa ||
                    a.equipamento_id.slice(0, 8)}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-2"
                data-testid="ct3e-ir-transporte"
                onClick={() => irParaEtapa("MOBILIZACAO")}
              >
                <ArrowRight className="h-4 w-4" /> Definir transporte
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="ct3e-alterar-selecao"
                onClick={() => setExpandirManualmente(true)}
              >
                Alterar seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !itemSelecionadoId ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground" data-testid="ct3e-sem-item-foco">
              Escolha um item acima ("Escolher ativo") para ver os ativos candidatos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {analiseLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analise ? (
            <AtivosCandidatosCards
              analise={analise}
              estados={estados}
              estadoStatus={estadoStatus}
              estadoErro={estadoErro}
              onRetryEstados={recarregarEstados}
              selectedId={selecionado?.equipamentoId ?? null}
              departamentoPreferencialId={departamentoPreferencialId}
              departamentoPreferencialNome={departamentoPreferencialNome}
              podeOperar={podeOperar}
              onSelect={handleSelecionar}
              onVincular={vincularAtivo}
            />
          ) : null}

          {!selecionado ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground" data-testid="ct3b2-orientacao-candidato">
                  Arraste um mini-card de ativo para o card do item — ou use "Vincular ao item" —
                  para reservar o ativo. Clique simples apenas seleciona para conferir detalhes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <DimensoesAtivoPanel candidato={selecionado} estado={estadoDoSelecionado} />

              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span data-testid="ct3b2-acoes-mensagem">
                      {estadoNaoConsultado
                        ? `${TEXTO_ACOES_BLOQUEADAS} ${motivoEstado ?? ""}`.trim()
                        : bloqueio ||
                          (!temPendentes
                            ? "Item sem quantidade pendente — não há vaga para novos atendimentos."
                            : `Selecionado: ${selecionado.frota || selecionado.placa || selecionado.equipamentoId}`)}
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
                      <AlertTitle className="text-xs">
                        Sem disponibilidade operacional confirmada
                      </AlertTitle>
                      <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
                        <span>
                          Este ativo não possui registro operacional; o atendimento é bloqueado pelo
                          servidor (CT2_DISPONIBILIDADE_SEM_REGISTRO).
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          data-testid="ct2-btn-regularizar"
                          disabled={!podeRegularizar}
                          onClick={() => setRegularizarAlvo(selecionado)}
                        >
                          <Wrench className="h-3.5 w-3.5" /> Regularizar disponibilidade
                        </Button>
                        {podeVerSaneamento && (
                          <Link
                            to="/gestao-maquinas/caminhoes-equipamentos"
                            className="underline underline-offset-2"
                            data-testid="ct3b-link-saneamento"
                          >
                            Ver saneamento da frota
                          </Link>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                    <Button
                      disabled
                      variant="outline"
                      data-testid="ct2-btn-externo"
                      title={NAO_IMPLEMENTADO}
                      className="gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" /> Cotação Externa
                    </Button>
                    <Button
                      disabled
                      variant="destructive"
                      data-testid="ct2-btn-indisponivel"
                      title={NAO_IMPLEMENTADO}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" /> Indisponível
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <AtivosVinculadosAccordion
            loading={atendimentosLoading}
            atendimentos={atendimentos}
            canEditar={caps.canEditar}
            canCriar={caps.canCriar}
            bloqueioMotivo={bloqueio}
            chaveReset={itemSelecionadoId}
            onEncerrar={setEncerrarAlvo}
            onSubstituir={setSubstituirAlvo}
          />
        </>
      )}
        </div>
      </div>

      {modalAtribuir && selecionado && itemSelecionado && (
        <AtribuirAtendimentoModal
          open
          onClose={() => setModalAtribuir(null)}
          solicitacaoItemId={itemSelecionado.id}
          candidate={selecionado}
          modalidade={modalAtribuir}
          canAprovar={caps.canAprovar}
          ctOperation={ctOperation}
          onSuccess={concluir}
        />
      )}

      {encerrarAlvo && (
        <EncerrarAtendimentoModal
          open
          onClose={() => setEncerrarAlvo(null)}
          atendimento={encerrarAlvo}
          ctOperation={ctOperation}
          onSuccess={concluir}
        />
      )}

      {substituirAlvo && (
        <SubstituirAtendimentoModal
          open
          onClose={() => setSubstituirAlvo(null)}
          atendimento={substituirAlvo}
          candidate={selecionado}
          modalidade={selecionado?.permiteInterno ? "INTERNO" : "RESERVA_FUTURA"}
          ctOperation={ctOperation}
          onSuccess={concluir}
        />
      )}

      {alternativoPendente && (
        <DepartamentoAlternativoDialog
          open
          onClose={() => setAlternativoPendente(null)}
          solicitacaoId={solicitacaoId}
          equipamentoId={alternativoPendente.ativo.equipamento_id}
          identificacao={
            [alternativoPendente.ativo.frota, alternativoPendente.ativo.numero_frota]
              .filter(Boolean)
              .join(" ") ||
            alternativoPendente.ativo.placa ||
            alternativoPendente.ativo.equipamento_id
          }
          departamentoAtivoNome={alternativoPendente.ativo.departamento_nome}
          departamentoPreferencialNome={departamentoPreferencialNome}
          onConfirmado={() => {
            const { candidato, vincular } = alternativoPendente;
            setSelecionado(candidato);
            setAlternativoPendente(null);
            if (vincular) abrirAtribuicao(candidato);
          }}
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
          onSuccess={concluir}
        />
      )}
    </div>
  );
};

export default EtapaSelecao;
