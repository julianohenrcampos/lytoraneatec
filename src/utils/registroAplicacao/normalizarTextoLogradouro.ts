/**
 * Normaliza texto de logradouro para comparação (case/acento/espaço-insensível).
 * Retorna string vazia para null/undefined.
 */
export function normalizarTextoLogradouro(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
