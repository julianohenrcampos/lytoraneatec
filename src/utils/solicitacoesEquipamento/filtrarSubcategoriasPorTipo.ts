import type { TipoItem } from "@/services/solicitacaoItensService";

export interface SubcategoriaOption {
  value: string;
  label: string;
  categoriaNome?: string | null;
}

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** true quando a subcategoria pertence à categoria correspondente ao tipo do item. */
export function pertenceAoTipo(
  categoriaNome: string | null | undefined,
  tipo: TipoItem,
): boolean {
  const c = norm(categoriaNome);
  if (!c) return true; // sem vínculo → não esconde
  const ehVeiculo = c.includes("veiculo");
  return tipo === "VEICULO" ? ehVeiculo : !ehVeiculo;
}

/**
 * Filtra as opções de subcategoria pelo tipo do item e, em seguida, pelo
 * filtro textual de categoria (quando informado). Se o filtro textual zerar
 * o resultado, prevalece o filtro por tipo.
 */
export function filtrarSubcategoriasPorTipo(
  options: SubcategoriaOption[],
  tipo: TipoItem,
  categoriaMatch?: string[],
): SubcategoriaOption[] {
  const porTipo = options.filter((o) => pertenceAoTipo(o.categoriaNome, tipo));
  const terms = (categoriaMatch || []).map(norm).filter(Boolean);
  if (terms.length === 0) return porTipo;
  const porTexto = porTipo.filter((o) => terms.some((t) => norm(o.label).includes(t)));
  return porTexto.length > 0 ? porTexto : porTipo;
}
