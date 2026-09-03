/**
 * CT-9 — Camada "ATENDER" reutilizável dentro do Atendimento Builder.
 *
 * Extrai da antiga etapa separada exatamente o que o Builder precisa:
 *   - rail de candidatos (mesma fonte: análise CT-1 + estado efetivo CT-2.2);
 *   - faixa de itens solicitados como alvos de drop;
 *   - modais autoritativos de atribuição/substituição/regularização.
 *
 * NENHUMA regra migrou para o cliente: o vínculo continua sendo feito pelo
 * `AtribuirAtendimentoModal` (fn_ct_atendimento_atribuir) e a troca pelo
 * `SubstituirAtendimentoModal` (fn_ct_atendimento_substituir).
 */
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type {
  CtAtendimento,
  CtCandidateOrigem,
  CtCandidateSelection,
} from "@/types/centralTransporteCT2";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import { tomDoCandidato } from "@/utils/central-transporte/ativoTomVisual";
import { ativoDeDepartamentoAlternativo } from "@/utils/central-transporte/agruparCandidatosPorDepartamento";
import { getDepartamentoNome } from "@/services/centralTransporteDepartamentoService";
import { labelAtendimentoPreferencial } from "@/services/atendimentoPreferencialService";
import AtribuirAtendimentoModal from "../../atendimento/AtribuirAtendimentoModal";
import SubstituirAtendimentoModal from "../../atendimento/SubstituirAtendimentoModal";
import DepartamentoAlternativoDialog from "../../atendimento/DepartamentoAlternativoDialog";
import RegularizarDisponibilidadeModal from "../../RegularizarDisponibilidadeModal";
import AtivosCandidatosCards from "../AtivosCandidatosCards";
import { useCtSolicitacao } from "../CentralTransporteSolicitacaoProvider";
import ItemAtendimentoAlvoCard from "./ItemAtendimentoAlvoCard";

export interface AtenderVinculoApi {
  /** Rail esquerdo — candidatos compactos com busca e scroll interno. */
  railCandidatos: React.ReactNode;
  /** Faixa do canvas — itens solicitados como alvos do gesto. */
  itensStrip: React.ReactNode;
  /** Modais autoritativos (renderizar uma única vez na árvore). */
  modais: React.ReactNode;
  /** Itens ainda sem ativo reservado (pendência compacta do Builder). */
  itensSemAtivo: number;
}

export const useAtenderVinculo = (): AtenderVinculoApi => {
  const {
    itens,
    itemSelecionado,
    itemSelecionadoId,
    selecionarItem,
    contadoresDoItem,
    contadores,
    resumoDoItem,
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
    onOperacaoConcluida,
  } = useCtSolicitacao();
  const { toast } = useToast();

  const [selecionado, setSelecionado] = useState<CtCandidateSelection | null>(null);
  const [modalAtribuir, setModalAtribuir] = useState<null | "INTERNO" | "RESERVA_FUTURA">(null);
  const [substituirAlvo, setSubstituirAlvo] = useState<CtAtendimento | null>(null);
  const [regularizarAlvo, setRegularizarAlvo] = useState<CtCandidateSelection | null>(null);
  const [alternativoPendente, setAlternativoPendente] = useState<{
    candidato: CtCandidateSelection;
    ativo: AtivoAnalise;
    vincular: boolean;
  } | null>(null);

  const departamentoPreferencialId = solicitacao?.departamento_atendimento_preferencial_id ?? null;
  const depPrefQuery = useQuery({
    queryKey: ["ct5", "departamento-nome", departamentoPreferencialId],
    queryFn: () => getDepartamentoNome(departamentoPreferencialId),
    enabled: !!departamentoPreferencialId,
  });
  const departamentoPreferencialNome = depPrefQuery.data ?? null;

  const bloqueio: string | null = caps.isLoading
    ? "Verificando permissões..."
    : !caps.canCriar && !caps.canEditar
      ? "Você não tem permissão para executar operações na Central do Transporte."
      : null;
  const podeOperar = !bloqueio && !!itemSelecionadoId;
  const temPendentes = (contadores?.pendentes ?? 0) > 0;

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
      setRegularizarAlvo(cand);
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
    setSubstituirAlvo(null);
    onOperacaoConcluida();
  };

  const itensSemAtivo = itens.filter((i) => {
    const c = contadoresDoItem(i.id);
    return (c?.pendentes ?? i.quantidade) > 0;
  }).length;

  const railCandidatos = (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2.5" data-testid="ct9-rail-candidatos">
      <p className="flex flex-wrap items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Ativos candidatos
        <span className="ml-auto normal-case" data-testid="ct9-direcionamento-preferencial">
          {labelAtendimentoPreferencial(departamentoPreferencialNome)}
        </span>
      </p>
      {!itemSelecionadoId ? (
        <p className="text-[11px] text-muted-foreground" data-testid="ct9-sem-item-foco">
          Escolha um item no canvas ("Escolher ativo") para ver os candidatos compatíveis.
        </p>
      ) : analiseLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : analise ? (
        <AtivosCandidatosCards
          compacto
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
    </div>
  );

  const itensStrip = (
    <div className="space-y-2" data-testid="ct9-itens-alvo">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Itens solicitados
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {itens.map((item) => (
          <ItemAtendimentoAlvoCard
            key={item.id}
            item={item}
            contadores={contadoresDoItem(item.id)}
            atendimentos={resumoDoItem(item.id)?.atendimentos ?? []}
            emFoco={item.id === itemSelecionadoId}
            podeReceber={!bloqueio && caps.canCriar}
            onFocar={() => {
              setSelecionado(null);
              selecionarItem(item.id);
            }}
            onSoltarAtivo={(equipamentoId) => soltarNoItem(item.id, equipamentoId)}
            onSubstituir={caps.canEditar ? (a) => setSubstituirAlvo(a) : undefined}
          />
        ))}
      </div>
    </div>
  );

  const modais = (
    <>
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
    </>
  );

  return { railCandidatos, itensStrip, modais, itensSemAtivo };
};

export default useAtenderVinculo;
