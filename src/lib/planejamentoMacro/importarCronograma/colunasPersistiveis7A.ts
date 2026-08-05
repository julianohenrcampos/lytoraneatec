// Fase 7A — Whitelist de colunas persistíveis em bd_planejamento_atividades.
// Sem introspecção em runtime (information_schema NÃO é exposto ao client via PostgREST).
// Auditoria confirmou todas estas colunas no banco. Mudanças exigem nova fase.

export const COLUNAS_ATIVIDADES_PERSISTIVEIS_7A = [
  "planejamento_id",
  "criado_por",
  "uid_externo",
  "id_externo",
  "codigo_wbs",
  "outline_number",
  "outline_level",
  "nome",
  "descricao",
  "frente_servico",
  "data_inicio",
  "data_fim",
  "unidade",
  "quantidade_prevista",
  "producao_prevista",
  "prioridade",
  "duracao_horas",
  "trabalho_previsto_horas",
  "is_resumo",
  "is_marco",
  "status",
  "ordem_execucao",
  "arquivo_origem_nome",
  // Fase 1C
  "is_critica",
  "quantidade_origem",
] as const;

export type ColunaAtividadePersistivel7A =
  (typeof COLUNAS_ATIVIDADES_PERSISTIVEIS_7A)[number];

/**
 * Filtra um payload mantendo apenas as colunas da whitelist informada.
 * Remove chaves undefined (mantém null, false, 0).
 */
export function filtrarPayloadPersistivel<T extends Record<string, unknown>>(
  payload: T,
  whitelist: readonly string[],
): Record<string, unknown> {
  const set = new Set<string>(whitelist);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!set.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}
