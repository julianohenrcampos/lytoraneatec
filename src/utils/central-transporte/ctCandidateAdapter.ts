/**
 * CT-2 / M4 — Adapter tipado entre a análise operacional CT-1 (AtivoAnalise)
 * e a seleção de candidato consumida pelas operações CT-2.
 *
 * A elegibilidade NUNCA vem da aba ativa: deriva exclusivamente dos dados
 * reais do ativo (status operacional, previsão de liberação e — desde a
 * CT-2.2 — o compromisso ativo devolvido por fn_ct_estado_efetivo_lote).
 */
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtCandidateOrigem, CtCandidateSelection } from "@/types/centralTransporteCT2";
import type { CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import { badgeDoEstadoEfetivo } from "@/utils/central-transporte/estadoEfetivoBadges";

const ccLabel = (a: AtivoAnalise): string | null => {
  const parts = [a.centro_custo_codigo, a.centro_custo_nome].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
};

/**
 * G0 (fail-closed): sem registro operacional confirmado o ativo NUNCA é
 * reservável — nem interno, nem reserva futura. O backend aplica o mesmo
 * bloqueio (CT2_DISPONIBILIDADE_SEM_REGISTRO), sem override.
 *
 * CT-2.2: compromisso ativo (reserva/transporte/entrega) ou conflito de
 * sobreposição também bloqueiam, no cliente e no banco (exclusion constraint).
 *
 * INTERNO exige disponibilidade imediata confirmada.
 * RESERVA_FUTURA exige previsão de liberação conhecida.
 */
export const toCandidateSelection = (
  ativo: AtivoAnalise,
  origem: CtCandidateOrigem,
  estadoEfetivo?: CtEstadoEfetivoAtivo | null,
): CtCandidateSelection | null => {
  if (!ativo?.equipamento_id) return null;

  const possuiRegistro = !!ativo.possui_registro_disponibilidade;
  const badge = estadoEfetivo ? badgeDoEstadoEfetivo(estadoEfetivo) : null;
  const comprometido = !!badge?.bloqueiaOperacao;

  return {
    equipamentoId: ativo.equipamento_id,
    origem,
    matchTipo: ativo.compatibilidade === "EXATA" ? "EXATO" : "PARCIAL",
    disponibilidadeStatus: ativo.status_operacional,
    previsaoLiberacao: ativo.previsao_liberacao ?? null,
    permiteInterno: possuiRegistro && !comprometido && ativo.status_operacional === "DISPONIVEL",
    permiteReservaFutura: possuiRegistro && !comprometido && !!ativo.previsao_liberacao,
    /** true ⇒ exige regularização humana antes de qualquer atendimento. */
    precisaRegularizarDisponibilidade: !possuiRegistro,
    frota: ativo.frota ?? null,
    numeroFrota: ativo.numero_frota ?? null,
    placa: ativo.placa ?? null,
    centroCustoLabel: ccLabel(ativo),

    possuiRegistroDisponibilidade: possuiRegistro,
    possuiCentroCustoAtual: ativo.possui_centro_custo_atual,
    jaNoCentroCustoDestino: ativo.ja_no_centro_custo_destino,
    situacaoCadastral: ativo.situacao_cadastral ?? null,
    conflitoCadastral: ativo.conflito_cadastral,
    conflitoCadastralMotivo: ativo.conflito_cadastral_motivo ?? null,
    bloqueioMotivo: ativo.bloqueio_motivo ?? null,
    matchMotivo: ativo.motivo_compatibilidade ?? null,

    /* --- CT-2.2 — compromisso real do ativo --- */
    compromissoAtivo: estadoEfetivo?.compromissoAtivo ?? null,
    estadoExibicao: estadoEfetivo?.estadoExibicao ?? null,
    compromissoBloqueia: comprometido,
    compromissoLabel: badge?.label ?? null,
    compromissoDetalhe: badge?.detalhe ?? null,
    possuiAnomaliaSobreposicao: estadoEfetivo?.possuiAnomaliaSobreposicao ?? false,
  };
};


export const candidateLabel = (c: CtCandidateSelection): string =>
  [c.frota, c.numeroFrota].filter(Boolean).join(" ") || c.placa || c.equipamentoId;
