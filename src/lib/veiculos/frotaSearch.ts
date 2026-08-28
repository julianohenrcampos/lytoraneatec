/**
 * Normalização de termos de busca para filtros de Veículos/Equipamentos.
 * Ignora acentuação, espaços, hífens, travessões, pontos e barras,
 * de modo que "LYE - 239", "lye239" e "LYE 239" sejam equivalentes.
 */

export const normalizeSearchTerm = (value?: string | null): string => {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
};

/** Verdadeiro quando o termo normalizado está contido no texto normalizado. */
export const matchesSearchTerm = (haystack?: string | null, term?: string | null): boolean => {
  const t = normalizeSearchTerm(term);
  if (!t) return true;
  return normalizeSearchTerm(haystack).includes(t);
};

export interface FrotaTermParts {
  /** Termo completo normalizado (ex.: "LYE239"). */
  full: string;
  /** Parte alfabética (sigla da frota), se houver. */
  sigla: string | null;
  /** Parte numérica (número da frota), se houver. */
  numero: string | null;
}

/**
 * Decompõe o termo de frota em sigla + número, ignorando separadores.
 * "LYE - 239" -> { sigla: "LYE", numero: "239" }
 * "239"       -> { sigla: null,  numero: "239" }
 * "LYE"       -> { sigla: "LYE", numero: null }
 */
export const parseFrotaTerm = (value?: string | null): FrotaTermParts => {
  const full = normalizeSearchTerm(value);
  if (!full) return { full: "", sigla: null, numero: null };

  const letras = full.replace(/[0-9]/g, "");
  const numeros = full.replace(/[^0-9]/g, "");

  return {
    full,
    sigla: letras || null,
    numero: numeros || null,
  };
};
