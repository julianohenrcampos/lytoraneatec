/**
 * CT-2.2 — Service da RPC `fn_ct_estado_efetivo_lote`.
 *
 * Escrita nenhuma: leitura em lote, escopo resolvido no servidor.
 * A RPC aceita de 1 a 500 UUIDs por chamada; este service fatia a lista e
 * deduplica antes de enviar, preservando a ordem estável do retorno.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  CT_ESTADO_EFETIVO_MAX_IDS,
  type CtAgendaAtivo,
  type CtCompromisso,
  type CtCompromissoAtivo,
  type CtEstadoEfetivoAtivo,
  type CtEstadoEfetivoMap,
  type CtEstadoEfetivoParams,
  type CtEstadoExibicao,
} from "@/types/centralTransporteEstadoEfetivo";


const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const parseCompromisso = (value: unknown): CtCompromisso | null => {
  const r = asRecord(value);
  const id = str(r.atendimento_id);
  const restrito = r.detalhes_restritos === true;
  if (!id && !restrito) return null;
  return {
    atendimentoId: id,
    status: String(r.status ?? ""),
    periodoInicio: str(r.periodo_inicio),
    periodoFim: str(r.periodo_fim),
    solicitacaoId: str(r.solicitacao_id),
    solicitacaoItemId: str(r.solicitacao_item_id),
    detalhesRestritos: restrito,
  };
};

const parseLista = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** CT-2.3 — agenda já consolidada no servidor (intervalos unidos). */
const parseAgenda = (value: unknown): CtAgendaAtivo | null => {
  const r = asRecord(value);
  if (Object.keys(r).length === 0) return null;
  const motivo = str(r.motivo_conflito);
  return {
    disponivelAte: str(r.disponivel_ate),
    blocoComprometidoInicio: str(r.bloco_comprometido_inicio),
    blocoComprometidoFim: str(r.bloco_comprometido_fim),
    proximaDisponibilidade: str(r.proxima_disponibilidade),
    proximaReservaInicio: str(r.proxima_reserva_inicio),
    proximaReservaFim: str(r.proxima_reserva_fim),
    conflitoOperacional: r.conflito_operacional === true,
    motivoConflito:
      motivo === "COMPROMISSO_VENCIDO_ATIVO" || motivo === "SOBREPOSICAO_DETECTADA"
        ? motivo
        : null,
  };
};

const VIGENCIAS: ReadonlySet<string> = new Set([
  "ATUAL",
  "FUTURO",
  "CONFLITO",
  "SEM_COMPROMISSO",
]);

const parseItem = (value: unknown): CtEstadoEfetivoAtivo | null => {
  const r = asRecord(value);
  const equipamentoId = str(r.equipamento_id);
  if (!equipamentoId) return null;

  const periodo = asRecord(r.periodo_comprometido);

  // CT-2.4 (aditivo) — compromisso principal: vigente hoje ou o próximo agendado.
  const vigenciaBruta = String(r.compromisso_principal_vigencia ?? "");
  const compromissoPrincipal = parseCompromisso(r.compromisso_principal);

  return {
    equipamentoId,
    centroCustoId: str(r.centro_custo_id),
    condicaoOperacional: String(r.condicao_operacional ?? "SEM_STATUS"),
    possuiRegistroOperacional: r.possui_registro_operacional === true,
    previsaoLiberacao: str(r.previsao_liberacao),
    dataInicioDisponibilidade: str(r.data_inicio_disponibilidade),
    agenda: parseAgenda(r.agenda),
    compromissoAtivo: (String(r.compromisso_ativo ?? "LIVRE") as CtCompromissoAtivo),
    compromissoAtual: parseCompromisso(r.compromisso_atual),
    proximoCompromisso: parseCompromisso(r.proximo_compromisso),
    quantidadeCompromissosFuturos: Number(r.quantidade_compromissos_futuros ?? 0),

    compromissosNaJanela: Array.isArray(r.compromissos_na_janela)
      ? r.compromissos_na_janela
          .map(parseCompromisso)
          .filter((c): c is CtCompromisso => c !== null)
      : [],
    quantidadeCompromissosNaJanela: Number(r.quantidade_compromissos_na_janela ?? 0),
    possuiSobreposicaoNaJanela: r.possui_sobreposicao_na_janela === true,
    possuiAnomaliaSobreposicao: r.possui_anomalia_sobreposicao === true,
    possuiCompromissoVencidoAtivo: r.possui_compromisso_vencido_ativo === true,

    /* ---------- CT-2.4 (aditivo) ---------- */
    possuiCompromissoAtualOuFuturo: r.possui_compromisso_atual_ou_futuro === true,
    compromissoPrincipal,
    compromissoPrincipalStatus: str(r.compromisso_principal_status),
    compromissoPrincipalInicio: str(r.compromisso_principal_inicio),
    compromissoPrincipalFim: str(r.compromisso_principal_fim),
    compromissoPrincipalVigencia: (VIGENCIAS.has(vigenciaBruta)
      ? vigenciaBruta
      : "SEM_COMPROMISSO") as CtEstadoEfetivoAtivo["compromissoPrincipalVigencia"],
    reservadoPelaCentral: r.reservado_pela_central === true,
    /* ------------- fim CT-2.4 ------------- */

    periodoComprometido:
      str(periodo.inicio) || str(periodo.fim)
        ? { inicio: str(periodo.inicio), fim: str(periodo.fim) }
        : null,
    atendimentoId: str(r.atendimento_id),
    solicitacaoId: str(r.solicitacao_id),
    solicitacaoItemId: str(r.solicitacao_item_id),
    estadoLogistico: "SEM_MOVIMENTACAO",
    estadoExibicao: (String(r.estado_exibicao ?? "INDISPONIVEL_PARA_ATENDIMENTO") as CtEstadoExibicao),
    alertas: parseLista(r.alertas),
    bloqueios: parseLista(r.bloqueios),
    origemDecisao: String(r.origem_decisao ?? "CT2_2_ESTADO_EFETIVO"),
  };
};

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** Erro tipado da consulta de estado efetivo (preserva code/hint do PostgREST). */
export class CtEstadoEfetivoError extends Error {
  readonly code: string | null;
  readonly hint: string | null;
  readonly details: string | null;
  constructor(params: {
    message: string;
    code?: string | null;
    hint?: string | null;
    details?: string | null;
  }) {
    super(params.message);
    this.name = "CtEstadoEfetivoError";
    this.code = params.code ?? null;
    this.hint = params.hint ?? null;
    this.details = params.details ?? null;
  }
}

/**
 * Consulta o estado efetivo dos ativos informados, em blocos de até 500 IDs.
 * Ativos fora do escopo do usuário simplesmente não retornam.
 */
export const fetchEstadoEfetivoAtivos = async (
  params: CtEstadoEfetivoParams,
): Promise<CtEstadoEfetivoMap> => {
  const ids = Array.from(
    new Set((params.equipamentoIds ?? []).filter((id): id is string => !!id)),
  );
  const mapa = new Map<string, CtEstadoEfetivoAtivo>();
  if (ids.length === 0) return mapa;

  for (const bloco of chunk(ids, CT_ESTADO_EFETIVO_MAX_IDS)) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (RPC CT-2.2 fora dos tipos gerados) */
    const { data, error } = await (supabase as any).rpc("fn_ct_estado_efetivo_lote", {
      p_equipamento_ids: bloco,
      p_centro_custo_ids: params.centroCustoIds ?? null,
      p_periodo_inicio: params.periodoInicio ?? null,
      p_periodo_fim: params.periodoFim ?? null,
    });
    if (error) {
      // Diagnóstico CT-2.2: detalhe técnico apenas em desenvolvimento.
      if (import.meta.env.DEV) {
        console.error("[CT2_2][ESTADO_EFETIVO][RPC_ERRO]", {
          code: error.code ?? null,
          message: error.message ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
          ids_total: ids.length,
          bloco_tamanho: bloco.length,
          periodo_inicio: params.periodoInicio ?? null,
          periodo_fim: params.periodoFim ?? null,
        });
      }

      throw new CtEstadoEfetivoError({
        message: error.message ?? "Falha ao consultar o estado efetivo dos ativos.",
        code: error.code ?? null,
        hint: error.hint ?? null,
        details: error.details ?? null,
      });
    }

    const payload = asRecord(data);
    const itens = Array.isArray(payload.itens) ? payload.itens : [];
    for (const bruto of itens) {
      const item = parseItem(bruto);
      if (item) mapa.set(item.equipamentoId, item);
    }
  }

  // Diagnóstico CT-2.2: sucesso com lacuna (ativos enviados que não voltaram).
  if (mapa.size < ids.length && import.meta.env.DEV) {
    const ausentes = ids.filter((id) => !mapa.has(id));
    console.error("[CT2_2][ESTADO_EFETIVO][LACUNA_RETORNO]", {
      ids_enviados: ids.length,
      ids_retornados: mapa.size,
      ausentes_total: ausentes.length,
      ausentes_amostra: ausentes.slice(0, 10),
      periodo_inicio: params.periodoInicio ?? null,
      periodo_fim: params.periodoFim ?? null,
    });
  }


  return mapa;
};

export default fetchEstadoEfetivoAtivos;

