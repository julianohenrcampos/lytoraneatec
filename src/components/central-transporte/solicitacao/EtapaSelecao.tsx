/**
 * CT-3B — Etapa 2: seleção dos ativos do item.
 *
 * Reaproveita integralmente os contratos CT-2/CT-2.2:
 *  - candidatos via AnaliseBody (mesmo componente compartilhado do modal);
 *  - elegibilidade via toCandidateSelection (fail-closed, estado efetivo);
 *  - operações via os mesmos modais e o mesmo motor de idempotência.
 *
 * A navegação lateral permite atender vários itens sem sair da página, sem
 * perder tentativas pendentes (o motor vive no provider).
 */
import React, { useState } from "react";
import {
  AlertTriangle,
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
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtAtendimento, CtCandidateOrigem, CtCandidateSelection } from "@/types/centralTransporteCT2";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import { AnaliseBody } from "../analise/CandidatosAnalise";
import DimensoesAtivoPanel from "../analise/DimensoesAtivoPanel";
import AtivosVinculadosAccordion from "../atendimento/AtivosVinculadosAccordion";
import AtribuirAtendimentoModal from "../atendimento/AtribuirAtendimentoModal";
import EncerrarAtendimentoModal from "../atendimento/EncerrarAtendimentoModal";
import SubstituirAtendimentoModal from "../atendimento/SubstituirAtendimentoModal";
import RegularizarDisponibilidadeModal from "../RegularizarDisponibilidadeModal";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";
import ItemSelectorBar from "./ItemSelectorBar";
import SelecaoItemVazio from "./SelecaoItemVazio";
import { usePermission } from "@/hooks/usePermission";
import { Link } from "react-router-dom";
import {
  TEXTO_ACOES_BLOQUEADAS,
  TEXTO_ORIENTACAO_CANDIDATO,
} from "@/utils/central-transporte/selecaoProgressiva";


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
    atendimentos,
    atendimentosLoading,
    analise,
    analiseLoading,
    recarregarAnalise,
    estados,
    estadoStatus,
    estadoErro,
    recarregarEstados,
    capabilities: caps,
    ctOperation,
    irParaEtapa,
    onOperacaoConcluida,
  } = useCtSolicitacao();

  const [selecionado, setSelecionado] = useState<CtCandidateSelection | null>(null);
  const [modalAtribuir, setModalAtribuir] = useState<null | "INTERNO" | "RESERVA_FUTURA">(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<CtAtendimento | null>(null);
  const [substituirAlvo, setSubstituirAlvo] = useState<CtAtendimento | null>(null);
  const [regularizarAlvo, setRegularizarAlvo] = useState<CtCandidateSelection | null>(null);
  const { hasActionPermission } = usePermission();
  const podeVerSaneamento = hasActionPermission("gestao_maquinas_caminhoes_view", "visualizar");

  const bloqueio: string | null = !itemSelecionado
    ? "Selecione um item na barra superior para operar."
    : caps.isLoading
      ? "Verificando permissões..."
      : !caps.canCriar && !caps.canEditar
        ? BLOQUEIO_RBAC
        : null;

  const podeOperar = !bloqueio;
  // Fail-closed: sem estado efetivo consultado, nenhuma operação é liberada.
  const estadoDoSelecionado = selecionado ? estados.get(selecionado.equipamentoId) ?? null : null;
  const estadoNaoConsultado = !!selecionado && (estadoStatus !== "CONSULTADO" || !estadoDoSelecionado);
  // CT-2.2 — três causas distintas, nunca colapsadas em uma só mensagem.
  const motivoEstado: string | null = !estadoNaoConsultado
    ? null
    : estadoStatus === "CARREGANDO"
      ? "Consultando o compromisso deste ativo..."
      : estadoStatus === "ERRO"
        ? `Falha ao consultar o compromisso${estadoErro?.code ? ` (${estadoErro.code})` : ""}${
            estadoErro?.message ? `: ${estadoErro.message}` : "."
          }${estadoErro?.hint ? ` ${estadoErro.hint}` : ""}`
        : "Este ativo não retornou na consulta de compromisso (fora do escopo ou sem registro correspondente).";
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
  const podeRegularizar = precisaRegularizar && podeOperar && caps.canEditar;

  const handleSelecionar = (ativo: AtivoAnalise, origem: CtCandidateOrigem) => {
    const cand = toCandidateSelection(ativo, origem, estados.get(ativo.equipamento_id) ?? null);
    setSelecionado((atual) =>
      atual && cand && atual.equipamentoId === cand.equipamentoId ? null : cand,
    );
  };

  const concluir = () => {
    setSelecionado(null);
    onOperacaoConcluida();
  };

  // CT-3B.2 — sem item escolhido a etapa fica colapsada: nenhuma busca,
  // aba, candidato, painel ou ação é montada.
  if (!itemSelecionadoId) {
    return (
      <SelecaoItemVazio
        itens={itens}
        contadoresDoItem={contadoresDoItem}
        onSelecionarItem={(id) => {
          setSelecionado(null);
          selecionarItem(id);
        }}
        onVerTodosItens={() => irParaEtapa("ITENS")}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="ct3b-etapa-selecao-body">
      <h3 className="text-sm font-semibold">Seleção dos ativos</h3>

      {/* CT-3B.1 — navegação entre itens na barra superior (sem coluna lateral). */}
      <ItemSelectorBar
        itens={itens}
        itemSelecionadoId={itemSelecionadoId}
        contadoresDoItem={contadoresDoItem}
        onSelecionarItem={(id) => {
          setSelecionado(null);
          selecionarItem(id);
        }}
        onVerTodosItens={() => irParaEtapa("ITENS")}
      />

      <div className="space-y-4 min-w-0">
        {analiseLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : analise ? (
          <AnaliseBody
            analise={analise}
            onRetry={recarregarAnalise}
            selectedId={selecionado?.equipamentoId ?? null}
            onSelect={podeOperar ? handleSelecionar : undefined}
            estados={estados}
            estadoStatus={estadoStatus}
            estadoErro={estadoErro}
            onRetryEstados={recarregarEstados}
          />
        ) : null}

        {/* CT-3B.2 — detalhes e ações só existem após escolher um candidato. */}
        {!selecionado ? (
          <Card>
            <CardContent className="p-4">
              <p
                className="text-xs text-muted-foreground"
                data-testid="ct3b2-orientacao-candidato"
              >
                {TEXTO_ORIENTACAO_CANDIDATO}
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
                <AlertTitle className="text-xs">Sem disponibilidade operacional confirmada</AlertTitle>
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
              <Button disabled variant="outline" data-testid="ct2-btn-externo" title={NAO_IMPLEMENTADO} className="gap-2">
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

        {/* CT-3B.2 — vinculados sob demanda, sem contadores redundantes. */}
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
