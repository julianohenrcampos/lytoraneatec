/**
 * Formata display de item de solicitação de equipamento.
 * Fallback encadeado, sem depender de banco.
 */

export interface ItemDisplayInput {
  item_nao_catalogado?: boolean | null;
  catalogo_equipamento_id?: string | null;
  catalogo_descricao?: string | null;
  descricao_livre?: string | null;
  capacidade_descricao?: string | null;
  capacidade_valor?: number | null;
  capacidade_unidade?: string | null;
  subcategoria_id?: string | null;
  subcategoria_nome?: string | null;
  _displayName?: string | null;
}

export const buildCapacidadeText = (
  valor?: number | null,
  unidade?: string | null,
  fallback?: string | null,
): string | null => {
  if (valor != null) {
    return `${valor}${unidade ? ` ${unidade}` : ""}`;
  }
  const fb = (fallback || "").trim();
  return fb || null;
};

export const buildSubcatCapacidade = (
  subcategoriaNome?: string | null,
  valor?: number | null,
  unidade?: string | null,
  capacidadeDescricao?: string | null,
): string | null => {
  const cap = buildCapacidadeText(valor, unidade, capacidadeDescricao);
  const nome = (subcategoriaNome || "").trim() || null;
  const parts = [nome, cap].filter(Boolean) as string[];
  return parts.length ? parts.join(" — ") : null;
};

export const formatItemDisplay = (item: ItemDisplayInput): string => {
  if (item._displayName && item._displayName.trim()) return item._displayName.trim();
  if (item.catalogo_descricao && item.catalogo_descricao.trim()) return item.catalogo_descricao.trim();
  if (item.descricao_livre && item.descricao_livre.trim()) return item.descricao_livre.trim();
  const sc = buildSubcatCapacidade(
    item.subcategoria_nome,
    item.capacidade_valor,
    item.capacidade_unidade,
    item.capacidade_descricao,
  );
  if (sc) return sc;
  if (item.capacidade_descricao && item.capacidade_descricao.trim()) return item.capacidade_descricao.trim();
  return "Item não informado";
};

export const isNaoCadastrado = (item: ItemDisplayInput | null | undefined): boolean => {
  if (!item) return false;
  return !!item.item_nao_catalogado || !item.catalogo_equipamento_id;
};
