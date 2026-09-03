/**
 * Utilitários de normalização de chave de rua para o Registro Manual de Aplicação.
 * A chave normalizada é usada para deduplicar ruas dentro de um mesmo registro:
 * ao clicar "Iniciar aplicação nesta rua" com dados iguais (após normalização),
 * a rua existente é reutilizada em vez de duplicada.
 */

const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const norm = (s: string | null | undefined): string =>
  stripAccents(String(s ?? ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export interface RuaKeyParts {
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export function normalizeRuaKey(parts: RuaKeyParts): string {
  return [parts.logradouro, parts.bairro, parts.cidade, parts.uf]
    .map((p) => norm(p))
    .join("|");
}

/** Descrição amigável (usada em toasts / autocomplete de ruas já cadastradas). */
export function describeRua(parts: RuaKeyParts): string {
  const l = (parts.logradouro || "").trim();
  const b = (parts.bairro || "").trim();
  if (l && b) return `${l} — ${b}`;
  return l || b || "Rua sem nome";
}
