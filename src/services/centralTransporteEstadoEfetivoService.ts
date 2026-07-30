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
  if (!id) return null;
  return {
    atendimentoId: id,
    status: String(r.status ?? ""),
    periodoInicio: str(r.periodo_inicio),
    periodoFim: str(r.periodo_fim),
    solicitacaoId: str(r.solicitacao_id),
    solicitacaoItemId: str(r.solicitacao_item_id),
  };
};

const parseLista = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const parseItem = (value: unknown): CtEstadoEfetivoAtivo | null => {
  const r = asRecord(value);
  const equipamentoId = str(r.equipamento_id);
  if (!equipamentoId) return null;

  const periodo = asRecord(r.periodo_comprometido);

  return {
    equipamentoId,
    centroCustoId: str(r.centro_custo_id),
    condicaoOperacional: String(r.condicao_operacional ?? "SEM_STATUS"),
    possuiRegistroOperacional: r.possui_registro_operacional === true,
    previsaoLiberacao: str(r.previsao_liberacao),
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
    possuiAnomaliaSobreposicao: r.possui_anomalia_sobreposicao === true,
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
    if (error) throw error;

    const payload = asRecord(data);
    const itens = Array.isArray(payload.itens) ? payload.itens : [];
    for (const bruto of itens) {
      const item = parseItem(bruto);
      if (item) mapa.set(item.equipamentoId, item);
    }
  }

  return mapa;
};

export default fetchEstadoEfetivoAtivos;
