/**
 * Formatadores compartilhados do Relatório AP's.
 * B.3.5-E4-A — usados em tela + Excel; futuramente PDF.
 */

/**
 * Formata tonelada removendo zeros à direita, com até 3 casas decimais e vírgula pt-BR.
 * 14       → "14"
 * 14.5     → "14,5"
 * 14.25    → "14,25"
 * 14.275   → "14,275"
 * 14.2758  → "14,276"  (arredonda 3 casas)
 */
export function formatTonelada(t: number | null | undefined): string {
  if (t == null || Number.isNaN(t)) return "—";
  const fixed = Number(t).toFixed(3); // "14.000" | "14.500"
  let [intPart, decPart = ""] = fixed.split(".");
  decPart = decPart.replace(/0+$/, ""); // remove zeros à direita
  return decPart.length > 0 ? `${intPart},${decPart}` : intPart;
}

/** Número pt-BR com N casas fixas (default 2). */
export function formatNumeroBr(
  v: number | null | undefined,
  digits = 2,
): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const formatArea = (m2: number | null | undefined) => formatNumeroBr(m2, 2);
export const formatMetros = (m: number | null | undefined) => formatNumeroBr(m, 2);
export const formatPeso = (p: number | null | undefined) => formatNumeroBr(p, 2);
