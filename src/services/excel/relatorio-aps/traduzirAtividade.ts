/**
 * Traduz o valor cru de `bd_registro_apontamento_aplicacao.atividade` em um
 * rótulo humano em maiúsculas usado no Excel de medição.
 *
 * Regras confirmadas (auditoria do banco em produção — valores encontrados):
 *  - "pavimentacao_mecanizada" → "PAVIMENTAÇÃO MECANIZADA"
 *  - "tapa_buraco"             → "TAPA-BURACO"
 *
 * Fallback: humaniza o slug (`snake_case` → capitalizado) e força uppercase.
 * Se `atividade` for nula/vazia, devolve "APLICAÇÃO NÃO INFORMADA".
 *
 * Não há mapeamento para "RECAPEAMENTO MANUAL": nenhum código correspondente
 * foi confirmado no banco. Adicionar somente após auditoria explícita.
 */

function humanizarAtividade(slug: string): string {
  return slug
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

export function traduzirAtividadeParaTipoAplicacao(
  atividade: string | null | undefined,
): string {
  const v = (atividade ?? "").trim();
  if (!v) return "APLICAÇÃO NÃO INFORMADA";
  switch (v) {
    case "pavimentacao_mecanizada":
      return "PAVIMENTAÇÃO MECANIZADA";
    case "tapa_buraco":
      return "TAPA-BURACO";
    default:
      return humanizarAtividade(v).toUpperCase();
  }
}

/**
 * Deduz o tipo de aplicação de um grupo de linhas.
 * - todas iguais: retorna esse tipo já traduzido.
 * - dois ou mais tipos distintos: "APLICAÇÃO MISTA".
 * - todas nulas: "APLICAÇÃO NÃO INFORMADA".
 */
export function deduzirTipoAplicacaoDoGrupo(
  atividades: Array<string | null | undefined>,
): string {
  const distintas = new Set(
    atividades.map((a) => (a ?? "").trim()).filter((s) => s.length > 0),
  );
  if (distintas.size === 0) return "APLICAÇÃO NÃO INFORMADA";
  if (distintas.size > 1) return "APLICAÇÃO MISTA";
  const [only] = Array.from(distintas);
  return traduzirAtividadeParaTipoAplicacao(only);
}
